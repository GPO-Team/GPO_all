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
const { validateStoredWarehouse } = require("../protocol/warehouse-state-validation.cjs");

const emptyWarehouse = () => ({
  schemaVersion: 1,
  revision: 0,
  racks: [],
  cargo: [],
  tasks: [],
  stations: [
    { id: "receiving", kind: "receiving", name: "Приёмка", x: -8, y: -6 },
    { id: "shipping", kind: "shipping", name: "Отгрузка", x: 8, y: -6 },
  ],
});
const createWarehouseService = ({
  repository,
  now = () => new Date().toISOString(),
  createId = randomUUID,
}) => {
  let state,
    loading,
    pending = Promise.resolve();
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
    const reservations = new Map(
      warehouse.tasks
        .filter((task) => task.status === "prepared")
        .map((task) => [task.destinationId, task.id]),
    );
    return warehouse.racks
      .flatMap(buildSlots)
      .map((slot) => ({ ...slot, reservedBy: reservations.get(slot.id) || null }));
  };
  const snapshot = async () => {
    const warehouse = structuredClone(await load());
    return { ok: true, warehouse, slots: await slotsFor(warehouse) };
  };
  const missing = (label) => {
    throw warehouseError(404, "not_found", `${label} не найден.`);
  };
  const conflict = (code, message) => {
    throw warehouseError(409, code, message);
  };
  const activeTasks = (warehouse) => warehouse.tasks.filter((task) => task.status === "prepared");
  const rackUnlocked = (warehouse, id) => {
    if (activeTasks(warehouse).some((task) => task.destinationId.startsWith(`${id}:`)))
      conflict("rack_reserved", "Стеллаж используется подготовленным заданием.");
  };
  const noPreparedTasks = (warehouse) => {
    if (activeTasks(warehouse).length)
      conflict("tasks_prepared", "Сначала отмените подготовленные задания.");
  };
  const mutate = (input, change, retry) => {
    // Capture caller-owned input before waiting behind another mutation.
    const body = structuredClone(input);
    const result = pending.then(async () => {
      object(body, "Запрос");
      const current = await load();
      if (retry && retry(current, body)) return snapshot();
      checkRevision(body.expectedRevision, current.revision);
      const next = structuredClone(current);
      await change(next, body);
      next.revision = current.revision + 1;
      await repository.save(structuredClone(next));
      state = next;
      return snapshot();
    });
    pending = result.catch(() => {});
    return result;
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
  return {
    get: snapshot,
    async suggestions(cargoId) {
      identifier(cargoId);
      const warehouse = structuredClone(await load());
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
    createRack: (body) =>
      mutate(body, async (warehouse, { rack }) => {
        object(rack, "Стеллаж");
        warehouse.racks = await normalizedRacks([
          ...warehouse.racks,
          { ...rack, id: rack.id === undefined ? createId() : rack.id },
        ]);
      }),
    updateRack: (id, body) =>
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
      }),
    deleteRack: (id, body) =>
      mutate(body, async (warehouse) => {
        identifier(id);
        if (!warehouse.racks.some((item) => item.id === id)) missing("Стеллаж");
        rackUnlocked(warehouse, id);
        warehouse.racks = warehouse.racks.filter((item) => item.id !== id);
      }),
    updateStations: (body) =>
      mutate(body, async (warehouse, { stations }) => {
        noPreparedTasks(warehouse);
        warehouse.stations = validateStations(stations);
      }),
    registerCargo: (body) =>
      mutate(body, async (warehouse, { cargo }) => {
        const normalized = validateCargo(cargo);
        if (warehouse.cargo.some((item) => item.id === normalized.id))
          conflict("id_conflict", "Груз с таким ID уже существует.");
        if (warehouse.cargo.length >= 2000) invalid("Допускается не более 2000 грузов.");
        warehouse.cargo.push({ ...normalized, createdAt: now() });
      }),
    prepareTask: (body) =>
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
          if (warehouse.tasks.length >= 10000) invalid("Достигнут предел в 10000 заданий.");
          warehouse.tasks.push({
            id: command.id,
            cargoId: cargo.id,
            sourceId: "receiving",
            destinationId: slot.id,
            status: "prepared",
            createdAt: now(),
          });
        },
        (warehouse, command) => {
          taskCommand(command);
          const existing = warehouse.tasks.find((task) => task.id === command.id);
          if (!existing) return false;
          if (
            existing.cargoId !== command.cargoId ||
            existing.destinationId !== command.destinationId
          )
            conflict("id_conflict", "ID задания принадлежит другой операции.");
          return true;
        },
      ),
    cancelTask: (id, body) =>
      mutate(
        body,
        async (warehouse) => {
          const task = warehouse.tasks.find((item) => item.id === id);
          if (!task) missing("Задание");
          task.status = "cancelled";
          task.cancelledAt = now();
        },
        (warehouse) => {
          identifier(id);
          return warehouse.tasks.some((task) => task.id === id && task.status === "cancelled");
        },
      ),
    importLayout: (body) =>
      mutate(body, async (warehouse, { layout }) => {
        noPreparedTasks(warehouse);
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
      }),
    drain: () => pending,
  };
};
module.exports = { createWarehouseService };
