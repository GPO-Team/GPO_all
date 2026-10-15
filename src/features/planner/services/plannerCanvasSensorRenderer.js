import { worldToCanvas } from "../../../lib/zonePlanner";

export const renderPlannerSensorLayers = (ctx, { obstacleMap, cameraMap }) => {
  const lidarCells = Array.isArray(obstacleMap?.cells) ? obstacleMap.cells : [];
  const cameraObstacleCells = Array.isArray(cameraMap?.cells) ? cameraMap.cells : [];
  if (!lidarCells.length && !cameraObstacleCells.length) return;

  const renderDots = (cells, rgb, radius, confidenceScale) => cells.forEach((cell) => {
    if (!Number.isFinite(cell?.x) || !Number.isFinite(cell?.y)) return;
    const confidence = Math.max(0, Number(cell.confidence) || 0);
    const opacity = 0.3 + Math.min(1, confidence / confidenceScale) * 0.45;
    const point = worldToCanvas(cell.x, cell.y);
    ctx.fillStyle = `rgba(${rgb}, ${opacity})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  renderDots(lidarCells, "45, 212, 191", 1.25, 10);
  renderDots(cameraObstacleCells, "168, 85, 247", 1.6, 8);
};
