import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sqlite from "../repositories/sqlite-repository.cjs";
import warehouseRepository from "../repositories/warehouse-repository.cjs";
import warehouses from "../services/warehouse-service.cjs";
import { exportRepository, importRepository } from "./repository-backup.mjs";
const directories = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gpo-backup-")); directories.push(root);
  const source = path.join(root, "source"), backup = path.join(root, "backup.json"), target = path.join(root, "restored");
  const repository = sqlite.createSqliteRepository({ directory: source });
  await repository.save({ missionId: "mission-1", status: "completed" });
  await repository.close();
  return { source, backup, target };
};
it("round trips records without process ownership and refuses overwrite", async () => {
  const { source, backup, target } = await fixture();
  await exportRepository(source, backup);
  await importRepository(backup, target);
  const restored = sqlite.createSqliteRepository({ directory: target });
  try { expect(await restored.get("mission-1")).toMatchObject({ status: "completed" }); }
  finally { await restored.close(); }
  await expect(importRepository(backup, target)).rejects.toThrow();
  await expect(exportRepository(source, backup)).rejects.toThrow();
});
it("refuses a live repository and detects corruption before creating target", async () => {
  const { source, backup, target } = await fixture();
  const repository = sqlite.createSqliteRepository({ directory: source });
  await repository.ready();
  try { await expect(exportRepository(source, backup)).rejects.toThrow("already owned"); }
  finally { await repository.close(); }
  await exportRepository(source, backup);
  const document = JSON.parse(await readFile(backup, "utf8"));
  document.records[0].status = "prepared";
  await writeFile(backup, JSON.stringify(document));
  await expect(importRepository(backup, target)).rejects.toThrow("checksum");
  await expect(readFile(path.join(target, "records.sqlite"))).rejects.toThrow();
});

it("restores warehouse and missions from separate copies into one state directory", async () => {
  const { source, backup, target } = await fixture();
  const warehouseBackup = path.join(path.dirname(backup), "warehouse.json");
  const sourceStore = sqlite.createSqliteRepository({ directory: path.join(source, "warehouse") });
  const warehouse = warehouses.createWarehouseService({
    repository: warehouseRepository.createWarehouseRepository({ repository: sourceStore }),
  });
  const before = await warehouse.get();
  const saved = await warehouse.registerCargo({ expectedRevision: before.warehouse.revision,
    cargo: { id: "box", label: "Test box", width: .1, depth: .1, height: .1, massKg: 1 } });
  await sourceStore.close();

  await exportRepository(source, backup);
  await exportRepository(path.join(source, "warehouse"), warehouseBackup);
  await importRepository(backup, target);
  await importRepository(warehouseBackup, path.join(target, "warehouse"));

  const restoredStore = sqlite.createSqliteRepository({ directory: path.join(target, "warehouse") });
  try {
    const restored = warehouses.createWarehouseService({
      repository: warehouseRepository.createWarehouseRepository({ repository: restoredStore }),
    });
    expect((await restored.get()).warehouse).toEqual(saved.warehouse);
  } finally { await restoredStore.close(); }
});
