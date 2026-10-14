import { describe, expect, it, vi } from "vitest";
import routeServiceModule from "./route-service.cjs";

const { createRouteService } = routeServiceModule;

describe("route service", () => {
  it("submits survey movement through the mission lifecycle", async () => {
    const command = {type:"start_mapping_survey", mode:"double"};
    const missionService = {submit:vi.fn(async () => ({missionId:"survey",status:"persisted",command})),update:vi.fn()};
    const context = {requestId:"survey"};
    const result = await createRouteService({missionService}).handle(command, context);
    expect(result).toMatchObject({handled:true,missionId:"survey",status:"persisted"});
    expect(missionService.submit).toHaveBeenCalledWith(command, context);
    expect(missionService.update).not.toHaveBeenCalled();
  });
  it("persists a route command through its storage port", async () => {
    const artifactStore = { writeRoute: vi.fn(async () => {}) };
    const service = createRouteService({ artifactStore });
    const result = await service.handle({ type: "route", route: [{ x: 0, y: 0 }] });

    expect(result).toEqual({ handled: true });
    expect(artifactStore.writeRoute).toHaveBeenCalledWith({
      type: "route",
      route: [{ x: 0, y: 0 }],
    });
  });

  it("submits an object transfer through the mission service", async () => {
    const missionService={submit:vi.fn(async()=>({missionId:"transfer-1",operationType:"object_transfer",status:"persisted",command:{type:"transfer_object"}}))};
    const service=createRouteService({missionService});
    const result=await service.handle({type:"transfer_object",objectId:"demo-box",destination:{x:1,y:2}},{requestId:"transfer-1"});
    expect(result).toMatchObject({handled:true,missionId:"transfer-1",operationType:"object_transfer",status:"persisted"});
    expect(missionService.submit).toHaveBeenCalledOnce();
  });
});
