import { describe, expect, it } from "vitest";
import coordinateContract from "../../shared/coordinate-contract.json" with { type: "json" };
import normalizerModule from "./normalizer.cjs";

const { createTelemetryNormalizer, resolveCameraFrameMimeType } = normalizerModule;
const normalizeTelemetry = createTelemetryNormalizer(coordinateContract);

describe("bridge telemetry normalizer", () => {
  it("normalizes pose and perception using the coordinate contract", () => {
    const telemetry = normalizeTelemetry({
      pose: { x: 1, y: 2, z: 0.5, yaw: 0.25 },
      navigation: { status: "moving" },
      perception: {
        lidar: { ranges: [1, 2] },
        obstacleTrace: [{ x: 3, y: 4, confidence: 5 }],
      },
    });

    expect(telemetry).toMatchObject({
      type: coordinateContract.telemetry.messageType,
      pose: { x: 1, y: 2, z: 0.5, yaw: 0.25 },
      navigation: { status: "moving" },
    });
    expect(telemetry.obstacleTrace[0].confidence).toBe(1);
  });

  it("rejects telemetry without a complete finite pose", () => {
    expect(normalizeTelemetry({ pose: { x: 1, y: "bad", yaw: 0 } })).toBeNull();
  });

  it("normalizes map cells and camera metadata", () => {
    const telemetry = normalizeTelemetry(
      {
        pose: { x: 0, y: 0, z: 0, yaw: 0 },
        camera: { enabled: true, frameFile: "folder/frame.png", width: 320 },
      },
      { cellSize: 0.1, cells: [{ x: 1, y: 2, confidence: 0.7 }] }
    );

    expect(telemetry.obstacleMap.cells).toEqual([{ x: 1, y: 2, confidence: 0.7 }]);
    expect(telemetry.camera).toMatchObject({
      frameFile: "frame.png",
      mimeType: "image/png",
      width: 320,
    });
    expect(resolveCameraFrameMimeType("frame.bmp")).toBe("image/bmp");
  });
});

it("preserves object transfer measured diagnostics", () => {
 const objectTransfer={missionId:"transfer",status:"running",manipulator:{jointPositions:[0,1,2,3,4]}};
 expect(normalizeTelemetry({pose:{x:0,y:0,z:0,yaw:0},objectTransfer}).objectTransfer).toEqual(objectTransfer);
});
