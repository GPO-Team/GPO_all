import { describe, expect, it, vi } from "vitest";
import { renderPlannerSensorLayers } from "./plannerCanvasSensorRenderer";

describe("planner canvas sensor renderer", () => {
  it("renders accumulated lidar surfaces and camera obstacles as small turquoise and violet dots", () => {
    const fillStyles = [];
    const ctx = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
    };
    Object.defineProperty(ctx, "fillStyle", {
      set: (value) => { fillStyles.push(value); },
    });

    renderPlannerSensorLayers(ctx, {
      obstacleMap: { cellSize: 0.1, cells: [{ x: 0, y: 0, confidence: 1 }] },
      cameraMap: {
        cellSize: 0.1,
        freeCells: [{ x: 1, y: 1, confidence: 1 }, { x: 1.5, y: 1.5, confidence: 1 }],
        cells: [{ x: 2, y: 2, confidence: 1 }],
      },
    });

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.arc.mock.calls.map(([, , radius]) => radius)).toEqual([1.25, 1.6]);
    expect(fillStyles.some((color) => color.includes("45, 212, 191"))).toBe(true);
    expect(fillStyles.some((color) => color.includes("168, 85, 247"))).toBe(true);
  });
});
