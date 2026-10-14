import { describe, expect, it, vi } from "vitest";
import { SCALE, worldToCanvas } from "../../../lib/zonePlannerCoordinates";
import { renderPlannerRuntimeObstacles } from "./plannerCanvasObstacleRenderer";

describe("physical obstacle footprint", () => {
  it.each([0.5, 2])("keeps real dimensions at viewport scale %s", (scale) => {
    const ctx = { setLineDash: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn() };
    const obstacle = { x: 4, y: -2, sizeX: 0.7, sizeY: 1.1, status: "accepted" };
    renderPlannerRuntimeObstacles(ctx, [obstacle], scale);
    const corner = worldToCanvas(4 - 0.35, -2 + 0.55);
    expect(ctx.strokeRect).toHaveBeenCalledWith(corner.x, corner.y, 0.7 * SCALE, 1.1 * SCALE);
    expect(ctx.lineWidth).toBe(1.5 / scale);
  });
  it("does not draw a rejected spawn request as a physical object", () => {
    const ctx = { fillRect: vi.fn() };
    renderPlannerRuntimeObstacles(ctx, [{ status: "error" }]);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
