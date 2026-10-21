import { describe, expect, it } from "vitest";
import {
  appendPlannerPoint,
  findPointIndexAtCanvasPosition,
  movePlannerPoint,
  setVisitPointsKind,
  removePlannerPoint,
  removePlannerPointsByKind,
  updatePlannerPointTask,
} from "./pointEditor";
import { isPointLayerVisible } from "./mapLayers";

describe("planner point editor model", () => {
  it("skips hidden points when selecting overlapping objects", () => {
    const points = [{ x: 1, y: 1, kind: "visit" }, { x: 1, y: 1, kind: "limit" }];
    const index = findPointIndexAtCanvasPosition(points, { x: 1, y: 1 }, point => point, 1,
      point => isPointLayerVisible(point, { zones: false }));
    expect(index).toBe(0);
  });
  it("selects the topmost point inside the drag radius", () => {
    const points = [{ x: 1, y: 1 }, { x: 1.05, y: 1.05 }];
    const index = findPointIndexAtCanvasPosition(
      points,
      { x: 101, y: 101 },
      (point) => ({ x: point.x * 100, y: point.y * 100 }),
      14
    );
    expect(index).toBe(1);
  });

  it("moves one point without changing its metadata", () => {
    const points = [{ x: 1, y: 2, kind: "visit", task: "inspect" }];
    expect(movePlannerPoint(points, 0, { x: 3, y: 4 })).toEqual([
      { x: 3, y: 4, kind: "visit", task: "inspect" },
    ]);
    expect(points[0]).toEqual({ x: 1, y: 2, kind: "visit", task: "inspect" });
  });

  it("adds point metadata according to its kind", () => {
    expect(appendPlannerPoint([], { x: 1, y: 2 }, "limit", "zone-4", "visit")).toEqual([
      { x: 1, y: 2, kind: "limit", zoneId: "zone-4", task: null },
    ]);
    expect(appendPlannerPoint([], { x: 1, y: 2 }, "visit", "zone-4", "inspect")).toEqual([
      { x: 1, y: 2, kind: "visit", zoneId: null, task: "inspect" },
    ]);
  });

  it("removes and updates points immutably", () => {
    const points = [
      { x: 0, y: 0, kind: "visit", task: "visit" },
      { x: 1, y: 1, kind: "charge", task: null },
    ];
    expect(removePlannerPointsByKind(points, "charge")).toEqual([points[0]]);
    expect(removePlannerPoint(points, 0)).toEqual([points[1]]);
    expect(updatePlannerPointTask(points, 0, "inspect")[0].task).toBe("inspect");
    expect(points[0].task).toBe("visit");
  });
});

describe("visit point mode", () => {
  it("converts every visit point and leaves other kinds alone", () => {
    const points = [{ kind: "visit" }, { kind: "free_visit" }, { kind: "charge" }];
    expect(setVisitPointsKind(points, "free_visit").map((point) => point.kind)).toEqual(["free_visit", "free_visit", "charge"]);
    expect(setVisitPointsKind(points, "visit").map((point) => point.kind)).toEqual(["visit", "visit", "charge"]);
    expect(setVisitPointsKind(points, "charge")).toBe(points);
  });
});
