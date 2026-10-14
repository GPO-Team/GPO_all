import { useRef } from "react";
import {
  DEFAULT_POINT_TASK,
  canvasToWorld,
  isInsideMap,
  worldToCanvas,
} from "../../../lib/zonePlanner";
import { DRAG_HIT_RADIUS } from "../../../lib/plannerModel";
import { getCanvasEventPosition } from "../model/plannerViewport";
import { isPointLayerVisible } from "../model/mapLayers";
import {
  appendPlannerPoint,
  findPointIndexAtCanvasPosition,
  movePlannerPoint,
  removePlannerPoint,
  removePlannerPointsByKind,
  updatePlannerPointTask,
} from "../model/pointEditor";

export const usePlannerPointEditor = ({
  activeLimitZoneId,
  activePointKind,
  activeSurfaceProfileKey,
  activeSurfaceZone,
  activeZone,
  activeZoneName,
  canvasRef,
  clearRouteState,
  points,
  resetZones,
  setPoints,
  setStatus,
  setSurfaceZones,
  mapLayers,
  setMapLayerVisible,
}) => {
  const dragStateRef = useRef({
    pointIndex: null,
    moved: false,
    preventClick: false,
  });

  const movePoint = (pointIndex, nextPoint) => {
    if (!isInsideMap(nextPoint)) return false;
    const currentPoint = points[pointIndex];
    if (!currentPoint) return false;

    setPoints((previous) => movePlannerPoint(previous, pointIndex, nextPoint));
    if (currentPoint.kind === "visit") clearRouteState();
    else clearRouteState({ dropSolvedRoute: false });
    return true;
  };

  const handleCanvasMouseDown = (event) => {
    if (!canvasRef.current) return;
    const canvasPoint = getCanvasEventPosition(canvasRef.current, event);
    const pointIndex = findPointIndexAtCanvasPosition(
      points,
      canvasPoint,
      (point) => worldToCanvas(point.x, point.y),
      DRAG_HIT_RADIUS / (canvasRef.current.plannerViewport?.scale || 1),
      (point) => isPointLayerVisible(point, mapLayers)
    );
    if (pointIndex < 0) return;

    dragStateRef.current = {
      pointIndex,
      moved: false,
      preventClick: false,
    };
  };

  const handleCanvasMouseMove = (event) => {
    if (!canvasRef.current) return;
    const { pointIndex } = dragStateRef.current;
    if (pointIndex === null) return;

    const canvasPoint = getCanvasEventPosition(canvasRef.current, event);
    const moved = movePoint(
      pointIndex,
      canvasToWorld(canvasPoint.x, canvasPoint.y)
    );
    if (moved) dragStateRef.current.moved = true;
  };

  const finishDragging = () => {
    const { pointIndex } = dragStateRef.current;
    if (pointIndex === null) return;
    dragStateRef.current = {
      pointIndex: null,
      moved: false,
      preventClick: true,
    };
  };

  const addPointFromCanvas = (event) => {
    if (!canvasRef.current) return;
    if (dragStateRef.current.preventClick) {
      dragStateRef.current.preventClick = false;
      return;
    }

    const canvasPoint = getCanvasEventPosition(canvasRef.current, event);
    const point = canvasToWorld(canvasPoint.x, canvasPoint.y);
    if (!isInsideMap(point)) {
      setStatus("Кликните внутри рабочей карты.");
      return;
    }
    // Reveal the edited layer so newly added points never disappear.
    const layerKey = { visit: "visits", charge: "charges", limit: "zones", surface: "surfaces" }[activePointKind];
    if (mapLayers?.[layerKey] === false) setMapLayerVisible?.(layerKey, true);
    if (activePointKind === "limit" && activeZone?.closed) {
      setStatus(
        "Зона уже замкнута. Нажмите «Открыть», чтобы добавлять или менять точки."
      );
      return;
    }
    if (activePointKind === "surface") {
      if (!activeSurfaceZone) {
        setStatus("Сначала создайте зону покрытия.");
        return;
      }
      if (activeSurfaceZone.closed) {
        setStatus("Покрытие уже замкнуто. Откройте его, чтобы добавить точки.");
        return;
      }
      setSurfaceZones((previous) =>
        previous.map((zone) =>
          zone.id === activeSurfaceZone.id
            ? {
                ...zone,
                surfaceKey: activeSurfaceProfileKey,
                points: [...zone.points, point],
              }
            : zone
        )
      );
      clearRouteState({ dropSolvedRoute: false });
      setStatus(`Добавлена точка в ${activeSurfaceZone.name}.`);
      return;
    }

    setPoints((previous) =>
      appendPlannerPoint(
        previous,
        point,
        activePointKind,
        activeLimitZoneId,
        DEFAULT_POINT_TASK
      )
    );
    if (activePointKind === "visit") clearRouteState();
    else clearRouteState({ dropSolvedRoute: false });
    setStatus(
      activePointKind === "visit"
        ? "Добавлена точка посещения."
        : activePointKind === "charge"
          ? "Добавлена станция зарядки."
          : `Добавлена точка в ${activeZoneName}.`
    );
  };

  const clearPoints = (kind = null) => {
    if (kind === "limit") resetZones();
    setPoints((previous) => removePlannerPointsByKind(previous, kind));
    if (kind === "visit") clearRouteState();
    else if (kind === "limit" || kind === "charge") {
      clearRouteState({ dropSolvedRoute: false });
    } else {
      clearRouteState();
    }
    setStatus(
      kind === "visit"
        ? "Маршрутные точки очищены."
        : kind === "charge"
          ? "Станции зарядки очищены."
          : kind === "limit"
            ? "Ограничивающие зоны очищены."
            : "Все точки очищены."
    );
  };

  const deletePoint = (pointIndex) => {
    const targetPoint = points[pointIndex];
    setPoints((previous) => removePlannerPoint(previous, pointIndex));
    if (targetPoint?.kind === "visit") clearRouteState();
    else clearRouteState({ dropSolvedRoute: false });
  };

  const updatePointTask = (pointIndex, task) => {
    setPoints((previous) => updatePlannerPointTask(previous, pointIndex, task));
    clearRouteState();
  };

  return {
    addPointFromCanvas,
    clearPoints,
    deletePoint,
    finishDragging,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    updatePointTask,
  };
};
