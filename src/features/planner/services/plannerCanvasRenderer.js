import { getSurfaceProfileByKey } from "../../../lib/energyModel";
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, DRAWING_HEIGHT, DRAWING_LEFT, DRAWING_TOP,
  DRAWING_WIDTH, HALF_HEIGHT, HALF_WIDTH, worldToCanvas,
} from "../../../lib/zonePlannerCoordinates";
import { DEFAULT_SURFACE_ZONES } from "../../../lib/zonePlannerPresentation";

export const drawDiamond = (ctx, x, y, radius) => {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
};

const drawSurfaceZones = (ctx, surfaceZones = DEFAULT_SURFACE_ZONES) => {
  for (const zone of surfaceZones || []) {
    if (!Array.isArray(zone?.points) || zone.points.length < 1) continue;
    const profile = getSurfaceProfileByKey(zone.surfaceKey);
    const closed = zone.closed !== false && zone.points.length >= 3;
    ctx.beginPath();
    zone.points.forEach((point, index) => {
      const canvasPoint = worldToCanvas(point.x, point.y);
      if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
      else ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    if (closed) {
      ctx.closePath();
      ctx.fillStyle = profile.fill;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = profile.stroke;
      ctx.lineWidth = 1;
      const bounds = zone.points.reduce((acc, point) => {
        const canvasPoint = worldToCanvas(point.x, point.y);
        return { minX: Math.min(acc.minX, canvasPoint.x), minY: Math.min(acc.minY, canvasPoint.y), maxX: Math.max(acc.maxX, canvasPoint.x), maxY: Math.max(acc.maxY, canvasPoint.y) };
      }, { minX: CANVAS_WIDTH, minY: CANVAS_HEIGHT, maxX: 0, maxY: 0 });
      for (let x = bounds.minX - 60; x <= bounds.maxX + 60; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, bounds.maxY + 24);
        ctx.lineTo(x + 80, bounds.minY - 24);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.beginPath();
    zone.points.forEach((point, index) => {
      const canvasPoint = worldToCanvas(point.x, point.y);
      if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
      else ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    if (closed) ctx.closePath();
    if (!closed) ctx.setLineDash([8, 6]);
    ctx.strokeStyle = profile.stroke;
    ctx.lineWidth = closed ? 1.2 : 1.8;
    ctx.stroke();
    ctx.setLineDash([]);
    zone.points.forEach((point, index) => {
      const canvasPoint = worldToCanvas(point.x, point.y);
      ctx.fillStyle = profile.stroke;
      ctx.beginPath();
      ctx.arc(canvasPoint.x, canvasPoint.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.font = "700 8px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), canvasPoint.x, canvasPoint.y);
    });
    const center = zone.points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    center.x /= zone.points.length;
    center.y /= zone.points.length;
    const centerCanvas = worldToCanvas(center.x, center.y);
    ctx.fillStyle = "rgba(30, 41, 59, 0.68)";
    ctx.font = "600 10px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(closed ? profile.label : `${profile.label} (черновик)`, centerCanvas.x, centerCanvas.y);
  }
};

export const drawPlannerBackground = (ctx, surfaceZones = DEFAULT_SURFACE_ZONES, options = {}) => {
  const { annotate = true, border = true, grid = true } = options;
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#fafafa");
  gradient.addColorStop(1, "#e5e7eb");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  if (border) ctx.strokeRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT);
  drawSurfaceZones(ctx, surfaceZones);
  if (grid) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 1) {
      const from = worldToCanvas(x, -HALF_HEIGHT);
      const to = worldToCanvas(x, HALF_HEIGHT);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    for (let y = -HALF_HEIGHT; y <= HALF_HEIGHT; y += 1) {
      const from = worldToCanvas(-HALF_WIDTH, y);
      const to = worldToCanvas(HALF_WIDTH, y);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(100, 116, 139, 0.28)";
    ctx.lineWidth = 1.5;
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 4) {
      const from = worldToCanvas(x, -HALF_HEIGHT);
      const to = worldToCanvas(x, HALF_HEIGHT);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    for (let y = -HALF_HEIGHT; y <= HALF_HEIGHT; y += 4) {
      const from = worldToCanvas(-HALF_WIDTH, y);
      const to = worldToCanvas(HALF_WIDTH, y);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
  }
  if (!annotate) return;
  const verticalAxisTop = worldToCanvas(0, HALF_HEIGHT);
  const verticalAxisBottom = worldToCanvas(0, -HALF_HEIGHT);
  const horizontalAxisLeft = worldToCanvas(-HALF_WIDTH, 0);
  const horizontalAxisRight = worldToCanvas(HALF_WIDTH, 0);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(verticalAxisTop.x, verticalAxisTop.y);
  ctx.lineTo(verticalAxisBottom.x, verticalAxisBottom.y);
  ctx.moveTo(horizontalAxisLeft.x, horizontalAxisLeft.y);
  ctx.lineTo(horizontalAxisRight.x, horizontalAxisRight.y);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Y", verticalAxisTop.x + 8, verticalAxisTop.y + 18);
  ctx.fillText("X", horizontalAxisRight.x - 18, horizontalAxisRight.y - 8);
};
