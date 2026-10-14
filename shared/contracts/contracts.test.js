import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSION,
  createContractEnvelope,
  createRouteCommand,
  createTelemetryEvent,
  createMotionCommand,
  createPlanningRequest,
  createPlanningResult,
  createRobotState,
  createSensorFrame,
  createServiceError,
  unwrapMotionCommand,
  unwrapPlanningRequest,
  unwrapPlanningResult,
  unwrapTelemetryEvent,
  unwrapRouteCommand,
  unwrapRobotState,
  unwrapSensorFrame,
  unwrapServiceError,
  validateContractEnvelope,
  validatePayload,
} from "./index.js";

describe("shared service contracts", () => {
  it("creates a versioned route command envelope", () => {
    const envelope = createContractEnvelope({
      type: "route.command",
      source: "frontend",
      requestId: "route-42",
      timestamp: "2026-01-01T00:00:00.000Z",
      payload: { route: [{ x: 1, y: 2 }] },
    });

    expect(envelope).toEqual({
      contractVersion: CONTRACT_VERSION,
      type: "route.command",
      source: "frontend",
      requestId: "route-42",
      timestamp: "2026-01-01T00:00:00.000Z",
      payload: { route: [{ x: 1, y: 2 }] },
    });
  });

  it("rejects envelopes with an unsupported version or missing identity", () => {
    expect(validateContractEnvelope({ contractVersion: 99 })).toEqual({
      valid: false,
      error: "unsupported_contract_version",
    });
    expect(validateContractEnvelope({ contractVersion: CONTRACT_VERSION })).toEqual({
      valid: false,
      error: "invalid_contract_envelope",
    });
  });

  it("keeps the legacy route payload at the Gateway adapter boundary", () => {
    const payload = { type: "route", route: [{ x: 1, y: 2 }] };
    const command = createRouteCommand({
      source: "frontend",
      requestId: "route-43",
      timestamp: "2026-01-01T00:00:01.000Z",
      payload,
    });

    expect(command.type).toBe("route.command");
    expect(unwrapRouteCommand(command)).toEqual(payload);
    expect(unwrapRouteCommand(payload)).toBeNull();
  });

  it("keeps an object transfer payload inside the route command transport envelope", () => {
    const payload = {
      type: "transfer_object",
      objectId: "demo-box",
      destination: { x: 4, y: -2 },
      scene: { polygons: [], surfaceZones: [], chargingStations: [], motion: {} },
      sceneRevision: "revision-1",
    };
    const command = createRouteCommand({
      source: "frontend",
      requestId: "transfer-1",
      timestamp: "2026-01-01T00:00:02.000Z",
      payload,
    });

    expect(unwrapRouteCommand(command)).toEqual(payload);
  });

  it("keeps a telemetry state inside a versioned event", () => {
    const state = { type: "telemetry", pose: { x: 1, y: 2, z: 0, yaw: 0.5 } };
    const event = createTelemetryEvent({
      source: "webots-adapter",
      requestId: "telemetry-1",
      timestamp: "2026-01-01T00:00:03.000Z",
      payload: state,
    });

    expect(event.type).toBe("telemetry.event");
    expect(unwrapTelemetryEvent(event)).toEqual(state);
    expect(unwrapTelemetryEvent(state)).toBeNull();
  });

  it("creates a motion command for the Webots adapter", () => {
    const command = createMotionCommand({
      source: "robot-control",
      requestId: "motion-1",
      timestamp: "2026-01-01T00:00:05.000Z",
      payload: { linearSpeed: 0.2, angularSpeed: -0.3 },
    });

    expect(command.type).toBe("motion.command");
    expect(unwrapMotionCommand(command)).toEqual({ linearSpeed: 0.2, angularSpeed: -0.3 });
  });

  it("creates matched planning request and result contracts", () => {
    const request = createPlanningRequest({
      source: "gateway",
      requestId: "planning-1",
      timestamp: "2026-01-01T00:00:06.000Z",
      payload: { points: [{ x: 0, y: 0 }] },
    });
    const result = createPlanningResult({
      source: "planning-service",
      requestId: "planning-1",
      timestamp: "2026-01-01T00:00:07.000Z",
      payload: { route: [{ x: 0, y: 0 }] },
    });

    expect(request.type).toBe("planning.request");
    expect(result.type).toBe("planning.result");
    expect(result.requestId).toBe(request.requestId);
    expect(unwrapPlanningRequest(request)).toEqual({ points: [{ x: 0, y: 0 }] });
    expect(unwrapPlanningResult(result)).toEqual({ route: [{ x: 0, y: 0 }] });
  });

  it("rejects malformed typed payloads", () => {
    expect(validatePayload("motion.command", { linearSpeed: 0.2 })).toEqual({
      valid: false,
      error: "invalid_motion_command",
    });
    expect(validateContractEnvelope({
      contractVersion: CONTRACT_VERSION,
      type: "service.error",
      source: "gateway",
      requestId: "error-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      payload: {},
    })).toEqual({ valid: false, error: "invalid_service_error" });
  });

  it("round-trips robot-control contracts through typed envelopes", () => {
    const options = { source: "webots-adapter", requestId: "frame-1", timestamp: "2026-01-01T00:00:08.000Z" };
    const frame = createSensorFrame({ ...options, payload: { pose: { x: 1, y: 2 } } });
    const state = createRobotState({ ...options, payload: { pose: { x: 1, y: 2 } } });
    const error = createServiceError({ ...options, payload: { code: "unavailable" } });
    expect(unwrapSensorFrame(frame)).toEqual(frame.payload);
    expect(unwrapRobotState(state)).toEqual(state.payload);
    expect(unwrapServiceError(error)).toEqual(error.payload);
  });
});
