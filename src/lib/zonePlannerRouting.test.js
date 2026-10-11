import { describe, expect, it } from "vitest";
import { routeCrossesAnyLimitPolygon } from "./zonePlannerPolygons";
import { buildObstacleAwareRoute } from "./zonePlannerRouting";

describe("zone planner routing", () => {
  it("keeps a numbered visit that requires reversing direction", () => {
    const route = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }];
    const distantPolygon = [{ points: [{ x: -8, y: -8 }, { x: -6, y: -8 }, { x: -6, y: -6 }, { x: -8, y: -6 }] }];
    expect(buildObstacleAwareRoute(route, distantPolygon)).toEqual(route);
  });
  it("preserves a route when there are no limiting polygons", () => {
    const route = [{ x: -2, y: 0 }, { x: 2, y: 0 }];
    expect(buildObstacleAwareRoute(route, [])).toEqual(route);
  });

  it("builds a safe detour around a limiting polygon", () => {
    const polygons = [{
      id: "zone-1",
      points: [
        { x: -1, y: -1 }, { x: 1, y: -1 },
        { x: 1, y: 1 }, { x: -1, y: 1 },
      ],
    }];
    const result = buildObstacleAwareRoute(
      [{ x: -3, y: 0 }, { x: 3, y: 0 }],
      polygons
    );
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThan(2);
    expect(routeCrossesAnyLimitPolygon(result, polygons)).toBe(false);
  });
});
