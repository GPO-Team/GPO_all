import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useDashboardPlannerState } from "./useDashboardPlannerState";
import { useDashboardPlannerDerivedState } from "./useDashboardPlannerDerivedState";
import { useDashboardPlannerActions } from "./useDashboardPlannerActions";
import { INITIAL_TELEMETRY } from "../../../lib/telemetry/dashboardTelemetryState";

describe("assembled planner actions", () => {
  it("handles build and send on an empty plan without missing dependencies", async () => {
    const captured = [];
    const status = vi.fn();
    function Harness() {
      const original = useDashboardPlannerState();
      const state = { ...original, route: { ...original.route, setStatus: status } };
      const runtime = { telemetry: INITIAL_TELEMETRY, routeWsRef: { current: null },
        routeTiming: { reset: vi.fn(), start: vi.fn(), display: {} } };
      const derived = useDashboardPlannerDerivedState(state, runtime);
      const actions = useDashboardPlannerActions(state, runtime, derived);
      captured.push(actions);
      return null;
    }
    renderToString(<Harness />);
    const [actions] = captured;
    expect(actions.runtimeObstacles).toEqual([]);
    expect(actions.activeRuntimeObstacleId).toBeNull();
    await expect(actions.optimizeRoute()).resolves.toBeUndefined();
    expect(() => actions.sendRoute()).not.toThrow();
    expect(status).toHaveBeenCalledWith("Сначала постройте маршрут.");
  });
});
