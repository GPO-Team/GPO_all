const ROUTE_POINT_EPSILON = 1e-3;

// Index of the visit entry the robot reaches first along the built route.
export const findFirstVisitIndex = (route, visitEntries, plannedVisitEntryMap) => {
  if (!Array.isArray(route) || !route.length || !visitEntries?.length) return null;
  const targets = visitEntries.map((entry) => ({
    index: entry.index,
    point: plannedVisitEntryMap?.get(entry.index)?.plannedPoint || entry.point,
  })).filter(({ point }) => point);
  for (const routePoint of route) {
    const match = targets.find(({ point }) =>
      Math.abs(point.x - routePoint.x) < ROUTE_POINT_EPSILON && Math.abs(point.y - routePoint.y) < ROUTE_POINT_EPSILON);
    if (match) return match.index;
  }
  return null;
};

export const createPlannerCanvasDrawState = ({
  plannerModel,
  optimizedRoute,
  hoveredPointIndex,
  telemetry,
  fallbackObstacleMap,
  fallbackCameraMap,
  mapLayers,
  runtimeObstacles,
  activeRuntimeObstacleId,
}) => ({
  visitEntries: plannerModel.visitEntries,
  chargeEntries: plannerModel.chargeEntries,
  plannedVisitEntryMap: plannerModel.plannedVisitEntryMap,
  zoneEntries: plannerModel.zoneEntries,
  surfaceZones: plannerModel.surfaceZones,
  optimizedRoute,
  obstacleTrace: telemetry.obstacleTrace || [],
  obstacleMap: telemetry.obstacleMap || fallbackObstacleMap,
  cameraMap: telemetry.cameraMap || fallbackCameraMap,
  routeBlocked: plannerModel.routeBlocked,
  hoveredPointIndex,
  firstVisitIndex: plannerModel.visitEntries?.some((entry) => entry.point?.kind === "free_visit")
    ? findFirstVisitIndex(optimizedRoute, plannerModel.visitEntries, plannerModel.plannedVisitEntryMap)
    : null,
  ...(mapLayers ? { mapLayers } : {}),
  ...(runtimeObstacles ? { runtimeObstacles } : {}),
  ...(activeRuntimeObstacleId ? { activeRuntimeObstacleId } : {}),
});
