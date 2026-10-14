import { describe, expect, it, vi } from "vitest";
import { renderPlannerSensorLayers } from "./plannerCanvasSensorRenderer";

describe("planner canvas sensor renderer", () => {
  it("hides lidar and turquoise free-space cells while retaining camera obstacles", () => {
    const ctx = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
    };

    renderPlannerSensorLayers(ctx, {
      obstacleMap: { cellSize: 0.1, cells: [{ x: 0, y: 0, confidence: 1 }] },
      cameraMap: {
        cellSize: 0.1,
        freeCells: [{ x: 1, y: 1, confidence: 1 }],
        cells: [{ x: 2, y: 2, confidence: 1 }],
      },
    });

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledOnce();
  });
});
