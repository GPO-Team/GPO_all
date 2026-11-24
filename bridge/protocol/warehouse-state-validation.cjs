const {
  object,
  identifier,
  invalid,
  validateRacks,
  validateStations,
  validateCargo,
} = require("./warehouse-validation.cjs");

const timestamp = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid("Некорректная отметка времени склада.");
};

// Validate a persisted aggregate before deriving cells or publishing success.
// Completed stock and active reservations must both have a physical slot in the layout.
const validateStoredWarehouse = (state, geometry) => {
  object(state, "Сохранённый склад");
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0)
    invalid("Неподдерживаемая версия сохранённого склада.");
  const racks = validateRacks(state.racks, geometry);
  validateStations(state.stations);
  if (
    !Array.isArray(state.cargo) ||
    state.cargo.length > 2000 ||
    !Array.isArray(state.tasks) ||
    (state.taskArchive !== undefined && !Array.isArray(state.taskArchive))
  )
    invalid("Некорректные списки грузов или заданий.");
  const slots = new Map(racks.flatMap(geometry.buildSlots).map((slot) => [slot.id, slot]));
  const cargo = new Map(), occupied = new Set(), objectDefs = new Set();
  for (const item of state.cargo) {
    const normalized = validateCargo(item, { stored: true });
    if (cargo.has(normalized.id) || objectDefs.has(normalized.objectDef))
      invalid("Повторный груз или объект Webots.");
    if (normalized.objectDef) objectDefs.add(normalized.objectDef);
    if (item.verifiedControllerBootId !== undefined) identifier(item.verifiedControllerBootId);
    if (item.locationId !== "receiving") {
      const slot = slots.get(item.locationId);
      if (!slot || slot.supportZ !== 0 || !normalized.objectDef ||
          occupied.has(slot.id) || geometry.placementReasons(normalized, slot).length)
        invalid("Некорректное местоположение груза.");
      occupied.add(slot.id);
    }
    timestamp(item.createdAt);
    cargo.set(normalized.id, { ...normalized, locationId: item.locationId });
  }
  const taskIds = new Set(),
    reservedCargo = new Set(),
    reservedSlots = new Set();
  const liveMissions = new Set(), missionIds = new Set();
  const archive = state.taskArchive ?? [];
  if (archive.some((task) => !["cancelled", "completed"].includes(task?.status)))
    invalid("В архиве склада допустимы только завершённые и отменённые задания.");
  for (const task of state.tasks.concat(archive)) {
    object(task, "Сохранённое задание");
    identifier(task.id);
    identifier(task.cargoId);
    if (
      taskIds.has(task.id) ||
      !cargo.has(task.cargoId) ||
      task.sourceId !== "receiving" ||
      !["prepared", "launching", "executing", "attention", "cancelled", "completed"].includes(task.status) ||
      typeof task.destinationId !== "string" ||
      !/^[A-Za-z0-9_-]{1,63}:\d{1,2}:\d{1,2}:\d{1,2}$/.test(task.destinationId)
    )
      invalid("Некорректные ссылки сохранённого задания.");
    taskIds.add(task.id);
    timestamp(task.createdAt);
    if (task.missionId !== undefined) {
      identifier(task.missionId);
      if (missionIds.has(task.missionId) || task.status === "prepared")
        invalid("Некорректная ссылка на миссию.");
      missionIds.add(task.missionId);
    } else if (["launching", "executing", "attention", "completed"].includes(task.status)) {
      invalid("У складского задания отсутствует миссия.");
    }
    if (task.status === "completed") {
      timestamp(task.completedAt);
      if (task.missionStatus !== "completed")
        invalid("Некорректное завершённое размещение.");
      continue;
    }
    if (task.status === "cancelled") {
      timestamp(task.cancelledAt);
      continue;
    }
    if (task.missionId) {
      const validStatus = task.status === "launching" ? task.missionStatus === undefined :
        task.status === "executing" ? ["prepared", "persisted", "accepted", "running", "cancelling"].includes(task.missionStatus) :
          ["holding_for_recovery", "completed", "failed", "cancelled"].includes(task.missionStatus);
      if (liveMissions.size || !validStatus || !cargo.get(task.cargoId).objectDef)
        invalid("Некорректная активная миссия склада.");
      liveMissions.add(task.missionId);
    }
    const slot = slots.get(task.destinationId);
    if (
      !slot || occupied.has(slot.id) || cargo.get(task.cargoId).locationId !== "receiving" ||
      (task.missionId && slot.supportZ !== 0) ||
      reservedCargo.has(task.cargoId) ||
      reservedSlots.has(slot.id) ||
      geometry.placementReasons(cargo.get(task.cargoId), slot).length
    )
      invalid("Некорректный сохранённый резерв ячейки.");
    reservedCargo.add(task.cargoId);
    reservedSlots.add(slot.id);
  }
};

module.exports = { validateStoredWarehouse };
