import { useDashboardPlannerEditors } from "./useDashboardPlannerEditors";
import { useDashboardPlannerRouteLifecycle } from "./useDashboardPlannerRouteLifecycle";
import { useDashboardPlannerRuntimeActions } from "./useDashboardPlannerRuntimeActions";
import { usePlannerRouteSelection } from "./usePlannerRouteSelection";
import { useEffect, useLayoutEffect } from "react";
import { downloadGraphCsv } from "../model/graphExport";
import { setVisitPointsKind } from "../model/pointEditor";

export const useDashboardPlannerActions = (state, runtime, derived) => {
  const {
    algorithm,
    canvas,
    energy,
    interaction,
    limits,
    mapping,
    route,
    surfaces,
  } = state;
  const { plannerModel, syncPayloads, viewModel } = derived;
  const mission = runtime.mission?.state;
  const missionActive = Boolean(
    mission?.status &&
    !["completed", "failed", "cancelled"].includes(mission.status),
  );
  const editingLocked = Boolean(
    route.isSubmitting || missionActive || route.isOptimizing,
  );
  const { editingLockRef, setIsSubmitting } = route;
  useLayoutEffect(() => {
    if (editingLockRef) editingLockRef.current = editingLocked;
  }, [editingLockRef, editingLocked]);
  const isEditingLocked = () => editingLockRef?.current || editingLocked;
  const refuseEdit = () =>
    route.setStatus(
      "Редактирование заблокировано: остановите текущую миссию и дождитесь подтверждения остановки. Линия маршрута сохранена.",
    );
  useEffect(() => {
    if (mission?.missionId) setIsSubmitting?.(false);
  }, [mission?.missionId, mission?.status, setIsSubmitting]);
  const routeLifecycle = useDashboardPlannerRouteLifecycle({
    editingLocked,
    isEditingLocked,
    editingLockRef: route.editingLockRef,
    setIsSubmitting: route.setIsSubmitting,
    plannerModel,
    optimizedRoute: route.optimizedRoute,
    onMissionSubmitted: runtime.mission?.track,
    isOptimizing: route.isOptimizing,
    resetRouteTiming: runtime.routeTiming.reset,
    setActiveLimitZoneId: limits.setActiveLimitZoneId,
    setActivePointKind: interaction.setActivePointKind,
    setVisitPointMode: interaction.setVisitPointMode,
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
    isEditingLocked,
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
    isEditingLocked,
    mapLayers: state.sidebar?.plannerUiState?.mapLayers,
    setMapLayerVisible: state.sidebar?.setMapLayerVisible,
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
    onMissionSubmitted: runtime.mission?.track,
  });

  const changeVisitPointMode = (kind) => {
    if (!["visit", "free_visit"].includes(kind)) return;
    interaction.setVisitPointMode?.(kind);
    (interaction.activatePointPlacement || interaction.setActivePointKind)?.(kind);
    const changed = route.points.some((point) => ["visit", "free_visit"].includes(point.kind) && point.kind !== kind);
    if (!changed) return;
    route.setPoints(setVisitPointsKind(route.points, kind));
    routeSelection.clearRouteState();
    route.setStatus(kind === "visit"
      ? "Точки пронумерованы в порядке добавления. Постройте маршрут заново."
      : "Номера сняты: порядок обхода выберет планировщик. Постройте маршрут заново.");
  };

  const operations = {
    changeVisitPointMode,
    ...routeLifecycle,
    ...routeSelection,
    ...editors,
    ...runtimeActions,
  };
  const guarded = Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [
      name,
      typeof operation !== "function" ? operation : (...args) => {
        if (
          isEditingLocked() &&
          ![
            "finishDragging",
            "handleCanvasMouseMove",
            "requestMapExport",
            "exportMapImage",
          ].includes(name)
        ) {
          refuseEdit();
          return false;
        }
        return operation(...args);
      },
    ]),
  );
  return {
    ...guarded,
    editingLocked,
    isEditingLocked,
    exportGraphCsv: () => {
      downloadGraphCsv({
        points: route.points,
        limitZones: limits.limitZones,
        surfaceZones: surfaces.surfaceZones,
      });
      route.setStatus("Текущий граф сохранён в planner-graph.csv.");
    },
  };
};
