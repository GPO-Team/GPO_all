import {
  HALF_HEIGHT,
  HALF_WIDTH,
  MAP_WORLD_HEIGHT,
  MAP_WORLD_WIDTH,
  isInsideMap,
} from "./worldBounds.js";
import { dist } from "./zonePlannerGeometry.js";
import {
  MAP_TRAVERSAL_MARGIN,
  ROUTE_CLEARANCE_MARGIN,
  findBlockingPolygon,
  isInsideTraversableMap,
  segmentClear,
} from "./zonePlannerPolygons.js";

const GRID_PATH_STEP = 0.3;
export const CONTROLLER_MIN_SEGMENT = 0.12;
const COLLINEAR_EPS = 1e-4;
const EPS = 1e-9;
const copyPoint = (point) => ({ ...point });
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const buildGridIndex = (x, y, cols) => y * cols + x;

const createTraversalGrid = (polygons, margin = ROUTE_CLEARANCE_MARGIN) => {
  const originX = -HALF_WIDTH + MAP_TRAVERSAL_MARGIN;
  const originY = -HALF_HEIGHT + MAP_TRAVERSAL_MARGIN;
  const cols = Math.floor((MAP_WORLD_WIDTH - MAP_TRAVERSAL_MARGIN * 2) / GRID_PATH_STEP) + 1;
  const rows = Math.floor((MAP_WORLD_HEIGHT - MAP_TRAVERSAL_MARGIN * 2) / GRID_PATH_STEP) + 1;
  const points = Array(cols * rows);
  const blocked = Array(cols * rows).fill(false);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const point = { x: originX + x * GRID_PATH_STEP, y: originY + y * GRID_PATH_STEP };
      const index = buildGridIndex(x, y, cols);
      points[index] = point;
      blocked[index] =
        !isInsideMap(point) ||
        !isInsideTraversableMap(point) ||
        Boolean(findBlockingPolygon(point, polygons, margin));
    }
  }
  return { cols, rows, points, blocked };
};

const findNearestFreeGridCell = (point, grid, polygons, margin) => {
  const { cols, rows, points, blocked } = grid;
  const baseX = clampNumber(
    Math.round((point.x - (-HALF_WIDTH + MAP_TRAVERSAL_MARGIN)) / GRID_PATH_STEP),
    0,
    cols - 1
  );
  const baseY = clampNumber(
    Math.round((point.y - (-HALF_HEIGHT + MAP_TRAVERSAL_MARGIN)) / GRID_PATH_STEP),
    0,
    rows - 1
  );
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let y = Math.max(0, baseY - radius); y <= Math.min(rows - 1, baseY + radius); y += 1) {
      for (let x = Math.max(0, baseX - radius); x <= Math.min(cols - 1, baseX + radius); x += 1) {
        const index = buildGridIndex(x, y, cols);
        if (blocked[index]) continue;
        const candidate = points[index];
        if (!segmentClear(point, candidate, polygons, margin)) continue;
        const candidateDistance = dist(point, candidate);
        if (candidateDistance < bestDistance) {
          bestDistance = candidateDistance;
          bestIndex = index;
        }
      }
    }
    if (bestIndex >= 0) return bestIndex;
  }
  return -1;
};

const simplifyPathByVisibility = (path, polygons, margin) => {
  if (path.length <= 2) return path.map(copyPoint);
  const simplified = [copyPoint(path[0])];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1 && !segmentClear(path[anchor], path[next], polygons, margin)) {
      next -= 1;
    }
    simplified.push(copyPoint(path[next]));
    anchor = next;
  }
  return simplified;
};

const simplifyCollinearPath = (path) => {
  if (path.length <= 2) return path.map(copyPoint);
  const simplified = [copyPoint(path[0])];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = simplified[simplified.length - 1];
    const current = path[i];
    const next = path[i + 1];
    const cross = Math.abs(
      (current.x - prev.x) * (next.y - current.y) -
      (current.y - prev.y) * (next.x - current.x)
    );
    const forward = (current.x - prev.x) * (next.x - current.x) +
      (current.y - prev.y) * (next.y - current.y);
    if (cross > COLLINEAR_EPS || forward <= 0) simplified.push(copyPoint(current));
  }
  simplified.push(copyPoint(path[path.length - 1]));
  return simplified;
};

const findShortestSafePath = (start, end, polygons, margin, getGrid) => {
  if (segmentClear(start, end, polygons, margin)) return [copyPoint(start), copyPoint(end)];
  const grid = getGrid ? getGrid() : createTraversalGrid(polygons, margin);
  const startIndex = findNearestFreeGridCell(start, grid, polygons, margin);
  const endIndex = findNearestFreeGridCell(end, grid, polygons, margin);
  if (startIndex < 0 || endIndex < 0) return null;
  if (startIndex === endIndex) {
    return simplifyPathByVisibility(
      [copyPoint(start), copyPoint(grid.points[startIndex]), copyPoint(end)],
      polygons,
      margin
    );
  }
  const { cols, rows, points, blocked } = grid;
  const open = new Set([startIndex]);
  const closed = Array(points.length).fill(false);
  const gScore = Array(points.length).fill(Number.POSITIVE_INFINITY);
  const fScore = Array(points.length).fill(Number.POSITIVE_INFINITY);
  const previous = Array(points.length).fill(-1);
  gScore[startIndex] = 0;
  fScore[startIndex] = dist(points[startIndex], points[endIndex]);
  const directions = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
  ];
  while (open.size) {
    let current = -1;
    let bestF = Number.POSITIVE_INFINITY;
    for (const index of open) {
      if (fScore[index] < bestF) {
        bestF = fScore[index];
        current = index;
      }
    }
    if (current < 0 || current === endIndex) break;
    open.delete(current);
    closed[current] = true;
    const currentX = current % cols;
    const currentY = Math.floor(current / cols);
    for (const [dx, dy] of directions) {
      const nextX = currentX + dx;
      const nextY = currentY + dy;
      if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) continue;
      const nextIndex = buildGridIndex(nextX, nextY, cols);
      if (closed[nextIndex] || blocked[nextIndex]) continue;
      const fromPoint = points[current];
      const toPoint = points[nextIndex];
      if (!segmentClear(fromPoint, toPoint, polygons, margin)) continue;
      const tentative = gScore[current] + dist(fromPoint, toPoint);
      if (tentative + EPS >= gScore[nextIndex]) continue;
      previous[nextIndex] = current;
      gScore[nextIndex] = tentative;
      fScore[nextIndex] = tentative + dist(toPoint, points[endIndex]);
      open.add(nextIndex);
    }
  }
  if (!Number.isFinite(gScore[endIndex])) return null;
  const path = [];
  for (let current = endIndex; current !== -1; current = previous[current]) {
    path.push(copyPoint(points[current]));
  }
  const rawPath = [copyPoint(start), ...path.reverse(), copyPoint(end)];
  return simplifyCollinearPath(simplifyPathByVisibility(rawPath, polygons, margin));
};

export const buildObstacleAwareRoute = (route, polygons) => {
  if (route.length <= 1 || polygons.length === 0) return route.map(copyPoint);
  const result = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const path = findShortestSafePath(route[i], route[i + 1], polygons, ROUTE_CLEARANCE_MARGIN);
    if (!path) return null;
    if (!result.length) result.push(...path);
    else result.push(...path.slice(1));
  }
  return result;
};

export const createSafePathDistance = (polygons) => {
  let grid;
  const cache=new Map();
  return (start,end)=>{
    const key=JSON.stringify([start.x,start.y,end.x,end.y]);
    if(cache.has(key))return cache.get(key);
    const path=findShortestSafePath(start,end,polygons,ROUTE_CLEARANCE_MARGIN,()=>grid||(grid=createTraversalGrid(polygons)));
    const length=path ? path.slice(1).reduce((sum,p,i)=>sum+dist(path[i],p),0) : Infinity;
    cache.set(key,length);cache.set(JSON.stringify([end.x,end.y,start.x,start.y]),length);
    return length;
  };
};

export const sanitizeRouteForController = (route,mandatoryPoints=[]) => {
  const mandatory=new Set(mandatoryPoints.map(p=>`${p.x},${p.y}`));
  const required=p=>mandatory.has(`${p.x},${p.y}`);
  const cleaned = [];
  const minSegment = Math.max(CONTROLLER_MIN_SEGMENT, GRID_PATH_STEP * 0.55);
  for (const point of route) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const candidate = { x, y };
    if (!cleaned.length || dist(cleaned[cleaned.length - 1], candidate) >= minSegment || (required(candidate) && dist(cleaned.at(-1),candidate)>EPS)) {
      cleaned.push(candidate);
    }
  }
  if (cleaned.length <= 2) return cleaned;
  const smoothed = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i += 1) {
    const prev = smoothed[smoothed.length - 1];
    const current = cleaned[i];
    const next = cleaned[i + 1];
    const firstLeg = dist(prev, current);
    const secondLeg = dist(current, next);
    const direct = dist(prev, next);
    const cross = Math.abs(
      (current.x - prev.x) * (next.y - current.y) -
      (current.y - prev.y) * (next.x - current.x)
    );
    if (!required(current) && cross <= 0.02 && firstLeg + secondLeg - direct <= 0.08) continue;
    smoothed.push(current);
  }
  smoothed.push(cleaned[cleaned.length - 1]);
  return smoothed;
};
