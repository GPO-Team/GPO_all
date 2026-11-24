const { randomUUID } = require("crypto");
const {
  warehouseError,
  invalid,
  object,
  identifier,
  validateRacks,
  validateStations,
  validateCargo,
  checkRevision,
} = require("../protocol/warehouse-validation.cjs");
const { terminalStates } = require("../protocol/mission-contract.cjs");
const { validatePickPlace } = require("../protocol/manipulator-validation.cjs");
const { validateStoredWarehouse } = require("../protocol/warehouse-state-validation.cjs");

const emptyWarehouse = () => ({
  schemaVersion: 1,
  revision: 0,
  racks: [],
  cargo: [],
  tasks: [],
  taskArchive: [],
  stations: [
    { id: "receiving", kind: "receiving", name: "Приёмка", x: -8, y: -6 },
    { id: "shipping", kind: "shipping", name: "Отгрузка", x: 8, y: -6 },
  ],
});
const createWarehouseService = ({
  repository,
  missionService,
  now = () => new Date().toISOString(),
  createId = randomUUID,
}) => {
  let state,
    loading,
    pending = Promise.resolve();
  let cachedLayout;
  let cachedArchiveCounts;
  const geometry = import("../../shared/warehouse/layout.js");
  const load = async () => {
    if (!loading)
      loading = Promise.resolve()
        .then(async () => {
          const saved = await repository.load();
          if (saved !== null && saved !== undefined) {
            try {
              validateStoredWarehouse(saved, await geometry);
            } catch {
              throw warehouseError(
                503,
                "invalid_storage",
                "Некорректные сохранённые данные склада. Восстановите резервную копию.",
              );
            }
          }
          state = structuredClone(saved ?? emptyWarehouse());
          state.taskArchive = (state.taskArchive ?? []).concat(
            state.tasks.filter((task) => ["cancelled", "completed"].includes(task.status)),
          );
          state.tasks = state.tasks.filter((task) => !["cancelled", "completed"].includes(task.status));
          return state;
        })
        .catch((error) => {
          loading = null;
          throw error;
        });
    await loading;
    return state;
  };
  const slotsFor = async (warehouse) => {
    const { buildSlots } = await geometry;
    const key = JSON.stringify(warehouse.racks);
    if (cachedLayout?.key !== key) {
      cachedLayout = { key, slots: warehouse.racks.flatMap(buildSlots) };
    }
    const reservations = new Map(
      warehouse.tasks.map((task) => [task.destinationId, task.id]),
    );
    const occupied = new Map(warehouse.cargo.filter((cargo) => cargo.locationId !== "receiving")
      .map((cargo) => [cargo.locationId, cargo.id]));
    return cachedLayout.slots.map((slot) => ({
        ...slot, reservedBy: reservations.get(slot.id) || null,
        ...(occupied.has(slot.id) ? { occupiedBy: occupied.get(slot.id) } : {}),
      }));
  };
  const taskById = (warehouse, taskId) =>
    warehouse.tasks.find((task) => task.id === taskId) ??
    warehouse.taskArchive.find((task) => task.id === taskId);
  const archiveCounts = (archive) => {
    // The archive is append-only. Later snapshots only count new entries.
    if (!cachedArchiveCounts) cachedArchiveCounts = { size: 0, cancelled: 0, completed: 0 };
    const counts = cachedArchiveCounts;
    // A concurrent read may have captured an earlier revision.
    if (archive.length < counts.size) {
      const completed = archive.filter((task) => task.status === "completed").length;
      return { completed, cancelled: archive.length - completed };
    }
    for (let i = counts.size; i < archive.length; i += 1) counts[archive[i].status] += 1;
    counts.size = archive.length;
    return { cancelled: counts.cancelled, completed: counts.completed };
  };
  const snapshot = async (live = false, taskId) => {
    const current = await load();
    const { taskArchive, ...warehouse } = current;
    const slots = await slotsFor(warehouse);
    if (!live) {
      return { ok: true, warehouse: structuredClone({ ...warehouse, tasks: warehouse.tasks.concat(taskArchive) }), slots };
    }
    return {
      ok: true, warehouse: structuredClone(warehouse), slots, archiveCounts: archiveCounts(taskArchive),
      ...(taskId ? { task: structuredClone(taskById(current, taskId)) } : {}),
    };
  };
  const missing = (label) => {
    throw warehouseError(404, "not_found", `${label} не найден.`);
  };
  const conflict = (code, message) => {
    throw warehouseError(409, code, message);
  };
  const activeTasks = (warehouse) => warehouse.tasks;
  const rackUnlocked = (warehouse, id) => {
    if (warehouse.cargo.some((cargo) => cargo.locationId.startsWith(id + ":")))
      conflict("rack_occupied", "На стеллаже находится груз.");
    if (activeTasks(warehouse).some((task) => task.destinationId.startsWith(`${id}:`)))
      conflict("rack_reserved", "Стеллаж используется подготовленным заданием.");
  };
  const noPreparedTasks = (warehouse) => {
    if (activeTasks(warehouse).length)
      conflict("tasks_prepared", "Сначала завершите или отмените задания размещения.");
  };
  const serial = (action) => {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  };
  const publish = async (next) => {
    next.revision += 1;
    await repository.save(structuredClone(next));
    state = next;
  };
  const mutate = (input, change, { retry, live, taskId } = {}) => {
    // Capture caller-owned input before waiting behind another mutation.
    const body = structuredClone(input);
    return serial(async () => {
      object(body, "Запрос");
      const current = await load();
      if (retry && retry(current, body)) return snapshot(live, taskId);
      checkRevision(body.expectedRevision, current.revision);
      const next = structuredClone(current);
      await change(next, body);
      await publish(next);
      return snapshot(live, taskId);
    });
  };
  const normalizedRacks = async (racks) => validateRacks(racks, await geometry);
  const taskCommand = (body) => {
    identifier(body.id);
    identifier(body.cargoId);
    if (
      typeof body.destinationId !== "string" ||
      !/^[A-Za-z0-9_-]{1,63}:\d{1,2}:\d{1,2}:\d{1,2}$/.test(body.destinationId)
    )
      invalid("Некорректный ID ячейки.");
  };
  const deliveryContext = async (warehouse, task) => {
    const cargo = warehouse.cargo.find((item) => item.id === task.cargoId);
    const slot = (await slotsFor(warehouse)).find((item) => item.id === task.destinationId);
    const receiving = warehouse.stations.find((station) => station.id === "receiving");
    if (!cargo?.objectDef) conflict("unbound_cargo", "У груза нет имени DEF объекта Webots.");
    if (!slot || slot.supportZ !== 0 || slot.occupiedBy)
      conflict("unsupported_slot", "Робот доставляет только в свободную напольную ячейку.");
    if (cargo.width > .05 || cargo.depth > .05 || cargo.height < .03 || cargo.height > .12)
      conflict("unsupported_cargo_size", "Для захвата по камере нужна коробка до 5 × 5 см и высотой от 3 до 12 см.");
    // The camera accepts boxes up to 5 cm wide and deep. Keep their full
    // envelope inside the slot even when the registered dimensions are smaller.
    const radius = Math.hypot(.05, .05) / 2;
    if (radius >= Math.min(slot.width, slot.depth) / 2)
      conflict("insufficient_robot_clearance", "Диагональ груза не оставляет места для безопасного размещения.");
    const command = validatePickPlace({
      type: "pick_place", source: "vision",
      pickup: { objectDef: cargo.objectDef, x: receiving.x, y: receiving.y },
      destination: { x: slot.x, y: slot.y, z: cargo.height / 2 },
    });
    const rack = warehouse.racks.find((item) => item.id === slot.rackId);
    return { command, cargo, slot, radius, yaw: rack.yaw };
  };
  const deliveredAt = (evidence, { command, slot, radius, yaw }) => {
    const pose = evidence?.objectPosition;
    if (evidence?.objectDef !== command.pickup.objectDef || evidence.loadHeld !== false ||
        evidence.onPlatform !== false || !pose || ![pose.x, pose.y, pose.z].every(Number.isFinite))
      return false;
    const dx = pose.x - slot.x, dy = pose.y - slot.y;
    const localX = dx * Math.cos(yaw) + dy * Math.sin(yaw);
    const localY = -dx * Math.sin(yaw) + dy * Math.cos(yaw);
    return Math.hypot(dx, dy) <= .05 && Math.abs(pose.z - command.destination.z) <= .012 &&
      Math.abs(localX) + radius <= slot.width / 2 && Math.abs(localY) + radius <= slot.depth / 2;
  };
  const syncTask = async (warehouse, task, mission) => {
    if (mission?.missionId !== task.missionId) return false;
    const before = JSON.stringify(task);
    task.missionStatus = mission.status;
    if (mission.status === "completed") {
      const delivery = await deliveryContext(warehouse, task);
      if (deliveredAt(mission.deliveryEvidence, delivery)) {
        delivery.cargo.locationId = task.destinationId;
        warehouse.tasks = warehouse.tasks.filter((item) => item.id !== task.id);
        warehouse.taskArchive.push({ ...task, status: "completed", completedAt: now() });
        return true;
      }
    }
    const blocked = terminalStates.has(mission.status) || mission.status === "holding_for_recovery";
    task.status = blocked ? "attention" : "executing";
    task.failureReason = blocked
      ? (mission.status === "completed" ? "delivery_unconfirmed" : mission.failureReason || mission.errorCode || mission.status)
      : null;
    return JSON.stringify(task) !== before;
  };
  return {
    async ready() {
      await repository.ready?.();
      await load();
    },
    get: snapshot,
    async history({ status, before, limit } = {}) {
      if (!["cancelled", "completed"].includes(status)) invalid("Укажите тип истории: cancelled или completed.");
      const size = limit == null ? 25 : Number(limit);
      const cursor = before == null ? null : Number(before);
      if (!Number.isSafeInteger(size) || size < 1 || size > 100 ||
          (cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1)))
        invalid("Некорректный курсор или размер страницы истории.");
      const { taskArchive } = await load();
      const tasks = [];
      let index = Math.min(cursor ?? taskArchive.length, taskArchive.length) - 1;
      for (; index >= 0; index -= 1) {
        const task = taskArchive[index];
        if (task.status !== status) continue;
        if (tasks.length === size) break;
        tasks.push(task);
      }
      return { ok: true, tasks: structuredClone(tasks), nextCursor: index < 0 ? null : index + 1 };
    },
    async suggestions(cargoId) {
      identifier(cargoId);
      const warehouse = await load();
      const cargo = warehouse.cargo.find((item) => item.id === cargoId);
      if (!cargo) missing("Груз");
      const { placementReasons } = await geometry;
      const busy = activeTasks(warehouse).some((task) => task.cargoId === cargoId);
      const suggestions = (await slotsFor(warehouse))
        .map((slot) => {
          const reasons = placementReasons(cargo, slot);
          if (busy) reasons.push("Для груза уже подготовлено задание.");
          if (cargo.locationId !== "receiving") reasons.push("Груз отсутствует в зоне приёмки.");
          return {
            slotId: slot.id,
            address: slot.address,
            eligible: reasons.length === 0,
            reasons,
            robotAccess: "unverified",
          };
        })
        .sort(
          (left, right) =>
            Number(right.eligible) - Number(left.eligible) ||
            left.address.localeCompare(right.address),
        );
      return { ok: true, revision: warehouse.revision, suggestions };
    },
    createRack: (body, live) =>
      mutate(body, async (warehouse, { rack }) => {
        object(rack, "Стеллаж");
        warehouse.racks = await normalizedRacks([
          ...warehouse.racks,
          { ...rack, id: rack.id === undefined ? createId() : rack.id },
        ]);
      }, { live }),
    updateRack: (id, body, live) =>
      mutate(body, async (warehouse, { rack }) => {
        identifier(id);
        const index = warehouse.racks.findIndex((item) => item.id === id);
        if (index < 0) missing("Стеллаж");
        rackUnlocked(warehouse, id);
        object(rack, "Стеллаж");
        if (rack.id !== undefined && rack.id !== id)
          invalid("ID стеллажа не совпадает с адресом запроса.");
        warehouse.racks[index] = { ...rack, id };
        warehouse.racks = await normalizedRacks(warehouse.racks);
      }, { live }),
    deleteRack: (id, body, live) =>
      mutate(body, async (warehouse) => {
        identifier(id);
        if (!warehouse.racks.some((item) => item.id === id)) missing("Стеллаж");
        rackUnlocked(warehouse, id);
        warehouse.racks = warehouse.racks.filter((item) => item.id !== id);
      }, { live }),
    updateStations: (body, live) =>
      mutate(body, async (warehouse, { stations }) => {
        noPreparedTasks(warehouse);
        warehouse.stations = validateStations(stations);
      }, { live }),
    registerCargo: (body, live) =>
      mutate(body, async (warehouse, { cargo }) => {
        const normalized = validateCargo(cargo);
        if (warehouse.cargo.some((item) => item.id === normalized.id))
          conflict("id_conflict", "Груз с таким ID уже существует.");
        if (normalized.objectDef && warehouse.cargo.some((item) => item.objectDef === normalized.objectDef))
          conflict("object_already_registered", "Этот объект Webots уже зарегистрирован.");
        if (warehouse.cargo.length >= 2000) invalid("Допускается не более 2000 грузов.");
        warehouse.cargo.push({ ...normalized, createdAt: now() });
      }, { live }),
    prepareTask: (body, live) =>
      mutate(
        body,
        async (warehouse, command) => {
          taskCommand(command);
          const cargo = warehouse.cargo.find((item) => item.id === command.cargoId);
          if (!cargo) missing("Груз");
          const slot = (await slotsFor(warehouse)).find(
            (item) => item.id === command.destinationId,
          );
          if (!slot) missing("Ячейка");
          if (cargo.locationId !== "receiving")
            conflict("invalid_source", "Груз отсутствует в зоне приёмки.");
          if (activeTasks(warehouse).some((task) => task.cargoId === cargo.id))
            conflict("cargo_reserved", "Для груза уже подготовлено задание.");
          const reasons = (await geometry).placementReasons(cargo, slot);
          if (reasons.length) conflict("placement_conflict", reasons.join(" "));
          warehouse.tasks.push({
            id: command.id,
            cargoId: cargo.id,
            sourceId: "receiving",
            destinationId: slot.id,
            status: "prepared",
            createdAt: now(),
          });
        },
        { live, taskId: body?.id, retry: (warehouse, command) => {
          taskCommand(command);
          const existing = taskById(warehouse, command.id);
          if (!existing) return false;
          if (
            existing.cargoId !== command.cargoId ||
            existing.destinationId !== command.destinationId
          )
            conflict("id_conflict", "ID задания принадлежит другой операции.");
          return true;
        } },
      ),
    startTask: (id, body, live) => serial(async () => {
      identifier(id);
      object(body, "Запрос");
      if (!missionService) throw warehouseError(503, "robot_unavailable", "Сервис робота недоступен.");
      const next = structuredClone(await load());
      const task = next.tasks.find((item) => item.id === id);
      if (!task) {
        if (next.taskArchive.some((item) => item.id === id && item.status === "completed")) return snapshot(live, id);
        missing("Задание");
      }
      if (!["prepared", "launching"].includes(task.status)) return snapshot(live, id);
      const { command } = await deliveryContext(next, task);
      if (task.status === "prepared") {
        checkRevision(body.expectedRevision, next.revision);
        if (next.tasks.some((item) => item.id !== id && item.status !== "prepared"))
          conflict("warehouse_robot_busy", "Сначала завершите текущее задание робота.");
        task.status = "launching";
        task.missionId = "warehouse-" + randomUUID();
        await publish(next);
      }
      let mission;
      try {
        mission = await missionService.submit(command, { requestId: task.missionId });
      } catch (error) {
        if (error.code === "mission_active" && !(await missionService.get(task.missionId))) {
          const restored = structuredClone(await load());
          const queued = restored.tasks.find((item) => item.id === id);
          queued.status = "prepared";
          delete queued.missionId;
          await publish(restored);
        }
        throw error;
      }
      const updated = structuredClone(await load());
      const currentTask = updated.tasks.find((item) => item.id === id);
      if (await syncTask(updated, currentTask, mission)) await publish(updated);
      return snapshot(live, id);
    }),
    reconcile: () => serial(async () => {
      if (!missionService) return;
      const current = await load();
      const tracked = current.tasks.find((task) => task.missionId);
      if (!tracked) return;
      const mission = await missionService.get(tracked.missionId);
      if (!mission) return;
      const next = structuredClone(current);
      const task = next.tasks.find((item) => item.id === tracked.id);
      if (await syncTask(next, task, mission)) await publish(next);
    }),
    stopTask: (id, _body, live) => serial(async () => {
      identifier(id);
      const next = structuredClone(await load());
      const task = next.tasks.find((item) => item.id === id);
      if (!task) missing("Задание");
      if (task.status !== "executing" && task.missionStatus !== "holding_for_recovery")
        conflict("task_not_running", "У задания нет выполняющейся миссии.");
      const mission = await missionService.cancel(task.missionId);
      if (await syncTask(next, task, mission)) await publish(next);
      return snapshot(live, id);
    }),
    cancelTask: (id, body, live) =>
      mutate(
        body,
        async (warehouse, { confirmReturned }) => {
          const index = warehouse.tasks.findIndex((task) => task.id === id);
          if (index < 0) missing("Задание");
          const task = warehouse.tasks[index];
          const returned = confirmReturned === true && task.status === "attention" &&
            terminalStates.has(task.missionStatus);
          if (task.status !== "prepared" && !returned)
            conflict("task_in_execution", "Резерв можно снять только после остановки миссии и возврата груза на приёмку.");
          warehouse.tasks.splice(index, 1);
          warehouse.taskArchive.push({ ...task, status: "cancelled", cancelledAt: now() });
        },
        { live, taskId: id, retry: (warehouse) => {
          identifier(id);
          return taskById(warehouse, id)?.status === "cancelled";
        } },
      ),
    importLayout: (body, live) =>
      mutate(body, async (warehouse, { layout }) => {
        noPreparedTasks(warehouse);
        if (warehouse.cargo.some((cargo) => cargo.locationId !== "receiving"))
          conflict("layout_occupied", "На складе есть размещённый груз.");
        object(layout, "План склада");
        if (layout.schemaVersion !== 1) invalid("Неподдерживаемая версия плана склада.");
        if (!Array.isArray(layout.racks)) invalid("Требуется список стеллажей.");
        warehouse.racks = await normalizedRacks(
          layout.racks.map((rack) => ({
            ...object(rack, "Стеллаж"),
            id: rack.id === undefined ? createId() : rack.id,
          })),
        );
        warehouse.stations = validateStations(layout.stations);
      }, { live }),
    drain: () => pending,
  };
};
module.exports = { createWarehouseService };
