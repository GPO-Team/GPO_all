import { SCALE, worldToCanvas } from "../../../lib/zonePlanner";

// Sensor data remains available for navigation and map export.
export const renderPlannerSensorLayers = (ctx, { cameraMap }) => {
  const cells = Array.isArray(cameraMap?.cells) ? cameraMap.cells : [];
  if (!cells.length) return;
  const rawSize = Number(cameraMap.cellSize);
  const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 0.1;
  const canvasSize = Math.max(4, size * SCALE * 0.9);
  cells.forEach((cell) => {
    if (!Number.isFinite(cell?.x) || !Number.isFinite(cell?.y)) return;
    const rawConfidence = Number(cell.confidence);
    const confidence = Number.isFinite(rawConfidence) ? Math.max(0, rawConfidence) : 0;
    const intensity = Math.max(0.18, Math.min(1, confidence / 8));
    const point = worldToCanvas(cell.x, cell.y);
    ctx.fillStyle = `rgba(168, 85, 247, ${0.10 + intensity * 0.24})`;
    ctx.strokeStyle = `rgba(126, 34, 206, ${0.22 + intensity * 0.42})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, canvasSize * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
};
