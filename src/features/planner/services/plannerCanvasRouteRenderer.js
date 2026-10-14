import { worldToCanvas } from "../../../lib/zonePlanner";

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
