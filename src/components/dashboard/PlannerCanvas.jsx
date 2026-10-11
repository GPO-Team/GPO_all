import { useEffect, useRef, useState } from "react";
import { clampZoom, createViewport, zoomAt } from "../../features/planner/model/plannerViewport";
import { MAP_WORLD_HEIGHT, MAP_WORLD_WIDTH } from "../../lib/zonePlannerCoordinates";
import { INITIAL_TELEMETRY } from "../../lib/telemetry/dashboardTelemetryState";
import { createPlannerCanvasDrawState } from "../../features/planner/model/plannerCanvasDrawState";
import { startPlannerCanvasRenderLoop } from "../../features/planner/services/plannerCanvasRenderLoop";

const INITIAL_DRAW_STATE = {
  visitEntries: [],
  chargeEntries: [],
  plannedVisitEntryMap: new Map(),
  zoneEntries: [],
  surfaceZones: [],
  optimizedRoute: [],
  obstacleTrace: [],
  obstacleMap: INITIAL_TELEMETRY.obstacleMap,
  cameraMap: INITIAL_TELEMETRY.cameraMap,
  routeBlocked: false,
  hoveredPointIndex: null,
};

export default function PlannerCanvas({
  canvasRef,
  plannerModel,
  optimizedRoute,
  hoveredPointIndex,
  telemetry,
  mapLayers,
  pointPlacementRevision = 0,
  onCanvasClick,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasMouseLeave,
}) {
  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [panState, setPanState] = useState({ enabled: false, revision: 0 });
  const panMode = panState.enabled && panState.revision === pointPlacementRevision;

  const updateViewport = () => {
    const container = containerRef.current;
    if (!container || !canvasRef.current) return;
    const viewport = createViewport(container.clientWidth, container.clientHeight, viewRef.current.zoom, viewRef.current.pan);
    viewportRef.current = viewport;
    canvasRef.current.plannerViewport = viewport;
  };
  const changeZoom = (next, anchor) => {
    const current = viewRef.current;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = clampZoom(next);
    current.pan = zoomAt(viewport, anchor || { x: viewport.width / 2, y: viewport.height / 2 }, current.zoom, nextZoom, current.pan);
    current.zoom = nextZoom;
    setZoom(nextZoom);
    updateViewport();
  };
  const fit = () => {
    viewRef.current = { zoom: 1, pan: { x: 0, y: 0 } };
    setZoom(1);
    updateViewport();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const resize = () => {
      const view = viewRef.current;
      const viewport = createViewport(container.clientWidth, container.clientHeight, view.zoom, view.pan);
      viewportRef.current = viewport;
      canvas.plannerViewport = viewport;
    };
    const wheel = (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const next = clampZoom(view.zoom * Math.exp(-event.deltaY * 0.0015));
      view.pan = zoomAt(viewportRef.current, { x: event.clientX - rect.left, y: event.clientY - rect.top }, view.zoom, next, view.pan);
      view.zoom = next;
      setZoom(next);
      resize();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); canvas.removeEventListener("wheel", wheel); };
  }, [canvasRef]);

  const telemetryTargetRef = useRef({ ...INITIAL_TELEMETRY });
  const telemetryRenderRef = useRef({ ...INITIAL_TELEMETRY });
  const drawStateRef = useRef(INITIAL_DRAW_STATE);

  useEffect(() => {
    telemetryTargetRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    drawStateRef.current = createPlannerCanvasDrawState({
      plannerModel,
      optimizedRoute,
      hoveredPointIndex,
      telemetry,
      fallbackObstacleMap: INITIAL_TELEMETRY.obstacleMap,
      fallbackCameraMap: INITIAL_TELEMETRY.cameraMap,
      mapLayers,
    });
  }, [hoveredPointIndex, optimizedRoute, plannerModel, telemetry, mapLayers]);

  useEffect(
    () =>
      startPlannerCanvasRenderLoop({
        canvasRef,
        telemetryTargetRef,
        telemetryRenderRef,
        drawStateRef,
        viewportRef,
      }),
    [canvasRef]
  );

  return (
    <main ref={containerRef} className="planner-map relative min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100" aria-label="Рабочая карта">
      <canvas
        ref={canvasRef}
        aria-label="Карта маршрута робота"
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (!panMode) onCanvasClick?.(event);
        }}
        onPointerDown={(event) => {
          if (panMode || event.button === 1 || event.button === 2 || event.altKey) {
            event.preventDefault();
            dragRef.current = { x: event.clientX, y: event.clientY, pan: { ...viewRef.current.pan } };
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          } else if (event.button === 0) {
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            onCanvasMouseDown?.(event);
          }
        }}
        onPointerMove={(event) => {
          if (dragRef.current) {
            const drag = dragRef.current;
            viewRef.current.pan = { x: drag.pan.x + event.clientX - drag.x, y: drag.pan.y + event.clientY - drag.y };
            updateViewport();
          } else onCanvasMouseMove?.(event);
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          onCanvasMouseUp?.(event);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => { dragRef.current = null; suppressClick.current = true; onCanvasMouseUp?.(event); }}
        onPointerLeave={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) onCanvasMouseLeave?.(event); }}
        className={`absolute inset-0 h-full w-full touch-none ${panMode ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
      />
      <div className="map-tools" role="toolbar" aria-label="Масштаб и перемещение">
        <button type="button" aria-label="Уменьшить масштаб" onClick={() => changeZoom(zoom / 1.25)}>−</button>
        <button type="button" className="min-w-16 tabular-nums" title="Вписать карту — 100%" onClick={fit}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Увеличить масштаб" onClick={() => changeZoom(zoom * 1.25)}>+</button>
        <span className="h-5 border-l border-slate-200" />
        <button type="button" aria-pressed={panMode} title="Перемещение карты. Также Alt + перетаскивание или правая кнопка мыши" onClick={() => setPanState({ enabled: !panMode, revision: pointPlacementRevision })}>{panMode ? "✋ Двигать" : "✛ Точки"}</button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-sm text-slate-700" aria-label="Метраж карты">
        <div>Размер карты: <b>{MAP_WORLD_WIDTH} × {MAP_WORLD_HEIGHT} м</b></div>
      </div>
    </main>
  );
}
