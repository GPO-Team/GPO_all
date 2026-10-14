import { HALF_HEIGHT, HALF_WIDTH } from "../../../lib/zonePlannerCoordinates";

export const OBSTACLE_LIMITS = {
  sizeX: { min: 0.2, max: 3.5 }, sizeY: { min: 0.2, max: 3.5 },
  height: { min: 0.12, max: 2.8 },
};
export const getObstaclePositionLimits = ({ sizeX, sizeY }) => ({
  x: Math.min(21.5, HALF_WIDTH - sizeX / 2),
  y: Math.min(16.5, HALF_HEIGHT - sizeY / 2),
});
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const normalizeRuntimeObstacle = (obstacle) => {
  const result = {};
  for (const key of ["x", "y", "sizeX", "sizeY", "height"]) {
    if (obstacle[key] === "" || !Number.isFinite(Number(obstacle[key]))) throw new Error("Заполните координаты и размеры препятствия.");
    result[key] = Number(obstacle[key]);
  }
  for (const [key, { min, max }] of Object.entries(OBSTACLE_LIMITS)) result[key] = clamp(result[key], min, max);
  const bounds = getObstaclePositionLimits(result);
  result.x = clamp(result.x, -bounds.x, bounds.x);
  result.y = clamp(result.y, -bounds.y, bounds.y);
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Number(value.toFixed(4))]));
};

export const getObstacleDragMode = (obstacle, point, tolerance) => {
  const right = obstacle.x + obstacle.sizeX / 2;
  const bottom = obstacle.y - obstacle.sizeY / 2;
  if (Math.abs(point.x - right) <= tolerance && Math.abs(point.y - bottom) <= tolerance) return "resize";
  if (Math.abs(point.x - obstacle.x) <= obstacle.sizeX / 2 + tolerance &&
      Math.abs(point.y - obstacle.y) <= obstacle.sizeY / 2 + tolerance) return "move";
  return null;
};
export const dragRuntimeObstacle = (obstacle, start, point, mode) => {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (mode === "move") return normalizeRuntimeObstacle({ ...obstacle, x: obstacle.x + dx, y: obstacle.y + dy });
  // Keep the top-left corner fixed while resizing the opposite corner.
  const sizeX = clamp(obstacle.sizeX + dx, 0.2, 3.5);
  const sizeY = clamp(obstacle.sizeY - dy, 0.2, 3.5);
  return normalizeRuntimeObstacle({ ...obstacle, sizeX, sizeY,
    x: obstacle.x + (sizeX - obstacle.sizeX) / 2,
    y: obstacle.y - (sizeY - obstacle.sizeY) / 2 });
};
