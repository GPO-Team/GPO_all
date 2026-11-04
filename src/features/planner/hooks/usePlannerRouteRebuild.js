import { useEffect, useRef } from "react";
import { prepareRouteOnServer } from "../../../lib/routeAlgorithms";
import { buildRouteEnergyStats, createEmptyRouteEnergyStats, getEnergyWarningText } from "../model/routeEnergy";
import { buildSceneSnapshot } from "../model/sceneSnapshot";

const REBUILD_DELAY_MS = 250;

// Re-plans the solved visit order on the planning service when zones, chargers,
// surfaces or motion settings change. The order itself is kept.
export const usePlannerRouteRebuild = ({
  batteryRangeMeters,
  chargePointsRoutingText,
  energyOptions,
  previewPolygonRoutingText,
  routeSeed,
  setEnergyWarning,
  setOptimizedRoute,
  setRouteEnergyStats,
  setStatus,
  surfaceZones,
  editingLocked=false,
}) => {
  // Seed and scene of the route currently shown; re-plan only when the scene differs.
  const plannedRef = useRef({ seed: null, sceneKey: "" });
  useEffect(() => {
    if(editingLocked)return undefined;
    if (!routeSeed.length) {
      // A failed build leaves an empty seed; keep its energy warning visible.
      plannedRef.current = { seed: routeSeed, sceneKey: "" };
      setOptimizedRoute([]);
      setRouteEnergyStats(createEmptyRouteEnergyStats());
      return undefined;
    }
    const scene = buildSceneSnapshot({
      plannerModel: {
        previewPolygons: JSON.parse(previewPolygonRoutingText),
        surfaceZones,
        chargePoints: JSON.parse(chargePointsRoutingText),
      },
      batteryRangeMeters,
      energyOptions,
      preview: true,
    });
    const sceneKey = JSON.stringify(scene);
    // A new seed arrives together with the solver's prepared route for the same scene.
    if (plannedRef.current.seed !== routeSeed) {
      plannedRef.current = { seed: routeSeed, sceneKey };
      return undefined;
    }
    if (plannedRef.current.sceneKey === sceneKey) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      plannedRef.current = { seed: routeSeed, sceneKey };
      try {
        const planning = await prepareRouteOnServer(routeSeed, scene, controller.signal);
        if (controller.signal.aborted) return;
        setEnergyWarning("");
        setOptimizedRoute(planning.route);
        setRouteEnergyStats(buildRouteEnergyStats(planning));
      } catch (error) {
        if (controller.signal.aborted) return;
        setOptimizedRoute([]);
        setEnergyWarning(getEnergyWarningText({ ok: false, reason: error?.reason, error: error?.message }));
        setRouteEnergyStats(createEmptyRouteEnergyStats());
        setStatus(error?.message || "Маршрут недостижим при текущих ограничениях.");
      }
    }, REBUILD_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    batteryRangeMeters,
    chargePointsRoutingText,
    energyOptions,
    previewPolygonRoutingText,
    routeSeed,
    setEnergyWarning,
    setOptimizedRoute,
    setRouteEnergyStats,
    setStatus,
    surfaceZones,
    editingLocked,
  ]);

};
