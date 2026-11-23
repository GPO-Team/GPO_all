import { useCallback } from "react";
import { createDashboardAlgorithmParams } from "../model/dashboardAlgorithmParams";
import { createEmptyRouteEnergyStats } from "../model/routeEnergy";

export const usePlannerRouteSelection = ({
  resetRouteTiming,
  setAlgorithmKey,
  setAlgorithmParams,
  setEnergyWarning,
  setExpandedPoint,
  setHoveredPointIndex,
  setOptimizedRoute,
  setRouteEnergyStats,
  setRouteSeed,
  setRouteTaskKey,
  setStatus,
  isEditingLocked=()=>false,
}) => {
  const clearRouteState = useCallback(({ dropSolvedRoute = true } = {}) => {
    if(isEditingLocked())return;
    setExpandedPoint(null);
    setHoveredPointIndex(null);
    if (!dropSolvedRoute) return;
    setRouteSeed([]);
    setOptimizedRoute([]);
    setEnergyWarning("");
    setRouteEnergyStats(createEmptyRouteEnergyStats());
    resetRouteTiming();
  }, [isEditingLocked,resetRouteTiming, setEnergyWarning, setExpandedPoint, setHoveredPointIndex, setOptimizedRoute, setRouteEnergyStats, setRouteSeed]);

  const updateAlgorithmPrecision = useCallback((precision) => {
    setAlgorithmParams(createDashboardAlgorithmParams(precision));
    clearRouteState();
  }, [clearRouteState, setAlgorithmParams]);

  const handleRouteTaskChange = useCallback((nextTaskKey) => {
    setRouteTaskKey(nextTaskKey);
    clearRouteState();
    setStatus("");
    setEnergyWarning("");
  }, [clearRouteState, setEnergyWarning, setRouteTaskKey, setStatus]);

  const handleAlgorithmChange = useCallback((nextAlgorithmKey) => {
    setAlgorithmKey(nextAlgorithmKey);
    clearRouteState();
    setStatus("");
    setEnergyWarning("");
  }, [clearRouteState, setAlgorithmKey, setEnergyWarning, setStatus]);

  return { clearRouteState, handleAlgorithmChange, handleRouteTaskChange, updateAlgorithmPrecision };
};
