import { describe, expect, it, vi } from "vitest";
import { renderPlannerLidarTrace, renderPlannerRouteLayer } from "./plannerCanvasRouteRenderer";

describe("planner canvas route renderer", () => {
  it("renders obstacle trace and a blocked route", () => {
    const ctx = { arc: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn() };

    renderPlannerLidarTrace(ctx, [{ x: 0, y: 0, confidence: 0.5 }]);
    renderPlannerRouteLayer(ctx, {
      obstacleTrace: [{ x: 0, y: 0, confidence: 0.5 }],
      optimizedRoute: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      routeBlocked: true,
    });

    expect(ctx.arc).toHaveBeenCalledOnce();
    expect(ctx.strokeStyle).toBe("#dc2626");
    expect(ctx.lineTo).toHaveBeenCalledOnce();
  });
});
