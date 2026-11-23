import { describe, expect, it, vi } from "vitest";
import { renderPlannerZoneLayer } from "./plannerCanvasZoneRenderer";

describe("planner canvas zone renderer", () => {
  it("draws closed zone edges, points, and a label", () => {
    const ctx = {
      beginPath: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillText: vi.fn(), lineTo: vi.fn(),
      save: vi.fn(), restore: vi.fn(), clip: vi.fn(), arc: vi.fn(),
      moveTo: vi.fn(), setLineDash: vi.fn(), stroke: vi.fn(),
    };

    renderPlannerZoneLayer(ctx, [{
      name: "No-go", zoneIndex: 0, closed: true,
      color: { stroke: "#111", fill: "#222" },
      points: [
        { order: 1, point: { x: 0, y: 0 } },
        { order: 2, point: { x: 1, y: 0 } },
        { order: 3, point: { x: 0, y: 1 } },
      ],
    }]);

    expect(ctx.clip).toHaveBeenCalledOnce();
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    expect(ctx.fillText).toHaveBeenCalledWith("No-go (замкнута)", expect.any(Number), expect.any(Number));
  });
});
