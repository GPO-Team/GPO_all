import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import missions from "./mission-service.cjs";
import repositories from "../repositories/mission-repository.cjs";
import stores from "../artifacts/web-state-store.cjs";
import adapters from "../adapters/webots-file-adapter.cjs";
import routes from "./route-service.cjs";
import coordinateContract from "../../shared/coordinate-contract.json";
let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
const setup = async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gpo-arm-"));
  const repository = repositories.createMissionRepository({ directory: path.join(directory, "missions") });
  const artifactStore = stores.createWebStateStore({ coordinateContract, stateDir: directory });
  const adapter = adapters.createWebotsFileAdapter({ artifactStore, stateDir: directory });
  const service = missions.createMissionService({ repository, adapter });
  return { service, routeService: routes.createRouteService({ missionService: service }) };
};
const command = { type: "pick_place", objectDef: "PICK_BOX", destination: { x: 0.4, y: 0.1, z: 0.055 } };
it("delivers a tracked arm mission once and excludes competing movement", async () => {
  const { service, routeService } = await setup();
  const result = await routeService.handle(command, { requestId: "arm-1" });
  expect(result.missionId).toBe("arm-1");
  await service.submit(command, { requestId: "arm-1" });
  const text = await readFile(path.join(directory, "runtime_command.txt"), "utf8");
  expect(text.match(/type pick_place/g)).toHaveLength(1);
  expect(text).toContain("object_def PICK_BOX\n");
  expect(text).toContain("target_z 0.055\n");
  await expect(service.submit({ type: "route", route: [{x:0,y:0},{x:1,y:0}] }, {requestId:"other"})).rejects.toMatchObject({statusCode:409});
  expect((await service.cancel("arm-1")).status).toBe("cancelling");
});
it("rejects invalid arm targets before journaling movement", async () => {
  const { service } = await setup();
  for (const invalid of [
    {...command, objectDef:"bad\ninjected"},
    {...command, destination:{x:NaN,y:0,z:0}},
    {...command, destination:{x:0,y:0,z:-1}},
  ]) await expect(service.submit(invalid, {requestId:"invalid"})).rejects.toMatchObject({statusCode:400});
  expect(await service.list()).toHaveLength(0);
  await expect(service.update(command)).rejects.toMatchObject({statusCode:400});
});
