import { useEffect } from "react";
import { buildRouteEnergyStats, buildRouteWithEnergyStops, createEmptyRouteEnergyStats, getEnergyWarningText } from "../model/routeEnergy";

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
  useEffect(() => {
    if(editingLocked)return;
    if (!routeSeed.length) {
      setOptimizedRoute([]);
      setEnergyWarning("");
      setRouteEnergyStats(createEmptyRouteEnergyStats());
      return;
    }
    const nextRoute = buildRouteWithEnergyStops({
      seedRoute: routeSeed,
      polygons: JSON.parse(previewPolygonRoutingText),
      surfaceZones,
      chargingStations: JSON.parse(chargePointsRoutingText),
      batteryRangeMeters,
      energyOptions,
    });
    if (!nextRoute.ok) {
      setOptimizedRoute([]);
      setEnergyWarning(getEnergyWarningText(nextRoute));
      setRouteEnergyStats(createEmptyRouteEnergyStats());
      setStatus(nextRoute.error || "Маршрут недостижим при текущих ограничениях.");
      return;
    }
    setEnergyWarning("");
    setOptimizedRoute(nextRoute.route);
    setRouteEnergyStats(buildRouteEnergyStats(nextRoute));
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
