import { worldToCanvas } from "../../../lib/zonePlanner";

export const renderPlannerZoneLayer = (ctx, zoneEntries, viewScale = 1, dark = false) => {
  const scale = Number.isFinite(viewScale) && viewScale > 0 ? viewScale : 1;
  zoneEntries.forEach((zone) => {
    const points = zone.points.map((entry) => worldToCanvas(entry.point.x, entry.point.y));
    const closed = zone.closed && points.length >= 3;
    if (points.length > 1) {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (closed) {
        ctx.closePath();
        ctx.fillStyle = dark ? "rgba(132, 153, 168, 0.18)" : "rgba(113, 132, 146, 0.13)";
        ctx.fill();
        ctx.save();
        ctx.clip();
        const minX = Math.min(...points.map((point) => point.x));
        const maxX = Math.max(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxY = Math.max(...points.map((point) => point.y));
        const spacing = 12 / scale;
        ctx.strokeStyle = dark ? "rgba(189, 213, 225, 0.55)" : "rgba(71, 99, 117, 0.48)";
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        for (let x = minX - (maxY - minY); x <= maxX; x += spacing) {
          ctx.moveTo(x, maxY);
          ctx.lineTo(x + (maxY - minY), minY);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (closed) ctx.closePath();
      ctx.setLineDash(closed ? [] : [7 / scale, 5 / scale]);
      ctx.strokeStyle = zone.color.stroke;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    points.forEach((point, index) => {
      ctx.fillStyle = zone.color.stroke;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${7 / scale}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(zone.points[index].order), point.x, point.y);
    });
    if (points.length) {
      ctx.fillStyle = dark ? "#deedf5" : zone.color.stroke;
      ctx.font = `600 ${11 / scale}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(zone.closed ? `${zone.name} (замкнута)` : `${zone.name} (открыта)`, points[0].x + 9 / scale, points[0].y - 7 / scale);
    }
  });
};
