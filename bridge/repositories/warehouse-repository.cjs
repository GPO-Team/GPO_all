// Adapt the existing private record store without mixing warehouse and mission records.
// Composition supplies a separate directory and owns its lifecycle.
const { warehouseError } = require("../protocol/warehouse-validation.cjs");

const createWarehouseRepository = ({ repository }) => ({
  ready: () => repository.ready?.(),
  async load() {
    const record = await repository.get("warehouse");
    if (record === null || record === undefined) return null;
    if (
      record.missionId !== "warehouse" ||
      !Object.hasOwn(record, "warehouse") ||
      record.warehouse === null
    )
      throw warehouseError(
        503,
        "invalid_storage",
        "Некорректная запись склада. Восстановите резервную копию.",
      );
    return structuredClone(record.warehouse);
  },
  async save(warehouse) {
    await repository.save({ missionId: "warehouse", warehouse: structuredClone(warehouse) });
  },
  close: () => repository.close?.(),
});
module.exports = { createWarehouseRepository };
