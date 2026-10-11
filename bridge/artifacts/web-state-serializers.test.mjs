import { describe, expect, it } from "vitest";
import serializersModule from "./web-state-serializers.cjs";

const { createMotionProfileText, createRuntimeCommandText } = serializersModule;

describe("web state serializers", () => {
  it("keeps the obstacle identity distinct from the command sequence", () => {
    const obstacle = { x: 2, y: 3, sizeX: 1.2, sizeY: 0.7, height: 0.8 };
    expect(createRuntimeCommandText({ type: "spawn_random_obstacle", commandId: 101, obstacleId: 42, obstacle })).toContain("obstacle_id 42\n");
    expect(createRuntimeCommandText({ type: "update_runtime_obstacle", commandId: 102, obstacleId: 42, obstacle }))
      .toBe("id 102\ntype update_obstacle\nobstacle_id 42\nx 2\ny 3\nsize_x 1.2\nsize_y 0.7\nheight 0.8\n");
    expect(createRuntimeCommandText({ type: "delete_runtime_obstacle", commandId: 103, obstacleId: 42 }))
      .toBe("id 103\ntype delete_obstacle\nobstacle_id 42\n");
  });
  it.each([
    { obstacleId: -1 }, { obstacleId: 2, obstacle: { x: NaN, y: 0, sizeX: 1, sizeY: 1, height: 1 } },
    { obstacleId: 2, obstacle: { x: 21, y: 0, sizeX: 3.5, sizeY: 1, height: 1 } },
  ])("rejects invalid obstacle mutations before serialization: %o", (payload) => {
    expect(() => createRuntimeCommandText({ type: "update_runtime_obstacle", commandId: 3, ...payload })).toThrow();
  });
  it("serializes a sanitized motion profile into the controller format", () => {
    expect(createMotionProfileText({ cruiseSpeedMps: 0.3, payloadKg: 5, batteryRange: 100 }))
      .toBe("cruise_speed_mps 0.3\npayload_kg 5\nbattery_range 100\n");
  });

  it("serializes a bounded obstacle command", () => {
    expect(createRuntimeCommandText({
      type: "spawn_random_obstacle",
      commandId: 10,
      obstacle: { x: 500, y: -500, sizeX: 100, sizeY: 0, height: 20 },
    })).toContain("x 21.5");
  });

  it.each([
    ["transfer_object", "type transfer_object"],
    ["recover_transfer", "type recover_transfer"],
    ["resume_transfer", "type resume_transfer"],
  ])("serializes %s with its original mission identity", (type, marker) => {
    const text=createRuntimeCommandText({type,commandId:12,missionId:"transfer-1",objectId:"demo-box",destination:{x:4,y:-2},sceneRevision:"rev-1"});
    expect(text).toContain(marker);
    expect(text).toContain("mission_id transfer-1");
    expect(text).toContain("destination_x 4");
    expect(text).toContain("scene_revision rev-1");
  });
});
