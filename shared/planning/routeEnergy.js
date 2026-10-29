import { planRouteWithCharging } from "./chargingPlanner.js";
import { DEFAULT_ENERGY_OPTIONS } from "./energyModel.js";
import { buildObstacleAwareRoute } from "./zonePlannerRouting.js";
import { explainRouteFailure } from "./routeDiagnostics.js";

const ENERGY_SHORTAGE_FALLBACK =
  "Запаса хода не хватает: добавьте станции зарядки или увеличьте запас.";

export const getEnergyWarningText = (routeBuildResult) => {
  if (!routeBuildResult || routeBuildResult.ok) return "";
  if (routeBuildResult.reason === "insufficient_range") {
    return routeBuildResult.error || ENERGY_SHORTAGE_FALLBACK;
  }
  if (routeBuildResult.reason === "invalid_battery_range") {
    return routeBuildResult.error || "Проверьте корректность запаса хода.";
  }
  return "";
};

export const buildRouteWithEnergyStops = ({
  seedRoute,
  polygons,
  surfaceZones,
  chargingStations,
  batteryRangeMeters,
  energyOptions,
}) => {
  const safeRoute = buildObstacleAwareRoute(seedRoute, polygons);
  if (!safeRoute) {
    return {
      ok: false,
      reason: "obstacle_routing_failed",
      error: explainRouteFailure(seedRoute,polygons),
    };
  }

  const chargingResult = planRouteWithCharging({
    route: safeRoute,
    stations: chargingStations,
    polygons,
    surfaceZones,
    energyOptions,
    batteryRange: batteryRangeMeters,
  });
  if (!chargingResult.ok) {
    return {
      ok: false,
      reason: chargingResult.reason || "charging_planning_failed",
      error: chargingResult.error || "Маршрут недостижим при текущем запасе хода.",
    };
  }

  return {
    ok: true,
    route: chargingResult.route,
    stationStopCount: chargingResult.stationStopCount || 0,
    routeDistance: chargingResult.routeDistance,
    routeEnergy: chargingResult.routeEnergy || 0,
    estimatedTimeSec: chargingResult.estimatedTimeSec || 0,
    limitingMaxSpeedMps:
      chargingResult.limitingMaxSpeedMps || energyOptions?.speedMps || 0,
    averageSlipRisk: chargingResult.averageSlipRisk || 0,
  };
};

export const createEmptyRouteEnergyStats = () => ({
  routeEnergy: 0,
  distanceMeters: 0,
  estimatedTimeSec: 0,
  limitingMaxSpeedMps: DEFAULT_ENERGY_OPTIONS.speedMps,
  averageSlipRisk: 0,
  stationStopCount: 0,
});

export const buildRouteEnergyStats = (routeResult) => ({
  routeEnergy: routeResult.routeEnergy,
  distanceMeters: routeResult.routeDistance || 0,
  estimatedTimeSec: routeResult.estimatedTimeSec,
  limitingMaxSpeedMps: routeResult.limitingMaxSpeedMps,
  averageSlipRisk: routeResult.averageSlipRisk,
  stationStopCount: routeResult.stationStopCount || 0,
});
