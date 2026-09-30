import { useDashboardPlannerEditors } from "./useDashboardPlannerEditors";
import { useDashboardPlannerRouteLifecycle } from "./useDashboardPlannerRouteLifecycle";
import { useDashboardPlannerRuntimeActions } from "./useDashboardPlannerRuntimeActions";
import { usePlannerRouteSelection } from "./usePlannerRouteSelection";

export const useDashboardPlannerActions = (state, runtime, derived) => {
  const { algorithm, canvas, energy, interaction, limits, mapping, route, surfaces } = state;
  const { plannerModel, syncPayloads, viewModel } = derived;
  const routeLifecycle = useDashboardPlannerRouteLifecycle({
    plannerModel,
    optimizedRoute: route.optimizedRoute,
    onMissionSubmitted: runtime.mission?.track,
    isOptimizing: route.isOptimizing,
    resetRouteTiming: runtime.routeTiming.reset,
    setActiveLimitZoneId: limits.setActiveLimitZoneId,
    setActivePointKind: interaction.setActivePointKind,
    setActiveSurfaceProfileKey: surfaces.setActiveSurfaceProfileKey,
    setActiveSurfaceZoneId: surfaces.setActiveSurfaceZoneId,
    setAlgorithmKey: algorithm.setAlgorithmKey,
    setEnergyWarning: route.setEnergyWarning,
    setExpandedPoint: interaction.setExpandedPoint,
    setHoveredPointIndex: interaction.setHoveredPointIndex,
    setLimitZones: limits.setLimitZones,
    setIsOptimizing: route.setIsOptimizing,
    setNextSurfaceZoneNumber: surfaces.setNextSurfaceZoneNumber,
    setNextZoneNumber: limits.setNextZoneNumber,
    setOptimizedRoute: route.setOptimizedRoute,
    setPoints: route.setPoints,
    setRouteEnergyStats: energy.setRouteEnergyStats,
    setRouteSeed: route.setRouteSeed,
    setRouteTaskKey: algorithm.setRouteTaskKey,
    setStatus: route.setStatus,
    setSurfaceZones: surfaces.setSurfaceZones,
    algorithmKey: algorithm.algorithmKey,
    batteryRangeMeters: energy.batteryRangeMeters,
    chargePointsRoutingText: syncPayloads.chargePointsRoutingText,
    cruiseSpeedMps: energy.cruiseSpeedMps,
    energyOptions: derived.energyOptions,
    payloadKg: energy.payloadKg,
    previewPolygonRoutingText: syncPayloads.previewPolygonRoutingText,
    routeSeed: route.routeSeed,
    routeSocketRef: runtime.routeWsRef,
    routeTaskKey: algorithm.routeTaskKey,
    selectedAlgorithmParams: viewModel.selectedAlgorithmParams,
    startRouteTiming: runtime.routeTiming.start,
    surfaceSyncPayloadText: syncPayloads.surfaceSyncPayloadText,
    surfaceZones: plannerModel.surfaceZones,
    telemetry: runtime.telemetry,
    zoneSyncPayloadText: syncPayloads.zoneSyncPayloadText,
  });

  const routeSelection = usePlannerRouteSelection({
    algorithmKey: algorithm.algorithmKey,
    resetRouteTiming: runtime.routeTiming.reset,
    setAlgorithmKey: algorithm.setAlgorithmKey,
    setAlgorithmParams: algorithm.setAlgorithmParams,
    setEnergyWarning: route.setEnergyWarning,
    setExpandedPoint: interaction.setExpandedPoint,
    setHoveredPointIndex: interaction.setHoveredPointIndex,
    setOptimizedRoute: route.setOptimizedRoute,
    setRouteEnergyStats: energy.setRouteEnergyStats,
    setRouteSeed: route.setRouteSeed,
    setRouteTaskKey: algorithm.setRouteTaskKey,
    setStatus: route.setStatus,
  });

  const editors = useDashboardPlannerEditors({
    activeLimitZoneId: limits.activeLimitZoneId,
    activePointKind: interaction.activePointKind,
    activeSurfaceProfileKey: surfaces.activeSurfaceProfileKey,
    activeSurfaceZone: viewModel.activeSurfaceZone,
    activeSurfaceZoneId: surfaces.activeSurfaceZoneId,
    canvasRef: canvas.canvasRef,
    clearRouteState: routeSelection.clearRouteState,
    limitZones: limits.limitZones,
    nextSurfaceZoneNumber: surfaces.nextSurfaceZoneNumber,
    nextZoneNumber: limits.nextZoneNumber,
    plannerModel,
    points: route.points,
    setActiveLimitZoneId: limits.setActiveLimitZoneId,
    setActivePointKind: interaction.setActivePointKind,
    setActiveSurfaceProfileKey: surfaces.setActiveSurfaceProfileKey,
    setActiveSurfaceZoneId: surfaces.setActiveSurfaceZoneId,
    setLimitZones: limits.setLimitZones,
    setNextSurfaceZoneNumber: surfaces.setNextSurfaceZoneNumber,
    setNextZoneNumber: limits.setNextZoneNumber,
    setPoints: route.setPoints,
    setStatus: route.setStatus,
    setSurfaceZones: surfaces.setSurfaceZones,
    surfaceZones: surfaces.surfaceZones,
  });

  const runtimeActions = useDashboardPlannerRuntimeActions({
    onMissionSubmitted: runtime.mission?.track,
    batteryRangeMeters: energy.batteryRangeMeters,
    mappingSurveyMode: mapping.mappingSurveyMode,
    optimizedRoute: route.optimizedRoute,
    payloadKg: energy.payloadKg,
    plannerModel,
    points: route.points,
    routeSocketRef: runtime.routeWsRef,
    setMapExportPromptOpen: interaction.setMapExportPromptOpen,
    setStatus: route.setStatus,
    telemetry: runtime.telemetry,
  });

  return { ...routeLifecycle, ...routeSelection, ...editors, ...runtimeActions };
};
