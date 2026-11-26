const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { Client } = require("pg");
const { warehouseError } = require("../protocol/warehouse-validation.cjs");
const { validateStoredWarehouse } = require("../protocol/warehouse-state-validation.cjs");

const migration = fs.readFileSync(path.join(__dirname, "sql", "001-warehouse.sql"), "utf8");
const collections = ["racks", "stations", "cargo", "tasks", "taskArchive"];
const terminal = new Set(["completed", "cancelled"]);

// Open the old warehouse file read-only. Mission and gateway files are separate.
function readLegacy(directory) {
  const filename = path.join(directory, "records.sqlite");
  if (!fs.existsSync(filename)) return null;
  const { DatabaseSync } = require("node:sqlite");
  const source = new DatabaseSync(filename, { readOnly: true });
  try {
    source.exec("PRAGMA busy_timeout = 3000");
    const row = source.prepare("SELECT body FROM records WHERE id = 'warehouse'").get();
    if (!row) return null;
    const record = JSON.parse(row.body);
    if (record?.missionId !== "warehouse" || !record.warehouse)
      throw warehouseError(503, "invalid_storage", "Некорректная запись склада в SQLite.");
    return record.warehouse;
  } finally {
    source.close();
  }
}

async function writeItems(client, next, previous) {
  for (const collection of collections) {
    const old = new Map((previous?.[collection] ?? []).map((item, position) => [item.id, { item, position }]));
    const changed = [];
    for (const [position, item] of (next[collection] ?? []).entries()) {
      const known = old.get(item.id);
      if (!known || known.position !== position || !isDeepStrictEqual(known.item, item))
        changed.push({ id: item.id, position, body: item });
      old.delete(item.id);
    }
    if (old.size)
      await client.query("DELETE FROM gpo_warehouse.items WHERE collection = $1 AND id = ANY($2::text[])",
        [collection, [...old.keys()]]);
    if (changed.length)
      await client.query(`
        INSERT INTO gpo_warehouse.items (collection, id, position, body)
        SELECT $1, id, position, body FROM jsonb_to_recordset($2::jsonb) AS row(id text, position integer, body jsonb)
        ON CONFLICT (collection, id) DO UPDATE SET position = EXCLUDED.position, body = EXCLUDED.body
      `, [collection, JSON.stringify(changed)]);
  }
}

function createPostgresWarehouseRepository({ connection, legacyDirectory }) {
  let client, opening, closed = false;
  const unavailable = () => warehouseError(503, "warehouse_db_unavailable", "PostgreSQL склада недоступен.");
  const transact = async (db, action) => {
    await db.query("BEGIN");
    try {
      const result = await action();
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});
      throw error;
    }
  };

  const ready = async () => {
    if (closed) throw unavailable();
    if (!opening) opening = (async () => {
      const db = new Client({ ...connection, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
      db.on("error", () => {
        if (client === db) {
          client = null;
          opening = null;
          void db.end().catch(() => {});
        }
      });
      try {
        try {
          await db.connect();
        } catch {
          throw unavailable();
        }
        // The application caches the aggregate. Keep exactly one owning
        // connection per database, including during automatic SQLite import.
        const { rows: [lock] } = await db.query("SELECT pg_try_advisory_lock(715024, 1) AS acquired");
        if (!lock.acquired)
          throw warehouseError(503, "warehouse_db_busy", "Склад уже открыт другим экземпляром backend.");
        await transact(db, async () => {
          await db.query(migration);
          const {rowCount} = await db.query("SELECT 1 FROM gpo_warehouse.state");
          if (rowCount || !legacyDirectory) return;
          const legacy = readLegacy(legacyDirectory);
          if (!legacy) return;
          validateStoredWarehouse(legacy, await import("../../shared/warehouse/layout.js"));
          legacy.taskArchive = (legacy.taskArchive ?? []).concat(legacy.tasks.filter((task) => terminal.has(task.status)));
          legacy.tasks = legacy.tasks.filter((task) => !terminal.has(task.status));
          await db.query("INSERT INTO gpo_warehouse.state (revision, schema_version) VALUES ($1, $2)",
            [legacy.revision, legacy.schemaVersion]);
          await writeItems(db, legacy);
        });
        client = db;
      } catch (error) {
        await db.end().catch(() => {});
        opening = null;
        throw error;
      }
    })();
    await opening;
  };

  return {
    ready,
    async load() {
      await ready();
      const db = client;
      const {rows:[state]} = await db.query("SELECT revision, schema_version FROM gpo_warehouse.state");
      if (!state) return null;
      const snapshot = {schemaVersion:state.schema_version,revision:Number(state.revision)};
      for (const collection of collections) snapshot[collection] = [];
      const { rows } = await db.query("SELECT collection, body FROM gpo_warehouse.items ORDER BY position, id");
      for (const row of rows) snapshot[row.collection].push(row.body);
      return snapshot;
    },
    async save(next, previous) {
      await ready();
      const db = client;
      return transact(db, async () => {
        let result = await db.query(
          "UPDATE gpo_warehouse.state SET revision = $1 WHERE singleton AND revision = $2",
          [next.revision, previous.revision],
        );
        let previousRows = previous;
        if (!result.rowCount && previous.revision === 0) {
          previousRows = undefined;
          result = await db.query(
            "INSERT INTO gpo_warehouse.state (revision, schema_version) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [next.revision, next.schemaVersion],
          );
        }
        if (result.rowCount !== 1)
          throw warehouseError(409, "revision_conflict", "Склад изменился. Обновите данные.");
        await writeItems(db, next, previousRows);
      });
    },
    async close() {
      closed = true;
      await opening?.catch(() => {});
      if (client) await client.end();
    },
  };
}

module.exports = { createPostgresWarehouseRepository };
