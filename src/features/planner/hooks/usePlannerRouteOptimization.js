import { buildSceneSnapshot } from "../model/sceneSnapshot";
import { useEffect, useRef } from "react";
import {
  getAlgorithmLabel,
  getTaskLabel,
  solveRouteWithNativeAlgorithm,
} from "../../../lib/routeAlgorithms";
import {
  getRouteAnchor,
} from "../../../lib/plannerModel";
import { routeCrossesAnyLimitPolygon } from "../../../lib/zonePlanner";
import {
  buildRouteEnergyStats,
  createEmptyRouteEnergyStats,
} from "../model/routeEnergy";
import { buildRouteOptimizationStatus } from "../model/routeOptimization";

export const usePlannerRouteOptimization = ({ algorithmKey, batteryRangeMeters, energyOptions, isOptimizing, plannerModel, routeTaskKey, selectedAlgorithmParams, setEnergyWarning, setIsOptimizing, setOptimizedRoute, setRouteEnergyStats, setRouteSeed, setStatus, telemetry }) => {
  const activeRequest = useRef(null);
  const revision = JSON.stringify([plannerModel.visitPoints, plannerModel.previewPolygons,
    plannerModel.surfaceZones, plannerModel.chargePoints, algorithmKey, selectedAlgorithmParams,
    routeTaskKey, batteryRangeMeters, energyOptions]);
  useEffect(() => () => {
    activeRequest.current?.abort();
  }, [revision]);
  const optimizeRoute = async () => {
    if (isOptimizing || activeRequest.current) return;
    if (plannerModel.visitPoints.length < 2) {
      setStatus("Добавьте хотя бы две точки посещения.");
      setEnergyWarning("");
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsOptimizing(true);
    setStatus("Строим маршрут...");
    try {
      const solveResult = await solveRouteWithNativeAlgorithm(plannerModel.visitEntries?.map(entry=>entry.point)||plannerModel.visitPoints, algorithmKey, selectedAlgorithmParams, routeTaskKey, controller.signal, {
        scene:buildSceneSnapshot({plannerModel,batteryRangeMeters,energyOptions,preview:true}),
        anchor:getRouteAnchor(telemetry),
        visitOrder:plannerModel.visitOrder,
      });
      if (controller.signal.aborted) return;
      const solvedRoute = solveResult.seedRoute;
      const routed = solveResult.planning;
      if (!Array.isArray(solvedRoute) || !routed?.ok) throw new Error("Planning service не вернул окончательный маршрут.");
      setRouteSeed(solvedRoute);
      setOptimizedRoute(routed.route);
      setRouteEnergyStats(buildRouteEnergyStats(routed));
      setEnergyWarning("");
      setStatus(buildRouteOptimizationStatus({ adjustedVisitCount: plannerModel.adjustedVisits.length, algorithmLabel: getAlgorithmLabel(algorithmKey), blocked: routeCrossesAnyLimitPolygon(routed.route, plannerModel.previewPolygons), routed, taskLabel: getTaskLabel(routeTaskKey) })+(solveResult.visitOrdering ? ` Нумерованные — по порядку; свободные — ${solveResult.visitOrdering.optimal ? "точный минимум по доступным путям" : "лучший найденный порядок без гарантии глобального минимума"}.` : ""));
    } catch (error) {
      if (controller.signal.aborted) return;
      setRouteSeed([]);
      setOptimizedRoute([]);
      setRouteEnergyStats(createEmptyRouteEnergyStats());
      setEnergyWarning("");
      setStatus(error instanceof Error ? error.message : "Не удалось построить маршрут.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsOptimizing(false);
      }
    }
  };
  return optimizeRoute;
};
