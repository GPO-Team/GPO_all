// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDashboardPlannerDerivedState } from "./useDashboardPlannerDerivedState";

vi.mock("./usePlannerBridgeSync", () => ({ usePlannerBridgeSync: vi.fn() }));
vi.mock("./useDashboardPlannerPresentation", () => ({
  useDashboardPlannerPresentation: () => ({}),
}));

let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

it("automatically projects a visit point outside a forbidden zone", async () => {
  const state = {
    algorithm: { algorithmKey: "ga_tabu", algorithmParams: {} },
    energy: { batteryRangeMeters: 100, cruiseSpeedMps: 0.2, payloadKg: 0 },
    limits: { activeLimitZoneId: "zone-1", limitZones: [{ id: "zone-1", name: "Стеллаж", closed: true }] },
    route: {
      isSubmitting: false,
      optimizedRoute: [],
      points: [
        { kind: "limit", zoneId: "zone-1", x: -1, y: -1 },
        { kind: "limit", zoneId: "zone-1", x: 1, y: -1 },
        { kind: "limit", zoneId: "zone-1", x: 1, y: 1 },
        { kind: "limit", zoneId: "zone-1", x: -1, y: 1 },
        { kind: "visit", x: 0, y: 0 },
      ],
      setStatus: vi.fn(),
    },
    surfaces: { activeSurfaceZoneId: null, surfaceZones: [] },
  };
  const runtime = {
    mission: { state: null },
    routeTiming: { display: {}, avoidanceTimeSec: 0, offRouteActive: false },
    routeWsRef: { current: null },
    routeWsUp: false,
    telemetry: {},
  };
  let derived;
  function Harness() {
    const value = useDashboardPlannerDerivedState(state, runtime);
    React.useEffect(() => { derived = value; }, [value]);
    return null;
  }

  await act(async () => root.render(<Harness />));

  expect(derived.plannerModel.adjustedVisits).toHaveLength(1);
  expect(derived.plannerModel.visitPoints[0]).not.toEqual({ x: 0, y: 0 });
});
