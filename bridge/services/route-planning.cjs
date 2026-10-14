const { validatePoints } = require("../protocol/route-validation.cjs");
const { normalizeScene, sceneRevision } = require("../protocol/scene-validation.cjs");

// Pure planning use case. No filesystem, sockets or simulator API.
const prepareRoute = async ({ seedRoute, scene }) => {
  const snapshot = normalizeScene(scene);
  const points = validatePoints(seedRoute);
  if (points.length < 2) throw Object.assign(new Error("At least two route points are required."), {statusCode:400});
  const { buildRouteWithEnergyStops } = await import("../../shared/planning/routeEnergy.js");
  const { sanitizeRouteForController } = await import("../../shared/planning/zonePlannerRouting.js");
  const { routeCrossesAnyLimitPolygon } = await import("../../shared/planning/zonePlannerPolygons.js");
  const options = { surfaceZones:snapshot.surfaceZones, speedMps:snapshot.motion.cruiseSpeedMps, payloadKg:snapshot.motion.payloadKg };
  const result = buildRouteWithEnergyStops({seedRoute:points, polygons:snapshot.polygons, surfaceZones:snapshot.surfaceZones,
    chargingStations:snapshot.chargingStations, batteryRangeMeters:snapshot.motion.batteryRange, energyOptions:options});
  if (!result.ok) throw Object.assign(new Error(result.error), {statusCode:422, reason:result.reason});
  const route = validatePoints(sanitizeRouteForController(result.route,points));
  if (route.length < 2 || routeCrossesAnyLimitPolygon(route, snapshot.polygons)) {
    throw Object.assign(new Error("Final route is invalid after controller normalization."), {statusCode:422});
  }
  return { route, seedRoute:points, scene:snapshot, sceneRevision:sceneRevision(snapshot), planning:{...result, route} };
};
module.exports = { prepareRoute };
