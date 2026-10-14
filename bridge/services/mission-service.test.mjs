import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import missions from "./mission-service.cjs";
import repositories from "../repositories/mission-repository.cjs";
const directories = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory,{recursive:true,force:true}); });
const setup = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(),"gpo-missions-")); directories.push(directory);
  const repository = repositories.createMissionRepository({directory});
  const adapter = { submit:vi.fn(async () => {}), cancel:vi.fn(async () => {}), getFeedback:vi.fn(async () => null) };
  return { repository, adapter, service:missions.createMissionService({repository,adapter}) };
};
const payload = { type:"route", route:[{x:0,y:0},{x:1,y:0}] };
it("rejects an unknown movement type before persisting or delivering a mission", async () => {
  const {repository,adapter,service} = await setup();
  await expect(service.submit({...payload,type:"pick_plac"},{requestId:"unknown-arm"})).rejects.toMatchObject({statusCode:400});
  expect(await repository.get("unknown-arm")).toBeNull();
  expect(adapter.submit).not.toHaveBeenCalled();
  await expect(service.submit(payload,{requestId:"valid-route"})).resolves.toMatchObject({status:"persisted"});
});
it("tracks surveys durably, excludes other movement and waits for cancellation feedback", async () => {
  const {repository, adapter, service} = await setup();
  const survey = {type:"start_mapping_survey", mode:"snake"};
  const first = await service.submit(survey, {requestId:"survey-1"});
  expect(first.command.commandId).toBe("survey-1");
  const restarted = missions.createMissionService({repository, adapter});
  await restarted.submit(survey, {requestId:"survey-1"});
  expect(adapter.submit).toHaveBeenCalledOnce();
  await expect(restarted.submit(payload, {requestId:"route-after-survey"})).rejects.toMatchObject({statusCode:409});
  expect((await restarted.cancel("survey-1")).status).toBe("cancelling");
  expect(adapter.cancel).toHaveBeenCalledWith("survey-1");
  await expect(restarted.submit(payload, {requestId:"route-after-survey"})).rejects.toMatchObject({statusCode:409});
  adapter.getFeedback.mockResolvedValue({missionId:"survey-1",status:"cancelled"});
  await restarted.reconcile();
  expect((await restarted.submit(payload, {requestId:"route-after-survey"})).status).toBe("persisted");
});

it("rejects surveys submitted as untracked scene updates", async () => {
  const {service} = await setup();
  await expect(service.update({type:"start_mapping_survey"})).rejects.toMatchObject({statusCode:400});
});
describe("mission application service", () => {
  it("persists a submission and makes the same request idempotent across restart", async () => {
    const {repository,adapter,service} = await setup();
    const first = await service.submit(payload,{requestId:"mission-1"});
    const restarted = missions.createMissionService({repository,adapter});
    const second = await restarted.submit(payload,{requestId:"mission-1"});
    expect(first.status).toBe("persisted");
    expect(second.missionId).toBe(first.missionId);
    expect(adapter.submit).toHaveBeenCalledOnce();
  });
  it("rejects reuse of an id for different commands", async () => {
    const {service} = await setup();
    await service.submit(payload,{requestId:"mission-2"});
    await expect(service.submit({...payload,route:[{x:0,y:0},{x:2,y:0}]},{requestId:"mission-2"})).rejects.toMatchObject({statusCode:409});
  });
  it("does not report persistence when the adapter fails and retries with the same command id", async () => {
    const {service,adapter} = await setup();
    adapter.submit.mockRejectedValueOnce(new Error("disk full"));
    await expect(service.submit(payload,{requestId:"mission-3"})).rejects.toThrow("disk full");
    await service.submit(payload,{requestId:"mission-3"});
    expect(adapter.submit.mock.calls.map(([command]) => command.commandId)).toEqual(["mission-3","mission-3"]);
  });
  it("uses only matching controller feedback and preserves terminal states", async () => {
    const {service,adapter} = await setup();
    await service.submit(payload,{requestId:"mission-4"});
    adapter.getFeedback.mockResolvedValue({missionId:"other",status:"completed"});
    expect((await service.get("mission-4")).status).toBe("persisted");
    adapter.getFeedback.mockResolvedValue({missionId:"mission-4",status:"completed"});
    expect((await service.get("mission-4")).status).toBe("completed");
    adapter.getFeedback.mockResolvedValue({missionId:"mission-4",status:"running"});
    expect((await service.get("mission-4")).status).toBe("completed");
  });
});

it("reconciles prepared delivery after restart without a browser", async () => {
  const {repository,adapter,service}=await setup();
  adapter.submit.mockRejectedValueOnce(new Error("offline"));
  await expect(service.submit(payload,{requestId:"recover"})).rejects.toThrow();
  const restarted=missions.createMissionService({repository,adapter});
  await restarted.reconcile();
  expect((await repository.get("recover")).status).toBe("persisted");
  adapter.getFeedback.mockResolvedValue({missionId:"recover",status:"completed"});
  await restarted.reconcile();
  expect((await repository.get("recover")).status).toBe("completed");
});
it("rejects replacement until cancellation is acknowledged by the controller", async () => {
  const {repository,adapter,service}=await setup();
  await service.submit(payload,{requestId:"active"});
  await expect(service.submit(payload,{requestId:"next"})).rejects.toMatchObject({statusCode:409});
  expect((await service.cancel("active")).status).toBe("cancelling");
  await expect(service.submit(payload,{requestId:"next"})).rejects.toMatchObject({statusCode:409});
  adapter.getFeedback.mockResolvedValue({missionId:"active",status:"cancelled"});
  await service.reconcile();
  expect((await repository.get("active")).status).toBe("cancelled");
  await service.submit(payload,{requestId:"next"});
});
