import { useCallback } from "react";
import { getDefaultAlgorithmParams } from "../../../lib/routeAlgorithms";
import { createEmptyRouteEnergyStats } from "../model/routeEnergy";

export const usePlannerRouteSelection = ({
  algorithmKey,
  resetRouteTiming,
  setAlgorithmKey,
  setAlgorithmParams,
  setDriveMode,
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

  const updateAlgorithmParam = useCallback((field, rawValue) => {
    const parsed = field.integer ? parseInt(rawValue, 10) : parseFloat(rawValue);
    if (!Number.isFinite(parsed)) return;
    setAlgorithmParams((prev) => ({ ...prev, [algorithmKey]: { ...getDefaultAlgorithmParams(algorithmKey), ...prev[algorithmKey], [field.key]: parsed } }));
    clearRouteState();
  }, [algorithmKey, clearRouteState, setAlgorithmParams]);

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

  const handleDriveModeChange = useCallback((nextMode) => {
    if (!["optimized", "ordered"].includes(nextMode)) return;
    setDriveMode(nextMode);
    clearRouteState();
    setStatus("Режим изменён. Постройте и отправьте маршрут заново.");
  }, [clearRouteState, setDriveMode, setStatus]);

  return { clearRouteState, handleDriveModeChange, handleAlgorithmChange, handleRouteTaskChange, updateAlgorithmParam };
};
