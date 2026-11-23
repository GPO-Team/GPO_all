import { describe, expect, it } from "vitest";
import { createPlannerCanvasDrawState, findFirstVisitIndex } from "./plannerCanvasDrawState";

describe("planner canvas draw state", () => {
  it("combines planner and telemetry data into a render-safe state", () => {
    const plannerModel = {
      visitEntries: [{ index: 1 }],
      chargeEntries: [{ index: 2 }],
      plannedVisitEntryMap: new Map([[1, { adjusted: true }]]),
      zoneEntries: [{ name: "Restricted" }],
      surfaceZones: [{ name: "Concrete" }],
      routeBlocked: true,
    };

    expect(
      createPlannerCanvasDrawState({
        plannerModel,
        optimizedRoute: [{ x: 1, y: 2 }],
        hoveredPointIndex: 1,
        telemetry: {},
        fallbackObstacleMap: { cells: [{ x: 0, y: 0 }] },
        fallbackCameraMap: { cells: [{ x: 3, y: 4 }] },
      })
    ).toEqual({
      visitEntries: plannerModel.visitEntries,
      chargeEntries: plannerModel.chargeEntries,
      plannedVisitEntryMap: plannerModel.plannedVisitEntryMap,
      zoneEntries: plannerModel.zoneEntries,
      surfaceZones: plannerModel.surfaceZones,
      optimizedRoute: [{ x: 1, y: 2 }],
      obstacleTrace: [],
      obstacleMap: { cells: [{ x: 0, y: 0 }] },
      cameraMap: { cells: [{ x: 3, y: 4 }] },
      routeBlocked: true,
      hoveredPointIndex: 1,
      firstVisitIndex: null,
    });
  });

  it("finds the first visit reached along the route, skipping the robot anchor", () => {
    const visitEntries = [
      { index: 0, point: { x: 1, y: 1 } },
      { index: 3, point: { x: 5, y: 5 } },
    ];
    const plannedVisitEntryMap = new Map([[3, { adjusted: true, plannedPoint: { x: 4, y: 4 } }]]);
    const route = [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 4 }, { x: 1, y: 1 }];

    expect(findFirstVisitIndex(route, visitEntries, plannedVisitEntryMap)).toBe(3);
    expect(findFirstVisitIndex([], visitEntries, plannedVisitEntryMap)).toBeNull();
  });

  it("marks the first visit only when free points take part in the route", () => {
    const visitEntries = [{ index: 0, point: { x: 1, y: 1, kind: "visit" } }];
    const draw = (entries) => createPlannerCanvasDrawState({
      plannerModel: { visitEntries: entries, plannedVisitEntryMap: new Map() },
      optimizedRoute: [{ x: 1, y: 1 }],
      telemetry: {},
    });
    expect(draw(visitEntries).firstVisitIndex).toBeNull();
    expect(draw([...visitEntries, { index: 1, point: { x: 2, y: 2, kind: "free_visit" } }]).firstVisitIndex).toBe(0);
  });
});
