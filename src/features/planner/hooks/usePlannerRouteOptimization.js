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
  getEnergyWarningText,
} from "../model/routeEnergy";
import { buildRouteOptimizationStatus } from "../model/routeOptimization";

const ENERGY_CHECK_DELAY_MS = 400;

export const usePlannerRouteOptimization = ({ algorithmKey, batteryRangeMeters, energyOptions, isOptimizing, plannerModel, routeTaskKey, selectedAlgorithmParams, setEnergyWarning, setIsOptimizing, setOptimizedRoute, setRouteEnergyStats, setRouteSeed, setStatus, telemetry }) => {
  const activeRequest = useRef(null);
  const energyCheckRequest = useRef(null);
  const energyFailureRef = useRef(null);
  const checkEnergyRef = useRef(null);
  const graphRevision = JSON.stringify([plannerModel.visitPoints, plannerModel.visitOrder, plannerModel.previewPolygons,
    algorithmKey, selectedAlgorithmParams, routeTaskKey]);
  const energyRevision = JSON.stringify([plannerModel.surfaceZones, plannerModel.chargePoints, batteryRangeMeters, energyOptions]);
  const revision = graphRevision + energyRevision;
  useEffect(() => () => {
    activeRequest.current?.abort();
    energyCheckRequest.current?.abort();
  }, [revision]);
  // After an energy shortage, re-check reachability of the same points whenever
  // chargers or energy parameters change. The route itself is not applied.
  useEffect(() => {
    if (energyFailureRef.current !== graphRevision) energyFailureRef.current = null;
    if (!energyFailureRef.current) return undefined;
    const timer = setTimeout(() => checkEnergyRef.current?.(), ENERGY_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [graphRevision, energyRevision]);
  // visitPoints already contains safety projections for targets inside or
  // too close to forbidden zones. Keep those coordinates for every mode.
  const solve = async (signal) => {
    const solveResult = await solveRouteWithNativeAlgorithm(plannerModel.visitPoints, algorithmKey, selectedAlgorithmParams, routeTaskKey, signal, {
      scene:buildSceneSnapshot({plannerModel,batteryRangeMeters,energyOptions,preview:true}),
      anchor:getRouteAnchor(telemetry),
      visitOrder:plannerModel.visitOrder,
    });
    const routed = solveResult.planning;
    if (!Array.isArray(solveResult.seedRoute) || !routed?.ok) throw Object.assign(new Error(routed?.error || "Planning service не вернул окончательный маршрут."), { reason: routed?.reason });
    return solveResult;
  };
  const energyWarningFor = (error) => getEnergyWarningText({ ok: false, reason: error?.reason, error: error?.message });
  const checkEnergy = async () => {
    if (isOptimizing || activeRequest.current || plannerModel.visitPoints.length < 2) return;
    energyCheckRequest.current?.abort();
    const controller = new AbortController();
    energyCheckRequest.current = controller;
    const checkedRevision = graphRevision;
    try {
      await solve(controller.signal);
      if (controller.signal.aborted) return;
      energyFailureRef.current = null;
      setEnergyWarning("");
      setStatus("Энергии теперь хватает. Постройте маршрут.");
    } catch (error) {
      if (controller.signal.aborted) return;
      const energyWarning = energyWarningFor(error);
      energyFailureRef.current = energyWarning ? checkedRevision : null;
      setEnergyWarning(energyWarning);
    } finally {
      if (energyCheckRequest.current === controller) energyCheckRequest.current = null;
    }
  };
  const optimizeRoute = async () => {
    if (isOptimizing || activeRequest.current) return;
    if (plannerModel.visitPoints.length < 2) {
      setStatus("Добавьте хотя бы две точки посещения.");
      setEnergyWarning("");
      return;
    }
    energyCheckRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    energyFailureRef.current = null;
    setIsOptimizing(true);
    setStatus("Строим маршрут...");
    try {
      const solveResult = await solve(controller.signal);
      if (controller.signal.aborted) return;
      const solvedRoute = solveResult.seedRoute;
      const routed = solveResult.planning;
      setRouteSeed(solvedRoute);
      setOptimizedRoute(routed.route);
      setRouteEnergyStats(buildRouteEnergyStats(routed));
      setEnergyWarning("");
      const status = buildRouteOptimizationStatus({ adjustedVisitCount: plannerModel.adjustedVisits.length, algorithmLabel: getAlgorithmLabel(algorithmKey), blocked: routeCrossesAnyLimitPolygon(routed.route, plannerModel.previewPolygons), routed, taskLabel: getTaskLabel(routeTaskKey) });
      setStatus(status+(solveResult.visitOrdering ? ` Нумерованные — по порядку; свободные — ${solveResult.visitOrdering.optimal ? "точный минимум по доступным путям" : "лучший найденный порядок без гарантии глобального минимума"}.` : ""));
    } catch (error) {
      if (controller.signal.aborted) return;
      setRouteSeed([]);
      setOptimizedRoute([]);
      setRouteEnergyStats(createEmptyRouteEnergyStats());
      const energyWarning = energyWarningFor(error);
      if (energyWarning) energyFailureRef.current = graphRevision;
      setEnergyWarning(energyWarning);
      setStatus(error instanceof Error ? error.message : "Не удалось построить маршрут.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsOptimizing(false);
      }
    }
  };
  checkEnergyRef.current = checkEnergy;
  return optimizeRoute;
};
