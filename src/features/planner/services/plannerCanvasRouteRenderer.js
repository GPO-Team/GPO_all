import { worldToCanvas } from "../../../lib/zonePlanner";

export const renderPlannerLidarTrace = (ctx, obstacleTrace = []) => {
  obstacleTrace.forEach((point) => {
    const confidenceRaw = Number(point?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 1;
    const hit = worldToCanvas(point.x, point.y);
    ctx.fillStyle = `rgba(15, 118, 110, ${0.2 + confidence * 0.46})`;
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.08 + confidence * 0.24})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 1.4 + confidence * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
};

export const renderPlannerRouteLayer = (ctx, { optimizedRoute, routeBlocked }) => {
  if (optimizedRoute.length <= 1) return;
  ctx.strokeStyle = routeBlocked ? "#dc2626" : "#0f766e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  optimizedRoute.forEach((point, index) => {
    const currentPoint = worldToCanvas(point.x, point.y);
    if (index === 0) ctx.moveTo(currentPoint.x, currentPoint.y);
    else ctx.lineTo(currentPoint.x, currentPoint.y);
  });
  ctx.stroke();
};
