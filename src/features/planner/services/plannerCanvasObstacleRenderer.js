import { SCALE, worldToCanvas } from "../../../lib/zonePlannerCoordinates";

export const renderPlannerRuntimeObstacles = (ctx, obstacles = [], viewScale = 1) => {
  obstacles.forEach((obstacle, index) => {
    if (obstacle.status === "error") return;
    const topLeft = worldToCanvas(obstacle.x - obstacle.sizeX / 2, obstacle.y + obstacle.sizeY / 2);
    const width = obstacle.sizeX * SCALE;
    const height = obstacle.sizeY * SCALE;
    ctx.setLineDash(obstacle.status === "sending" ? [4 / viewScale, 3 / viewScale] : []);
    ctx.fillStyle = "rgba(194, 65, 37, 0.38)";
    ctx.strokeStyle = "#c24125";
    ctx.lineWidth = 1.5 / viewScale;
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    ctx.setLineDash([]);
    ctx.font = `600 ${12 / viewScale}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#9a3412";
    ctx.fillText(`П${index + 1}`, topLeft.x + width / 2, topLeft.y - 4 / viewScale);
  });
};
