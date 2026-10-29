import { describe, expect, it, vi } from "vitest";
import { renderPlannerPointLayer, renderPlannerRobot } from "./plannerCanvasPointRenderer";

describe("planner canvas point renderer", () => {
  it("renders charge and visit points with the robot marker", () => {
    const ctx = {
      arc: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), fillText: vi.fn(), lineTo: vi.fn(),
      moveTo: vi.fn(), setLineDash: vi.fn(), stroke: vi.fn(), strokeText: vi.fn(),
    };

    renderPlannerPointLayer(ctx, {
      visitEntries: [{ index: 1, order: 1, point: { x: 0, y: 0 } }],
      chargeEntries: [{ index: 2, order: 1, point: { x: 1, y: 1 } }],
      plannedVisitEntryMap: new Map(),
      hoveredPointIndex: null,
    }, { x: 0, y: 0, yaw: 0 });

    expect(ctx.fillText).toHaveBeenCalledWith("C1", expect.any(Number), expect.any(Number));
    expect(ctx.strokeText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    renderPlannerRobot(ctx, { viewScale: 4 }, { x: 0, y: 0, yaw: 0 });
    expect(ctx.arc).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 11, 0, Math.PI * 2);
    expect(ctx.lineWidth).toBe(4);
  });
});
