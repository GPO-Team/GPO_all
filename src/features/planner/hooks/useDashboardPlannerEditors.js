import { usePlannerLimitZoneEditor } from "./usePlannerLimitZoneEditor";
import { usePlannerPointEditor } from "./usePlannerPointEditor";
import { usePlannerSurfaceZoneEditor } from "./usePlannerSurfaceZoneEditor";

export const useDashboardPlannerEditors = (input) => {
  const limit = usePlannerLimitZoneEditor({
    activeLimitZoneId: input.activeLimitZoneId, clearRouteState: input.clearRouteState,
    limitZones: input.limitZones, nextZoneNumber: input.nextZoneNumber, points: input.points,
    setActiveLimitZoneId: input.setActiveLimitZoneId, setActivePointKind: input.setActivePointKind,
    setLimitZones: input.setLimitZones, setNextZoneNumber: input.setNextZoneNumber,
    setPoints: input.setPoints, setStatus: input.setStatus, zoneEntries: input.plannerModel.zoneEntries,
  });
  const surface = usePlannerSurfaceZoneEditor({
    activeSurfaceProfileKey: input.activeSurfaceProfileKey, activeSurfaceZoneId: input.activeSurfaceZoneId,
    clearRouteState: input.clearRouteState, nextSurfaceZoneNumber: input.nextSurfaceZoneNumber,
    setActivePointKind: input.setActivePointKind, setActiveSurfaceProfileKey: input.setActiveSurfaceProfileKey,
    setActiveSurfaceZoneId: input.setActiveSurfaceZoneId, setNextSurfaceZoneNumber: input.setNextSurfaceZoneNumber,
    setStatus: input.setStatus, setSurfaceZones: input.setSurfaceZones, surfaceZones: input.surfaceZones,
  });
  const points = usePlannerPointEditor({
    isEditingLocked:input.isEditingLocked,
    activeLimitZoneId: input.activeLimitZoneId, activePointKind: input.activePointKind,
    activeSurfaceProfileKey: input.activeSurfaceProfileKey, activeSurfaceZone: input.activeSurfaceZone,
    activeZone: input.plannerModel.activeZone, activeZoneName: input.plannerModel.activeZoneName,
    canvasRef: input.canvasRef, clearRouteState: input.clearRouteState, points: input.points,
    resetZones: limit.resetZones, setPoints: input.setPoints, setStatus: input.setStatus,
    setSurfaceZones: input.setSurfaceZones,
    mapLayers: input.mapLayers, setMapLayerVisible: input.setMapLayerVisible,
  });
  return { ...limit, ...surface, ...points };
};
