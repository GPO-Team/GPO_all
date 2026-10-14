import {
  DEFAULT_SURFACE_ZONES,
  dist,
  getZoneColor,
  pointInAnyPolygon,
  projectPointOutsidePolygons,
  routeCrossesAnyLimitPolygon,
} from "./zonePlanner";

export const INITIAL_ZONE = { id: "zone-1", name: "Зона 1", closed: false };
export const DRAG_HIT_RADIUS = 14;

const buildZoneEntries = (limitZones) =>
  limitZones.map((zone, zoneIndex) => ({
    ...zone,
    zoneIndex,
    color: getZoneColor(zoneIndex),
    points: [],
  }));

const buildPolygons = (zoneEntries) =>
  zoneEntries
    .filter((zone) => zone.closed && zone.points.length >= 3)
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      zoneIndex: zone.zoneIndex,
      color: zone.color,
      points: zone.points.map((entry) => ({ x: entry.point.x, y: entry.point.y })),
    }));

const buildSegmentPreviewPolygon = (points) => {
  if (points.length < 2) return null;

  const start = points[0].point;
  const end = points[1].point;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;

  const halfThickness = 0.35;
  const nx = -dy / length;
  const ny = dx / length;

  return [
    { x: start.x + nx * halfThickness, y: start.y + ny * halfThickness },
    { x: end.x + nx * halfThickness, y: end.y + ny * halfThickness },
    { x: end.x - nx * halfThickness, y: end.y - ny * halfThickness },
    { x: start.x - nx * halfThickness, y: start.y - ny * halfThickness },
  ];
};

const buildPointPreviewPolygon = (points) => {
  if (points.length < 1) return null;

  const center = points[0].point;
  const halfSize = 0.4;

  return [
    { x: center.x - halfSize, y: center.y - halfSize },
    { x: center.x + halfSize, y: center.y - halfSize },
    { x: center.x + halfSize, y: center.y + halfSize },
    { x: center.x - halfSize, y: center.y + halfSize },
  ];
};

const buildPreviewPolygons = (zoneEntries) =>
  zoneEntries
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      zoneIndex: zone.zoneIndex,
      color: zone.color,
      preview: !zone.closed,
      points:
        zone.closed || zone.points.length >= 3
          ? zone.points.map((entry) => ({ x: entry.point.x, y: entry.point.y }))
          : zone.points.length === 2
            ? buildSegmentPreviewPolygon(zone.points)
            : buildPointPreviewPolygon(zone.points),
    }))
    .filter((zone) => Array.isArray(zone.points) && zone.points.length >= 3);

export const buildPlannerModel = ({
  points,
  limitZones,
  optimizedRoute,
  activeLimitZoneId,
  surfaceZones = DEFAULT_SURFACE_ZONES,
  preserveVisitLocations=false,
}) => {
  const visitEntries = [];
  const chargeEntries = [];
  const zoneEntries = buildZoneEntries(limitZones);
  const zoneLookup = new Map(zoneEntries.map((zone) => [zone.id, zone]));
  let numberedCount=0;

  points.forEach((point, index) => {
    if (["visit","free_visit"].includes(point.kind)) {
      visitEntries.push({
        point,
        index,
        order: point.kind === "visit" ? ++numberedCount : null,
      });
      return;
    }

    if (point.kind === "charge") {
      chargeEntries.push({
        point,
        index,
        order: chargeEntries.length + 1,
      });
      return;
    }

    const zone = zoneLookup.get(point.zoneId) || zoneEntries[0];
    if (!zone) return;
    zone.points.push({
      point,
      index,
      order: zone.points.length + 1,
    });
  });

  const polygons = buildPolygons(zoneEntries);
  const previewPolygons = buildPreviewPolygons(zoneEntries);
  const plannedVisitEntries = visitEntries.map((entry) => {
    const projection = preserveVisitLocations ? {point:entry.point,adjusted:false} : projectPointOutsidePolygons(entry.point, previewPolygons);
    return {
      ...entry,
      plannedPoint: projection.point,
      adjusted: projection.adjusted,
    };
  });

  const activeZone =
    zoneEntries.find((zone) => zone.id === activeLimitZoneId) || zoneEntries[0] || null;

  return {
    visitEntries,
    chargeEntries,
    zoneEntries,
    polygons,
    previewPolygons,
    plannedVisitEntries,
    plannedVisitEntryMap: new Map(plannedVisitEntries.map((entry) => [entry.index, entry])),
    visitPoints: plannedVisitEntries.map((entry) => entry.plannedPoint),
    visitOrder: visitEntries.map(entry=>entry.point.kind === "free_visit" ? "free" : "ordered"),
    chargePoints: chargeEntries.map((entry) => ({ x: entry.point.x, y: entry.point.y })),
    visitsInsideLimit: plannedVisitEntries.filter((entry) =>
      pointInAnyPolygon(entry.point, previewPolygons)
    ),
    adjustedVisits: plannedVisitEntries.filter((entry) => entry.adjusted),
    routeBlocked:
      optimizedRoute.length > 1 && routeCrossesAnyLimitPolygon(optimizedRoute, polygons),
    routeLength: optimizedRoute.reduce(
      (sum, point, index, route) => (index ? sum + dist(route[index - 1], point) : 0),
      0
    ),
    surfaceZones,
    activeZone,
    activeZoneName: activeZone?.name || "Зона",
  };
};

export { rotateClosedRouteToNearestPoint } from "../../shared/planning/routeAnchor.js";

export const getRouteAnchor = (telemetry) => ({
  x: Number.isFinite(telemetry?.x) ? telemetry.x : 0,
  y: Number.isFinite(telemetry?.y) ? telemetry.y : 0,
});
