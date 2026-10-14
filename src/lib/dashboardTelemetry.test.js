import { describe, expect, it } from "vitest";
import { createTelemetryEvent } from "../../shared/contracts/index.js";
import {
  decodeWsData,
  INITIAL_TELEMETRY,
  normalizeAngle,
  normalizeTelemetry,
  ROUTE_WS_URL,
  TELEMETRY_WS_URL,
} from "./dashboardTelemetry";

describe("normalizeTelemetry", () => {
  it("preserves the compatibility facade API", () => {
    expect(INITIAL_TELEMETRY).toBeDefined();
    expect(normalizeAngle).toBeTypeOf("function");
    expect(decodeWsData).toBeTypeOf("function");
    expect(ROUTE_WS_URL).toMatch(/^ws:\/\//);
    expect(TELEMETRY_WS_URL).toMatch(/^ws:\/\//);
  });

  it("normalizes pose payloads from the shared coordinate contract", () => {
    const result = normalizeTelemetry({
      type: "telemetry",
      simulationTime: 12.5,
      pose: {
        x: 1.25,
        y: -2.5,
        z: 0.12,
        yaw: 1.57,
      },
      navigation: {
        status: "tracking_path",
        finished: false,
        currentWaypointIndex: 2,
      },
      perception: {
        lidar: {
          enabled: true,
        },
        obstacleTrace: [
          { x: 2, y: 3 },
        ],
      },
    });

    expect(result).toEqual({
      manipulator: null,
      simulationTime: 12.5,
      x: 1.25,
      y: -2.5,
      z: 0.12,
      yaw: 1.57,
      navigation: {
        status: "tracking_path",
        finished: false,
        currentWaypointIndex: 2,
      },
      obstacleTrace: [
        { x: 2, y: 3, confidence: 1 },
      ],
      obstacleMap: {
        cellSize: 0.06,
        cellCount: 0,
        obstacleCellCount: 0,
        freeCellCount: 0,
        mapFile: "obstacle_map.json",
        jsonFile: "obstacle_map.json",
        excelCsvFile: "obstacle_map.csv",
        imageFile: "obstacle_map.png",
        cells: [],
        freeCells: [],
      },
      cameraMap: {
        cellSize: 0.1,
        cellCount: 0,
        obstacleCellCount: 0,
        freeCellCount: 0,
        mapFile: "camera_map.json",
        jsonFile: "camera_map.json",
        excelCsvFile: "camera_map.csv",
        imageFile: "camera_map.png",
        cells: [],
        freeCells: [],
      },
      perception: {
        lidar: {
          enabled: true,
        },
        camera: null,
      },
    });
  });

  it("falls back to previous z/yaw values when the message omits them", () => {
    const result = normalizeTelemetry(
      {
        type: "telemetry",
        pose: {
          x: 3,
          y: 4,
        },
      },
      { x: 0, y: 0, z: 0.5, yaw: 0.75 }
    );

    expect(result).toEqual({
      manipulator: null,
      simulationTime: null,
      x: 3,
      y: 4,
      z: 0.5,
      yaw: 0.75,
      navigation: {
        status: "",
        finished: false,
        currentWaypointIndex: 0,
      },
      obstacleTrace: [],
      obstacleMap: {
        cellSize: 0.06,
        cellCount: 0,
        obstacleCellCount: 0,
        freeCellCount: 0,
        mapFile: "obstacle_map.json",
        jsonFile: "obstacle_map.json",
        excelCsvFile: "obstacle_map.csv",
        imageFile: "obstacle_map.png",
        cells: [],
        freeCells: [],
      },
      cameraMap: {
        cellSize: 0.1,
        cellCount: 0,
        obstacleCellCount: 0,
        freeCellCount: 0,
        mapFile: "camera_map.json",
        jsonFile: "camera_map.json",
        excelCsvFile: "camera_map.csv",
        imageFile: "camera_map.png",
        cells: [],
        freeCells: [],
      },
      perception: {
        lidar: null,
        camera: null,
      },
    });
  });

  it("keeps the latest camera frame when metadata-only messages arrive", () => {
    const first = normalizeTelemetry({
      type: "telemetry",
      pose: { x: 1, y: 2 },
      perception: {
        camera: {
          enabled: true,
          width: 320,
          height: 180,
          frameSequence: 4,
          frameDataUrl: "data:image/jpeg;base64,abc",
        },
      },
    });
    const second = normalizeTelemetry(
      {
        type: "telemetry",
        pose: { x: 2, y: 3 },
        perception: {
          camera: {
            enabled: true,
            width: 320,
            height: 180,
            frameSequence: 5,
          },
        },
      },
      first
    );

    expect(second?.perception.camera).toMatchObject({
      enabled: true,
      width: 320,
      height: 180,
      frameSequence: 5,
      frameDataUrl: "data:image/jpeg;base64,abc",
    });
  });

  it("normalizes obstacle map payloads with cells and metadata", () => {
    const result = normalizeTelemetry({
      type: "telemetry",
      pose: {
        x: 0,
        y: 0,
      },
      obstacleMap: {
        cellSize: 0.08,
        cellCount: 2,
        imageFile: "custom-map.png",
        cells: [
          { x: 1, y: 2, confidence: 4 },
          { x: -1.5, y: 0.5, confidence: 1 },
        ],
      },
    });

    expect(result?.obstacleMap).toEqual({
      cellSize: 0.08,
      cellCount: 2,
      obstacleCellCount: 2,
      freeCellCount: 0,
      mapFile: "obstacle_map.json",
      jsonFile: "obstacle_map.json",
      excelCsvFile: "obstacle_map.csv",
      imageFile: "custom-map.png",
      cells: [
        { x: 1, y: 2, confidence: 4 },
        { x: -1.5, y: 0.5, confidence: 1 },
      ],
      freeCells: [],
    });
  });

  it("normalizes camera map free cells and camera detection metadata", () => {
    const result = normalizeTelemetry({
      type: "telemetry",
      pose: {
        x: 0,
        y: 0,
      },
      perception: {
        camera: {
          enabled: true,
          obstacleVisible: true,
          obstacleAngle: 0.12,
          obstacleRange: 1.4,
          detectionCount: 9,
        },
      },
      cameraMap: {
        cellSize: 0.1,
        totalCells: 3,
        obstacleCellCount: 1,
        freeCellCount: 2,
        cells: [
          { x: 1, y: 2, confidence: 5 },
        ],
        freeCells: [
          { x: 0.2, y: 0.4, confidence: 2 },
          { x: 0.4, y: 0.8, confidence: 3 },
        ],
      },
    });

    expect(result?.cameraMap).toMatchObject({
      cellCount: 3,
      obstacleCellCount: 1,
      freeCellCount: 2,
      cells: [
        { x: 1, y: 2, confidence: 5 },
      ],
      freeCells: [
        { x: 0.2, y: 0.4, confidence: 2 },
        { x: 0.4, y: 0.8, confidence: 3 },
      ],
    });
    expect(result?.perception.camera).toMatchObject({
      obstacleVisible: true,
      obstacleAngle: 0.12,
      obstacleRange: 1.4,
      detectionCount: 9,
    });
  });

  it("ignores payloads with a different message type", () => {
    expect(normalizeTelemetry({ type: "route", pose: { x: 1, y: 2 } })).toBeNull();
  });

  it("accepts a telemetry event while retaining the legacy dashboard shape", () => {
    const event = createTelemetryEvent({
      source: "telemetry-service",
      requestId: "telemetry-2",
      timestamp: "2026-01-01T00:00:04.000Z",
      payload: { type: "telemetry", pose: { x: 4, y: 5, z: 0, yaw: 0 } },
    });

    expect(normalizeTelemetry(event)).toMatchObject({ x: 4, y: 5, z: 0, yaw: 0 });
  });
});
