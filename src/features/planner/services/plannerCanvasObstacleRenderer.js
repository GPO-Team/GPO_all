import { SCALE, worldToCanvas } from "../../../lib/zonePlannerCoordinates";

export const renderPlannerRuntimeObstacles = (ctx, obstacles = [], viewScale = 1, activeObstacleId, dark = false) => {
  obstacles.forEach((obstacle, index) => {
    if (obstacle.status === "error" && !obstacle.confirmed) return;
    const topLeft = worldToCanvas(obstacle.x - obstacle.sizeX / 2, obstacle.y + obstacle.sizeY / 2);
    const width = obstacle.sizeX * SCALE;
    const height = obstacle.sizeY * SCALE;
    ctx.setLineDash(obstacle.status === "sending" ? [4 / viewScale, 3 / viewScale] : []);
    ctx.fillStyle = dark ? "rgba(150, 173, 191, 0.58)" : "rgba(120, 141, 158, 0.45)";
    ctx.strokeStyle = dark ? "#c2d8e3" : "#526d80";
    ctx.lineWidth = 1.5 / viewScale;
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    ctx.setLineDash([]);
    ctx.font = `600 ${12 / viewScale}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = dark ? "#e0edf3" : "#39576c";
    ctx.fillText(`П${index + 1}`, topLeft.x + width / 2, topLeft.y - 4 / viewScale);
    if (activeObstacleId != null && obstacle.commandId === activeObstacleId) {
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 2.5 / viewScale;
      ctx.strokeRect(topLeft.x, topLeft.y, width, height);
      const size = 9 / viewScale;
      ctx.fillStyle = "#fff";
      ctx.fillRect(topLeft.x + width - size / 2, topLeft.y + height - size / 2, size, size);
      ctx.strokeRect(topLeft.x + width - size / 2, topLeft.y + height - size / 2, size, size);
    }
  });
};
