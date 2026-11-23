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
// Cancelled tasks may reference racks removed since cancellation; active ones may not.
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
    state.tasks.length > 10000
  )
    invalid("Некорректные списки грузов или заданий.");
  const cargo = new Map();
  for (const item of state.cargo) {
    const normalized = validateCargo(item);
    if (item.locationId !== "receiving" || cargo.has(normalized.id))
      invalid("Некорректное местоположение или повторный ID груза.");
    timestamp(item.createdAt);
    cargo.set(normalized.id, normalized);
  }
  const slots = new Map(racks.flatMap(geometry.buildSlots).map((slot) => [slot.id, slot]));
  const taskIds = new Set(),
    reservedCargo = new Set(),
    reservedSlots = new Set();
  for (const task of state.tasks) {
    object(task, "Сохранённое задание");
    identifier(task.id);
    identifier(task.cargoId);
    if (
      taskIds.has(task.id) ||
      !cargo.has(task.cargoId) ||
      task.sourceId !== "receiving" ||
      !["prepared", "cancelled"].includes(task.status) ||
      typeof task.destinationId !== "string" ||
      !/^[A-Za-z0-9_-]{1,63}:\d{1,2}:\d{1,2}:\d{1,2}$/.test(task.destinationId)
    )
      invalid("Некорректные ссылки сохранённого задания.");
    taskIds.add(task.id);
    timestamp(task.createdAt);
    if (task.status === "cancelled") {
      timestamp(task.cancelledAt);
      continue;
    }
    const slot = slots.get(task.destinationId);
    if (
      !slot ||
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
