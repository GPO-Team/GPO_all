import { describe, expect, it } from "vitest";
import { dragRuntimeObstacle, getObstacleDragMode, normalizeRuntimeObstacle } from "./runtimeObstacles";

const obstacle = { x: 2, y: 3, sizeX: 1, sizeY: 0.6, height: 0.8 };
describe("obstacle editing", () => {
  it("moves the center without resizing", () => {
    expect(dragRuntimeObstacle(obstacle, { x: 2, y: 3 }, { x: 5, y: 2 }, "move"))
      .toEqual({ ...obstacle, x: 5, y: 2 });
  });
  it("resizes from the bottom-right corner while preserving the opposite corner", () => {
    const result = dragRuntimeObstacle(obstacle, { x: 2.5, y: 2.7 }, { x: 3.5, y: 2.2 }, "resize");
    expect(result.sizeX).toBe(2);
    expect(result.sizeY).toBe(1.1);
    expect(result.x - result.sizeX / 2).toBe(1.5);
    expect(result.y + result.sizeY / 2).toBe(3.3);
    expect(result.height).toBe(0.8);
  });
  it("restricts dimensions and keeps the entire footprint inside the map", () => {
    const result = normalizeRuntimeObstacle({ x: 22, y: -17, sizeX: 9, sizeY: 9, height: 9 });
    expect(result).toEqual({ x: 20.25, y: -15.25, sizeX: 3.5, sizeY: 3.5, height: 2.8 });
    expect(() => normalizeRuntimeObstacle({ ...obstacle, sizeX: "" })).toThrow();
  });
  it("distinguishes the resize handle, footprint, and empty map", () => {
    expect(getObstacleDragMode(obstacle, { x: 2.5, y: 2.7 }, 0.05)).toBe("resize");
    expect(getObstacleDragMode(obstacle, { x: 2, y: 3 }, 0.05)).toBe("move");
    expect(getObstacleDragMode(obstacle, { x: 0, y: 0 }, 0.05)).toBeNull();
  });
});
