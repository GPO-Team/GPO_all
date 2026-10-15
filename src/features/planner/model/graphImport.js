import { DEFAULT_POINT_TASK, isInsideMap } from "../../../lib/zonePlanner";
import { INITIAL_ZONE } from "../../../lib/plannerModel";
import { normalizeSurfaceZonesForImport } from "./surfaceZones";

const isFinitePoint = (point) =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y);

const normalizeImportedZoneMeta = (zone, index) => ({
  id:
    typeof zone?.id === "string" && zone.id.trim()
      ? zone.id.trim()
      : `zone-${index + 1}`,
  name:
    typeof zone?.name === "string" && zone.name.trim()
      ? zone.name.trim()
      : `Зона ${index + 1}`,
  closed: Boolean(zone?.closed),
});

export const deriveNextZoneNumber = (zones) => {
  const maxNumber = zones.reduce((best, zone) => {
    const idMatch = String(zone?.id ?? "").match(/zone-(\d+)/i);
    const nameMatch = String(zone?.name ?? "").match(/(\d+)/);
    const candidates = [idMatch?.[1], nameMatch?.[1]]
      .map((value) => Number(value))
      .filter(Number.isFinite);
    return candidates.length ? Math.max(best, ...candidates) : best;
  }, 1);
  return Math.max(2, maxNumber + 1);
};

export const buildImportedGraphStatus = (points, sourceName) => {
  const count = (kind) => points.filter((point) => point.kind === kind).length;
  return `Граф импортирован из ${sourceName}: точек посещения ${count("visit") + count("free_visit")}, зарядок ${count("charge")}, точек зон ${count("limit")}.`;
};

export const normalizeImportedGraph = (rawGraph) => {
  if (!rawGraph || typeof rawGraph !== "object") {
    throw new Error("Граф должен быть объектом JSON.");
  }

  if (Array.isArray(rawGraph.points)) {
    const zonesSource =
      Array.isArray(rawGraph.limitZones) && rawGraph.limitZones.length
        ? rawGraph.limitZones
        : [INITIAL_ZONE];
    const limitZones = zonesSource.map(normalizeImportedZoneMeta);
    const zoneIds = new Set(limitZones.map((zone) => zone.id));
    const points = rawGraph.points
      .filter(isFinitePoint)
      .filter(isInsideMap)
      .map((point) => {
        if (point.kind === "limit") {
          return {
            x: point.x,
            y: point.y,
            kind: "limit",
            zoneId: zoneIds.has(point.zoneId) ? point.zoneId : limitZones[0].id,
            task: null,
          };
        }
        if (point.kind === "charge") {
          return { x: point.x, y: point.y, kind: "charge", zoneId: null, task: null };
        }
        return {
          x: point.x,
          y: point.y,
          kind: point.kind === "free_visit" ? "free_visit" : "visit",
          zoneId: null,
          task: point.task || DEFAULT_POINT_TASK,
        };
      });
    return {
      points,
      limitZones,
      surfaceZones: normalizeSurfaceZonesForImport(rawGraph.surfaceZones),
      routeTaskKey: rawGraph.routeTaskKey,
      algorithmKey: rawGraph.algorithmKey,
      activeLimitZoneId: rawGraph.activeLimitZoneId,
    };
  }

  const limitZones = Array.isArray(rawGraph.zoneEntries)
    ? rawGraph.zoneEntries.map(normalizeImportedZoneMeta)
    : [INITIAL_ZONE];
  const points = [];
  for (const visitEntry of Array.isArray(rawGraph.visitEntries) ? rawGraph.visitEntries : []) {
    const point = visitEntry?.point;
    if (!isFinitePoint(point) || !isInsideMap(point)) continue;
    points.push({
      x: point.x,
      y: point.y,
      kind: "visit",
      zoneId: null,
      task: visitEntry?.task || point?.task || DEFAULT_POINT_TASK,
    });
  }
  for (const chargeEntry of Array.isArray(rawGraph.chargeEntries) ? rawGraph.chargeEntries : []) {
    const point = chargeEntry?.point;
    if (!isFinitePoint(point) || !isInsideMap(point)) continue;
    points.push({ x: point.x, y: point.y, kind: "charge", zoneId: null, task: null });
  }
  limitZones.forEach((zone) => {
    const sourceZone = Array.isArray(rawGraph.zoneEntries)
      ? rawGraph.zoneEntries.find((entry) => String(entry?.id) === zone.id)
      : null;
    const sourcePoints = Array.isArray(sourceZone?.points) ? sourceZone.points.slice() : [];
    sourcePoints
      .sort((left, right) => (Number(left?.order) || 0) - (Number(right?.order) || 0))
      .forEach((entry) => {
        const point = entry?.point;
        if (!isFinitePoint(point) || !isInsideMap(point)) return;
        points.push({ x: point.x, y: point.y, kind: "limit", zoneId: zone.id, task: null });
      });
  });
  return {
    points,
    limitZones,
    surfaceZones: normalizeSurfaceZonesForImport(rawGraph.surfaceZones),
    routeTaskKey: rawGraph.routeTaskKey,
    algorithmKey: rawGraph.algorithmKey,
    activeLimitZoneId: rawGraph.activeLimitZoneId,
  };
};
