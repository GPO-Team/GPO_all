import { drawPlannerBackground } from "./plannerCanvasRenderer";
import { renderPlannerPointLayer, renderPlannerRobot } from "./plannerCanvasPointRenderer";
import { renderPlannerLidarTrace, renderPlannerRouteLayer } from "./plannerCanvasRouteRenderer";
import { renderPlannerSensorLayers } from "./plannerCanvasSensorRenderer";
import { renderPlannerZoneLayer } from "./plannerCanvasZoneRenderer";
import { renderPlannerRuntimeObstacles } from "./plannerCanvasObstacleRenderer";

export const renderPlannerCanvasScene = (ctx, state) => {
  const layers = state.mapLayers || {};
  drawPlannerBackground(ctx, layers.surfaces === false ? [] : state.surfaceZones, {
    annotate: layers.axes === true, border: false, grid: layers.grid !== false,
    axisLabels: layers.axisLabels !== false,
    viewScale: state.viewScale,
  });
  renderPlannerSensorLayers(ctx, {
    obstacleMap: layers.lidar === false ? null : state.obstacleMap,
    cameraMap: layers.lidar === false ? null : state.cameraMap,
  });
  if (layers.lidarTrace !== false) renderPlannerLidarTrace(ctx, state.obstacleTrace);
  if (layers.zones !== false) renderPlannerZoneLayer(ctx, state.zoneEntries);
  if (layers.route !== false) renderPlannerRouteLayer(ctx, state);
  if (layers.runtimeObstacles !== false) renderPlannerRuntimeObstacles(ctx, state.runtimeObstacles, state.viewScale);
  renderPlannerPointLayer(ctx, {
    ...state,
    visitEntries: layers.visits === false ? [] : state.visitEntries,
    chargeEntries: layers.charges === false ? [] : state.chargeEntries,
  });
};

export const renderPlannerCanvasFrame = (ctx, state, telemetry) => {
  renderPlannerCanvasScene(ctx, state);
  renderPlannerRobot(ctx, state, telemetry);
};
