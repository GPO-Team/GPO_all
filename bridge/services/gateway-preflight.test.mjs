import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import coordinateContract from "../../shared/coordinate-contract.json";
import gateway from "./gateway-service.cjs";
import adapters from "../adapters/webots-file-adapter.cjs";
import stores from "../artifacts/web-state-store.cjs";

let directory;
afterEach(async () => { if (directory) await rm(directory,{recursive:true,force:true}); });
const setup = async () => {
  directory = await mkdtemp(path.join(os.tmpdir(),"gpo-preflight-"));
  const records = new Map();
  const repository = {get:async id=>records.get(id),save:async record=>records.set(record.missionId,record)};
  const artifactStore = stores.createWebStateStore({coordinateContract,stateDir:directory});
  const adapter = adapters.createWebotsFileAdapter({artifactStore,stateDir:directory});
  return {repository,service:gateway.createGatewayService({repository,adapter})};
};
it("does not reserve robot ownership for an invalid manipulator command", async () => {
  const {repository,service} = await setup();
  await expect(service.execute("submit","bad-arm",{type:"pick_place",commandId:"bad-arm",objectDef:"PICK_BOX",destination:{x:NaN,y:0,z:0.04}})).rejects.toMatchObject({statusCode:400});
  expect(await repository.get("gateway-active")).toBeUndefined();
  await expect(service.execute("submit","valid-arm",{type:"pick_place",commandId:"valid-arm",objectDef:"PICK_BOX",destination:{x:0.4,y:0.1,z:0.04}})).resolves.toMatchObject({accepted:true});
});
it("rejects an unknown command instead of delivering it as a route", async () => {
  const {repository,service} = await setup();
  await expect(service.execute("submit","unknown",{type:"unknown_action",commandId:"unknown",route:[{x:0,y:0},{x:1,y:0}]})).rejects.toMatchObject({statusCode:400});
  expect(await repository.get("gateway-active")).toBeUndefined();
});
it("rejects a different delivered command identity before reserving the robot", async () => {
  const {repository,service} = await setup();
  await expect(service.execute("submit","owner-arm",{type:"pick_place",commandId:"different-arm",objectDef:"PICK_BOX",destination:{x:0.4,y:0.1,z:0.04}})).rejects.toMatchObject({statusCode:400});
  expect(await repository.get("gateway-active")).toBeUndefined();
  await expect(service.execute("submit","valid-arm",{type:"pick_place",commandId:"valid-arm",objectDef:"PICK_BOX",destination:{x:0.4,y:0.1,z:0.04}})).resolves.toMatchObject({accepted:true});
});
