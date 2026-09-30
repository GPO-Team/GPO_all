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
});
