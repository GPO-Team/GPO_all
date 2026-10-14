import { describe, expect, it, vi } from "vitest";
import handlerModule from "./mission-http-handler.cjs";

const { createMissionHttpHandler, publicMission } = handlerModule;

const createResponse = () => {
  let body = "";
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(statusCode, headers = {}) { this.statusCode = statusCode; Object.assign(this.headers, headers); },
    end(text = "") { body += text; },
    json() { return JSON.parse(body); },
  };
};

describe("mission HTTP transfer API", () => {
  it("publishes transfer operation progress without the stored command", () => {
    expect(typeof publicMission).toBe("function");
    expect(publicMission({
      missionId: "transfer-1",
      operationType: "object_transfer",
      status: "running",
      stage: "grasping",
      progress: 36,
      command: { objectId: "demo-box", sceneRevision: "rev", secret: "hidden" },
    })).toMatchObject({
      ok: true,
      missionId: "transfer-1",
      operationType: "object_transfer",
      stage: "grasping",
      progress: 36,
    });
    expect(publicMission({missionId:"transfer-1",command:{}})).not.toHaveProperty("command");
  });

  it("routes resume requests to the mission service", async () => {
    const mission={missionId:"transfer-1",operationType:"object_transfer",status:"holding_for_recovery",command:{sceneRevision:"rev"}};
    const missionService={resume:vi.fn(async()=>mission)};
    const handler=createMissionHttpHandler({missionService,getStatus:()=>({})});
    const response=createResponse();
    await handler({method:"POST",url:"/api/missions/transfer-1/resume",headers:{}},response);
    expect(missionService.resume).toHaveBeenCalledWith("transfer-1");
    expect(response.statusCode).toBe(202);
  });
});

it("publishes measured manipulator diagnostics", () => {
  const manipulator={jointPositions:[0,1,2,3,4],sensorValidity:true};
  expect(publicMission({missionId:"transfer",manipulator})).toHaveProperty("manipulator",manipulator);
});
it("publishes the controller recovery epoch separately from backend recovery count", () => {
  expect(publicMission({missionId:"held",recoveryEpoch:3,controllerRecoveryEpoch:7})).toMatchObject({recoveryEpoch:3,controllerRecoveryEpoch:7});
});
