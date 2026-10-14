import { ALGORITHM_OPTIONS, TASK_OPTIONS } from "../../../lib/routeAlgorithms";
import { INITIAL_ZONE } from "../../../lib/plannerModel";
import {
  DEFAULT_SURFACE_PROFILE_KEY,
  deriveNextSurfaceZoneNumber,
} from "../model/surfaceZones";
import {
  buildImportedGraphStatus,
  deriveNextZoneNumber,
  normalizeImportedGraph,
} from "../model/graphImport";
import { createEmptyRouteEnergyStats } from "../model/routeEnergy";
import { readPlannerImportFile } from "../services/plannerFileImport";

export const usePlannerGraphImport = ({
  resetRouteTiming,
  setActiveLimitZoneId,
  setActivePointKind,
  setActiveSurfaceProfileKey,
  setActiveSurfaceZoneId,
  setAlgorithmKey,
  setEnergyWarning,
  setExpandedPoint,
  setHoveredPointIndex,
  setLimitZones,
  setNextSurfaceZoneNumber,
  setNextZoneNumber,
  setOptimizedRoute,
  setPoints,
  setRouteEnergyStats,
  setRouteSeed,
  setRouteTaskKey,
  setStatus,
  setSurfaceZones,
  isEditingLocked=()=>false,
}) => {
  const applyImportedGraph = (rawGraph, sourceName = "graph.json") => {
    if(isEditingLocked())throw new Error("Нельзя заменить граф во время выполнения миссии. Остановите робота и дождитесь подтверждения.");
    const imported = normalizeImportedGraph(rawGraph);
    const importedZones = imported.limitZones.length ? imported.limitZones : [INITIAL_ZONE];
    setPoints(imported.points);
    setLimitZones(importedZones);
    if (imported.surfaceZones) {
      setSurfaceZones(imported.surfaceZones);
      setActiveSurfaceZoneId(imported.surfaceZones[0]?.id || "");
      setActiveSurfaceProfileKey(
        imported.surfaceZones[0]?.surfaceKey || DEFAULT_SURFACE_PROFILE_KEY
      );
      setNextSurfaceZoneNumber(deriveNextSurfaceZoneNumber(imported.surfaceZones));
    }
    setActiveLimitZoneId(
      importedZones.some((zone) => zone.id === imported.activeLimitZoneId)
        ? imported.activeLimitZoneId
        : importedZones[0].id
    );
    setNextZoneNumber(deriveNextZoneNumber(importedZones));
    setActivePointKind("visit");
    setExpandedPoint(null);
    setHoveredPointIndex(null);
    setRouteSeed([]);
    setOptimizedRoute([]);
    setEnergyWarning("");
    setRouteEnergyStats(createEmptyRouteEnergyStats());
    resetRouteTiming();

    if (TASK_OPTIONS.some((task) => task.key === imported.routeTaskKey)) {
      setRouteTaskKey(imported.routeTaskKey);
    }
    if (ALGORITHM_OPTIONS.some((algorithm) => algorithm.key === imported.algorithmKey)) {
      setAlgorithmKey(imported.algorithmKey);
    }
    setStatus(buildImportedGraphStatus(imported.points, sourceName));
  };

  return async (file) => {
    const importedFile = await readPlannerImportFile(file);
    applyImportedGraph(importedFile.graph, importedFile.sourceName);
  };
};
