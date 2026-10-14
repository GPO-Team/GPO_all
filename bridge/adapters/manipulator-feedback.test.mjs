import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import adapters from "./webots-file-adapter.cjs";
import missions from "../services/mission-service.cjs";

let directory;
afterEach(async () => { if (directory) await rm(directory, {recursive:true,force:true}); });
it("retains the controller failure reason in mission history", async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gpo-arm-feedback-"));
  const adapter = adapters.createWebotsFileAdapter({artifactStore:{writeRuntimeCommand:async()=>{}},stateDir:directory});
  const records = new Map();
  const repository = { get:async id=>records.get(id), list:async()=>[...records.values()], save:async record=>records.set(record.missionId,record) };
  const service = missions.createMissionService({repository,adapter});
  await service.submit({type:"pick_place",objectDef:"PICK_BOX",destination:{x:0.4,y:0.1,z:0.04}}, {requestId:"arm-failure"});
  await writeFile(path.join(directory,"robot_state.json"),JSON.stringify({
    navigation:{missionId:"arm-failure",status:"route_failed",finished:true,error:"invalid_sensor"},
    manipulator:{missionId:"arm-failure",stage:"failed",error:"invalid_sensor"},
  }));
  const feedback = await adapter.getFeedback("arm-failure");
  expect(feedback).toMatchObject({status:"failed",error:"invalid_sensor"});
  expect(await service.get("arm-failure")).toMatchObject({status:"failed",failureReason:"invalid_sensor"});
  await rm(path.join(directory,"robot_state.json"));
  expect(await service.get("arm-failure")).toMatchObject({status:"failed",failureReason:"invalid_sensor"});
});
