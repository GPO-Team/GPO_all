import { SCALE, worldToCanvas } from "../../../lib/zonePlanner";

export const renderPlannerSensorLayers = (ctx, { obstacleMap, cameraMap }) => {
  if (obstacleMap?.cells?.length) {
    const rawCellSize = Number(obstacleMap.cellSize);
    const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : 0.06;
    const cellCanvasSize = Math.max(3, cellSize * SCALE * 0.92);

    obstacleMap.cells.forEach((cell) => {
      const confidenceRaw = Number(cell?.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, confidenceRaw) : 0;
      const intensity = Math.max(0.16, Math.min(1, confidence / 6));
      const point = worldToCanvas(cell.x, cell.y);
      ctx.fillStyle = `rgba(14, 165, 233, ${0.12 + intensity * 0.3})`;
      ctx.strokeStyle = `rgba(2, 132, 199, ${0.18 + intensity * 0.38})`;
      ctx.lineWidth = 1;
      ctx.fillRect(point.x - cellCanvasSize / 2, point.y - cellCanvasSize / 2, cellCanvasSize, cellCanvasSize);
      ctx.strokeRect(point.x - cellCanvasSize / 2, point.y - cellCanvasSize / 2, cellCanvasSize, cellCanvasSize);
    });
  }

  const cameraFreeCells = Array.isArray(cameraMap?.freeCells) ? cameraMap.freeCells : [];
  const cameraObstacleCells = Array.isArray(cameraMap?.cells) ? cameraMap.cells : [];
  if (!cameraFreeCells.length && !cameraObstacleCells.length) return;

  const rawCellSize = Number(cameraMap.cellSize);
  const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : 0.1;
  const cellCanvasSize = Math.max(4, cellSize * SCALE * 0.9);

  cameraFreeCells.forEach((cell) => {
    const confidenceRaw = Number(cell?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, confidenceRaw) : 0;
    const intensity = Math.max(0.12, Math.min(1, confidence / 10));
    const point = worldToCanvas(cell.x, cell.y);
    ctx.fillStyle = `rgba(45, 212, 191, ${0.06 + intensity * 0.16})`;
    ctx.strokeStyle = `rgba(20, 184, 166, ${0.10 + intensity * 0.22})`;
    ctx.lineWidth = 1;
    ctx.fillRect(point.x - cellCanvasSize / 2, point.y - cellCanvasSize / 2, cellCanvasSize, cellCanvasSize);
    ctx.strokeRect(point.x - cellCanvasSize / 2, point.y - cellCanvasSize / 2, cellCanvasSize, cellCanvasSize);
  });

  cameraObstacleCells.forEach((cell) => {
    const confidenceRaw = Number(cell?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, confidenceRaw) : 0;
    const intensity = Math.max(0.18, Math.min(1, confidence / 8));
    const point = worldToCanvas(cell.x, cell.y);
    ctx.fillStyle = `rgba(168, 85, 247, ${0.10 + intensity * 0.24})`;
    ctx.strokeStyle = `rgba(126, 34, 206, ${0.22 + intensity * 0.42})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, cellCanvasSize * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
};
