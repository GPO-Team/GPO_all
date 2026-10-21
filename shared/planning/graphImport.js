import { isInsideMap } from "./worldBounds.js";
import { SURFACE_PROFILE_OPTIONS } from "./energyProfiles.js";

// Graph import shared by the planning service and the editor: table parsing
// (Excel/CSV rows) and normalization of imported graphs into editor state.
export const INITIAL_ZONE = { id: "zone-1", name: "Зона 1", closed: false };
export const POINT_TASKS = [
  "Ожидание 2 сек", "Сканирование", "Забрать объект", "Сбросить объект", "Сделать фото",
];
export const DEFAULT_POINT_TASK = POINT_TASKS[0];

const surfaceProfileKeys = new Set(SURFACE_PROFILE_OPTIONS.map((profile) => profile.key));

export const isSurfaceProfileKey = (surfaceKey) => surfaceProfileKeys.has(surfaceKey);

export const DEFAULT_SURFACE_PROFILE_KEY =
  SURFACE_PROFILE_OPTIONS.find((profile) => profile.key !== "neutral")?.key ||
  SURFACE_PROFILE_OPTIONS[0]?.key ||
  "neutral";

const normalizeSurfacePoint = (point) => {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const normalized = { x, y };
  return isInsideMap(normalized) ? normalized : null;
};

export const normalizeSurfaceZoneForState = (zone, index) => {
  const points = (Array.isArray(zone?.points) ? zone.points : [])
    .map(normalizeSurfacePoint)
    .filter(Boolean);
  const surfaceKey = surfaceProfileKeys.has(zone?.surfaceKey)
    ? zone.surfaceKey
    : DEFAULT_SURFACE_PROFILE_KEY;

  return {
    id:
      typeof zone?.id === "string" && zone.id.trim()
        ? zone.id.trim()
        : `surface-zone-${index + 1}`,
    name:
      typeof zone?.name === "string" && zone.name.trim()
        ? zone.name.trim()
        : `Покрытие ${index + 1}`,
    surfaceKey,
    closed: zone?.closed === undefined ? points.length >= 3 : Boolean(zone.closed),
    points,
  };
};

export const normalizeSurfaceZonesForImport = (surfaceZones) => {
  if (!Array.isArray(surfaceZones)) return null;
  const normalized = surfaceZones
    .map((zone, index) => normalizeSurfaceZoneForState(zone, index))
    .filter((zone) => zone.points.length > 0);
  return normalized.length ? normalized : null;
};

const parseNumber = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase();

export const parsePlannerTableRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("Файл пуст.");
  }

  const firstRow = rows[0] || [];
  const firstRowHasCoordinates =
    parseNumber(firstRow[0]) !== null && parseNumber(firstRow[1]) !== null;
  const headers = firstRowHasCoordinates ? [] : firstRow.map(normalizeHeader);
  const dataRows = firstRowHasCoordinates ? rows : rows.slice(1);
  const findColumn = (aliases, fallback) => {
    const index = headers.findIndex((header) => aliases.includes(header));
    return index >= 0 ? index : fallback;
  };

  const xCol = findColumn(["x", "х", "xcoord", "x coordinate", "координата x"], 0);
  const yCol = findColumn(["y", "у", "ycoord", "y coordinate", "координата y"], 1);
  const kindCol = findColumn(["kind", "type", "тип", "роль"], -1);
  const taskCol = findColumn(["task", "operation", "операция", "задача"], -1);
  const zoneIdCol=findColumn(["zone_id","zoneid"],-1);
  const zoneNameCol=findColumn(["zone_name","zonename"],-1);
  const zoneClosedCol=findColumn(["zone_closed","closed"],-1);
  const zones=new Map();
  const surfaces=new Map();
  const surfaceKeyCol=findColumn(["surface_key","surfacekey"],-1);

  const points = dataRows
    .map((row) => {
      const x = parseNumber(row?.[xCol]);
      const y = parseNumber(row?.[yCol]);
      if (x === null || y === null) return null;

      const kindText = kindCol >= 0 ? normalizeHeader(row?.[kindCol]) : "";
      const kind =
        kindText === "surface" || kindText.includes("покрыт") ? "surface" : kindText === "free_visit" || kindText.includes("свобод") ? "free_visit" : kindText.includes("charge") || kindText.includes("зар")
          ? "charge"
          : kindText.includes("limit") ||
              kindText.includes("zone") ||
              kindText.includes("зон")
            ? "limit"
            : "visit";
      const zoneId=zoneIdCol>=0 && row[zoneIdCol] ? String(row[zoneIdCol]) : INITIAL_ZONE.id;
      if(kind==="surface"){
        if(!surfaces.has(zoneId))surfaces.set(zoneId,{id:zoneId,name:zoneNameCol>=0?String(row[zoneNameCol]):"Покрытие",closed:zoneClosedCol>=0?["true","1"].includes(normalizeHeader(row[zoneClosedCol])):false,surfaceKey:surfaceKeyCol>=0?String(row[surfaceKeyCol]):"neutral",points:[]});
        surfaces.get(zoneId).points.push({x,y});return null;
      }
      if(kind==="limit")zones.set(zoneId,{id:zoneId,name:zoneNameCol>=0 && row[zoneNameCol] ? String(row[zoneNameCol]) : INITIAL_ZONE.name,closed:zoneClosedCol>=0 ? ["true","1"].includes(normalizeHeader(row[zoneClosedCol])) : false});
      return {
        x,
        y,
        kind,
        zoneId: kind === "limit" ? zoneId : null,
        task:
          ["visit","free_visit"].includes(kind) && taskCol >= 0
            ? String(row?.[taskCol] || DEFAULT_POINT_TASK)
            : null,
      };
    })
    .filter(Boolean);

  if (!points.length && !surfaces.size) {
    throw new Error("В файле не найдено валидных координат.");
  }

  return {
    points,
    limitZones: [...zones.values()],
    ...(surfaces.size?{surfaceZones:[...surfaces.values()]}:{}),
  };
};

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

const VISIT_KINDS = ["visit", "free_visit"];

// Checks an imported graph against editor rules: a closed limit zone needs at
// least three points, and the visit order mode applies to all visit points.
export const validateImportedGraph = (graph) => {
  const warnings = [];
  const zonePointCounts = new Map();
  for (const point of graph.points) {
    if (point.kind === "limit") zonePointCounts.set(point.zoneId, (zonePointCounts.get(point.zoneId) || 0) + 1);
  }
  const limitZones = graph.limitZones.map((zone) => {
    if (!zone.closed || (zonePointCounts.get(zone.id) || 0) >= 3) return zone;
    warnings.push(`Зона «${zone.name}» открыта: для замкнутого контура нужно минимум 3 точки.`);
    return { ...zone, closed: false };
  });
  const visitKinds = new Set(graph.points.filter((point) => VISIT_KINDS.includes(point.kind)).map((point) => point.kind));
  const visitPointMode = visitKinds.size === 1 && visitKinds.has("free_visit") ? "free_visit" : "visit";
  if (visitKinds.size > 1) warnings.push("В файле были точки с номерами и без: все точки пронумерованы по порядку.");
  const points = visitKinds.size > 1
    ? graph.points.map((point) => point.kind === "free_visit" ? { ...point, kind: "visit" } : point)
    : graph.points;
  return { graph: { ...graph, points, limitZones }, warnings, visitPointMode };
};
