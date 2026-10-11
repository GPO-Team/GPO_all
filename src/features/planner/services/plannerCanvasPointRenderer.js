import { POINT_KIND_META, worldToCanvas } from "../../../lib/zonePlanner";

export const renderPlannerPointLayer = (ctx, state) => {
  const markerScale = state.markerScale || 1;
  state.chargeEntries.forEach((entry) => {
    const point = worldToCanvas(entry.point.x, entry.point.y);
    const hovered = state.hoveredPointIndex === entry.index;
    if (hovered) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.8)";
      ctx.lineWidth = 4 / markerScale;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 18 / markerScale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = POINT_KIND_META.charge.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 11 / markerScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 53, 15, 0.7)";
    ctx.lineWidth = 2 / markerScale;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${11 / markerScale}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`C${entry.order}`, point.x, point.y);
  });

  state.visitEntries.forEach((entry) => {
    const plannedEntry = state.plannedVisitEntryMap.get(entry.index);
    const point = worldToCanvas(entry.point.x, entry.point.y);
    const hovered = state.hoveredPointIndex === entry.index;
    if (plannedEntry?.adjusted) {
      const projected = worldToCanvas(plannedEntry.plannedPoint.x, plannedEntry.plannedPoint.y);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2 / markerScale;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(projected.x, projected.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, 8 / markerScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / markerScale;
      ctx.stroke();
      ctx.fillStyle = "#92400e";
      ctx.font = `700 ${11 / markerScale}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`V${entry.order} -> S${entry.order}`, projected.x + 12 / markerScale, projected.y - 8 / markerScale);
      if (hovered) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
        ctx.lineWidth = 3 / markerScale;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 14 / markerScale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (hovered) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 4 / markerScale;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 18 / markerScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#1d4ed8";
      ctx.font = `700 ${11 / markerScale}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`V${entry.order}`, point.x + 14 / markerScale, point.y - 12 / markerScale);
    }
    ctx.fillStyle = POINT_KIND_META.visit.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 13 / markerScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${12 / markerScale}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3 / markerScale;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.strokeText(String(entry.order), point.x, point.y);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(entry.order), point.x, point.y);
  });

};

export const renderPlannerRobot = (ctx, state, telemetry) => {
  if (state.mapLayers?.robot === false) return;
  const markerScale = state.markerScale || 1;
  const robot = worldToCanvas(telemetry.x, telemetry.y);
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(robot.x, robot.y, 11 / markerScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 4 / markerScale;
  ctx.beginPath();
  ctx.moveTo(robot.x, robot.y);
  ctx.lineTo(robot.x + Math.cos(telemetry.yaw) * 24 / markerScale, robot.y - Math.sin(telemetry.yaw) * 24 / markerScale);
  ctx.stroke();
};
