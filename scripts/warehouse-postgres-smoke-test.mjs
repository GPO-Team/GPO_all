import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import sqlite from "../bridge/repositories/sqlite-repository.cjs";
import legacyRepository from "../bridge/repositories/warehouse-repository.cjs";
import postgres from "../bridge/repositories/postgres-warehouse-repository.cjs";
import warehouses from "../bridge/services/warehouse-service.cjs";

const { Client } = pg;
const name = `gpo-pg-test-${randomUUID()}`;
const password = randomUUID();
const directory = await mkdtemp(path.join(os.tmpdir(), "gpo-pg-legacy-"));
const docker = (args, env = process.env) => execFileSync("docker", args, {
  env, encoding: "utf8", windowsHide: true, timeout: 90000, stdio: ["ignore", "pipe", "ignore"],
}).trim();
const rack = {id:"rack",code:"A",name:"Floor",x:2,y:1,yaw:0,bays:1,placesPerBay:1,bayWidth:.25,
  depth:.25,levels:[{supportZ:0,clearHeight:.25,maxLoadKg:1}]};
const cargo = {id:"box",label:"Box",width:.03,depth:.03,height:.08,massKg:.04,objectDef:"PICK_BOX"};
let client, repository, started = false;
try {
  const local = sqlite.createSqliteRepository({directory});
  try {
    const before = warehouses.createWarehouseService({repository:legacyRepository.createWarehouseRepository({repository:local})});
    await before.createRack({rack,expectedRevision:0});
    await before.registerCargo({cargo,expectedRevision:1});
    await before.prepareTask({id:"old",cargoId:"box",destinationId:"rack:1:1:1",expectedRevision:2});
    await before.cancelTask("old",{expectedRevision:3});
  } finally {
    await local.close();
  }
  docker(["run","-d","--rm","--name",name,"-e","POSTGRES_PASSWORD","-e","POSTGRES_USER=gpo",
    "-e","POSTGRES_DB=gpo","-p","127.0.0.1::5432","postgres:17-alpine"],
    {...process.env,POSTGRES_PASSWORD:password});
  started = true;
  const port = Number(docker(["port",name,"5432/tcp"]).split(":").at(-1));
  assert.ok(port > 0);
  const connection = {host:"127.0.0.1",port,user:"gpo",database:"gpo",password};
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = new Client({...connection,connectionTimeoutMillis:1000});
    try {
      await candidate.connect();
      client = candidate;
      break;
    } catch {
      await candidate.end().catch(() => {});
      await delay(500);
    }
  }
  assert.ok(client,"PostgreSQL did not become ready");
  await client.query(await readFile(new URL("../docker/postgres/init/001-schema.sql",import.meta.url),"utf8"));
  repository = postgres.createPostgresWarehouseRepository({connection,legacyDirectory:directory});
  const warehouse = warehouses.createWarehouseService({repository});
  const imported = await warehouse.get(true);
  assert.equal(imported.warehouse.revision,4);
  assert.equal(imported.warehouse.cargo[0].objectDef,"PICK_BOX");
  assert.equal((await warehouse.history({status:"cancelled"})).tasks[0].id,"old");
  const duplicate = postgres.createPostgresWarehouseRepository({connection,legacyDirectory:directory});
  try {
    await assert.rejects(duplicate.ready(), {code:"warehouse_db_busy"});
  } finally {
    await duplicate.close();
  }
  const audit = async () => (await client.query(
    "SELECT xmin::text AS version FROM gpo_warehouse.items WHERE collection = 'cargo' AND id = 'box'",
  )).rows[0].version;
  const version = await audit();
  await warehouse.prepareTask({id:"new",cargoId:"box",destinationId:"rack:1:1:1",expectedRevision:4});
  assert.equal(await audit(),version,"unchanged cargo row was rewritten");
  assert.equal((await client.query("SELECT count(*)::int AS count FROM public.roles")).rows[0].count,3);
  await repository.close();
  repository = postgres.createPostgresWarehouseRepository({connection,legacyDirectory:directory});
  const restarted = warehouses.createWarehouseService({repository});
  const restored = await restarted.get(true);
  assert.equal(restored.warehouse.revision,5);
  assert.equal(restored.slots[0].reservedBy,"new");
  assert.equal(restored.archiveCounts.cancelled,1);
  await client.query("CREATE DATABASE warehouse_fresh");
  await repository.close();
  const freshConnection = {...connection,database:"warehouse_fresh"};
  repository = postgres.createPostgresWarehouseRepository({connection:freshConnection});
  const fresh = warehouses.createWarehouseService({repository});
  await fresh.createRack({rack,expectedRevision:0});
  await repository.close();
  repository = postgres.createPostgresWarehouseRepository({connection:freshConnection});
  const freshRestart = warehouses.createWarehouseService({repository});
  const freshSnapshot = await freshRestart.get();
  assert.equal(freshSnapshot.warehouse.stations.length,2);
  assert.equal(freshSnapshot.warehouse.racks[0].id,rack.id);
  console.log("PostgreSQL warehouse passed: SQLite import, fresh database, schema coexistence, row-level writes, ownership and restart.");
} finally {
  await repository?.close();
  await client?.end();
  if (started) docker(["rm","-f",name]);
  const cleanup = path.resolve(directory);
  assert.equal(path.dirname(cleanup),path.resolve(os.tmpdir()));
  assert.ok(path.basename(cleanup).startsWith("gpo-pg-legacy-"));
  await rm(cleanup,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
