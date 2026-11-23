const worldBounds = require("../../shared/world-bounds.json");
const { createRaster, linearGradient, radialGradient } = require("./raster.cjs");

// Same frame as the planner canvas so exported maps line up with the editor.
const CANVAS_WIDTH = 1180;
const CANVAS_HEIGHT = 920;
const MAP_PADDING = 44;
const HALF_WIDTH = worldBounds.width / 2;
const HALF_HEIGHT = worldBounds.height / 2;
const SCALE = Math.min(
  (CANVAS_WIDTH - MAP_PADDING * 2) / worldBounds.width,
  (CANVAS_HEIGHT - MAP_PADDING * 2) / worldBounds.height,
);
const DRAWING_WIDTH = worldBounds.width * SCALE;
const DRAWING_HEIGHT = worldBounds.height * SCALE;
const DRAWING_LEFT = (CANVAS_WIDTH - DRAWING_WIDTH) / 2;
const DRAWING_TOP = (CANVAS_HEIGHT - DRAWING_HEIGHT) / 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const worldToCanvas = (x, y) => ({
  x: DRAWING_LEFT + (x + HALF_WIDTH) * SCALE,
  y: DRAWING_TOP + (HALF_HEIGHT - y) * SCALE,
});
const cellsOf = (map, key) => (Array.isArray(map?.[key]) ? map[key] : [])
  .filter((cell) => Number.isFinite(Number(cell?.x)) && Number.isFinite(Number(cell?.y)));

const drawPlannerBackground = (raster) => {
  raster.fillFrame(linearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, [[0, "#fafafa"], [1, "#e5e7eb"]]));
  raster.fillRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT, "#ffffff");
  raster.strokeRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT, 2, "#0f172a");
  for (const [stepMeters, width, color] of [[1, 1, "rgba(148, 163, 184, 0.18)"], [4, 1.5, "rgba(100, 116, 139, 0.28)"]]) {
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += stepMeters) {
      const from = worldToCanvas(x, -HALF_HEIGHT);
      const to = worldToCanvas(x, HALF_HEIGHT);
      raster.line(from.x, from.y, to.x, to.y, width, color);
    }
    for (let y = -HALF_HEIGHT; y <= HALF_HEIGHT; y += stepMeters) {
      const from = worldToCanvas(-HALF_WIDTH, y);
      const to = worldToCanvas(HALF_WIDTH, y);
      raster.line(from.x, from.y, to.x, to.y, width, color);
    }
  }
};

const renderLidarMap = (map) => {
  const raster = createRaster(CANVAS_WIDTH, CANVAS_HEIGHT);
  drawPlannerBackground(raster);
  const rawCellSize = Number(map?.cellSize);
  const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : 0.06;
  const size = Math.max(3, cellSize * SCALE * 0.92);
  for (const cell of cellsOf(map, "cells")) {
    const confidence = Math.max(0, Number(cell.confidence) || 0);
    const intensity = clamp(confidence / 6, 0.16, 1);
    const point = worldToCanvas(Number(cell.x), Number(cell.y));
    raster.fillRect(point.x - size / 2, point.y - size / 2, size, size, `rgba(14, 165, 233, ${0.12 + intensity * 0.3})`);
    raster.strokeRect(point.x - size / 2, point.y - size / 2, size, size, 1, `rgba(2, 132, 199, ${0.18 + intensity * 0.38})`);
  }
  return raster.toPng();
};

// Perspective "survey" view: free space as teal discs, obstacles as glowing columns.
const renderSurveyMap = (map) => {
  const raster = createRaster(CANVAS_WIDTH, CANVAS_HEIGHT);
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const centerX = width / 2;
  const floorTop = height * 0.14;
  const floorBottom = height * 0.94;
  const farWidth = width * 0.40;
  const nearWidth = width * 0.96;
  const floor = [
    [centerX - farWidth / 2, floorTop], [centerX + farWidth / 2, floorTop],
    [centerX + nearWidth / 2, floorBottom], [centerX - nearWidth / 2, floorBottom],
  ];

  raster.fillFrame(linearGradient(0, 0, width, height, [[0, "#07111f"], [0.48, "#121827"], [1, "#25113a"]]));
  raster.setClip(floor);
  raster.fillRect(0, floorTop, width, floorBottom - floorTop, linearGradient(0, floorTop, 0, floorBottom,
    [[0, "rgba(76,29,149,0.34)"], [0.58, "rgba(30,41,59,0.78)"], [1, "rgba(2,6,23,0.94)"]]));
  for (let depthIndex = 0; depthIndex <= 18; depthIndex += 1) {
    const t = depthIndex / 18;
    const y = floorTop + (floorBottom - floorTop) * t;
    const lineWidth = farWidth + (nearWidth - farWidth) * t;
    raster.line(centerX - lineWidth / 2, y, centerX + lineWidth / 2, y, 1, `rgba(148,163,184,${0.08 + t * 0.10})`);
  }
  for (let lateralIndex = -10; lateralIndex <= 10; lateralIndex += 1) {
    const offset = lateralIndex / 20;
    raster.line(centerX + offset * farWidth, floorTop, centerX + offset * nearWidth, floorBottom, 1, "rgba(148,163,184,0.12)");
  }

  const project = (cell) => {
    const x = clamp(Number(cell.x), -HALF_WIDTH, HALF_WIDTH);
    const y = clamp(Number(cell.y), -HALF_HEIGHT, HALF_HEIGHT);
    const depth = clamp((HALF_HEIGHT - y) / (HALF_HEIGHT * 2), 0, 1);
    const widthAtDepth = farWidth + (nearWidth - farWidth) * depth;
    return { x: centerX + (x / (HALF_WIDTH * 2)) * widthAtDepth, y: floorTop + depth * (floorBottom - floorTop), depth };
  };
  const ordered = (key) => cellsOf(map, key)
    .map((cell) => ({ cell, point: project(cell) }))
    .sort((left, right) => left.point.depth - right.point.depth);

  for (const { cell, point } of ordered("freeCells")) {
    const strength = clamp(Math.max(0, Number(cell.confidence) || 0) / 12, 0.12, 1);
    const radius = 3 + point.depth * 9 + strength * 4;
    const alpha = clamp(0.10 + strength * 0.28, 0.12, 0.42);
    raster.fillEllipse(point.x, point.y, radius * 1.75, radius * 0.62, 0, `rgba(45,212,191,${alpha})`);
    raster.strokeEllipse(point.x, point.y, radius * 1.75, radius * 0.62, 0, 1, `rgba(103,232,249,${alpha * 0.70})`);
  }

  for (const { cell, point } of ordered("cells")) {
    const strength = clamp(Math.max(0, Number(cell.confidence) || 0) / 9, 0.24, 1);
    const radius = 4 + point.depth * 8 + strength * 4;
    const columnHeight = 16 + point.depth * 48 + strength * 34;
    const alpha = clamp(0.28 + strength * 0.64, 0.32, 0.96);
    raster.fillEllipse(point.x, point.y, radius * 2.6, radius * 0.95, 0, radialGradient(point.x, point.y, 0, radius * 3.2, [
      [0, `rgba(217,70,239,${alpha * 0.46})`], [0.45, `rgba(124,58,237,${alpha * 0.24})`], [1, "rgba(124,58,237,0)"],
    ]));
    const topX = point.x - radius * 0.42;
    const topY = point.y - columnHeight;
    raster.line(point.x, point.y, topX, topY, Math.max(4, radius * 0.72), linearGradient(point.x, topY, point.x, point.y, [
      [0, `rgba(255,228,245,${alpha})`], [0.42, `rgba(232,121,249,${alpha * 0.96})`], [1, `rgba(126,34,206,${alpha * 0.20})`],
    ]));
    raster.fillEllipse(topX, topY, radius * 0.78, radius * 0.46, -0.25, `rgba(251,207,232,${alpha})`);
  }
  raster.setClip(null);

  raster.strokePolygon(floor, 2, "rgba(34,211,238,0.32)");
  const robotX = centerX;
  const robotY = floorBottom - 26;
  raster.fillEllipse(robotX, robotY, 30, 30, 0, radialGradient(robotX, robotY, 8, 30, [[0, "rgba(52,211,153,0.55)"], [1, "rgba(52,211,153,0)"]]));
  raster.fillEllipse(robotX, robotY, 10, 10, 0, "rgba(52,211,153,0.95)");
  raster.strokeEllipse(robotX, robotY, 10, 10, 0, 2, "rgba(236,253,245,0.92)");
  raster.line(robotX, robotY, centerX - farWidth / 2, floorTop, 2, "rgba(45,212,191,0.26)", [10, 12]);
  raster.line(robotX, robotY, centerX + farWidth / 2, floorTop, 2, "rgba(45,212,191,0.26)", [10, 12]);
  raster.fillFrame(radialGradient(centerX, height * 0.5, height * 0.12, height * 0.86, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.46)"]]));
  return raster.toPng();
};

const hasCells = (map) => cellsOf(map, "cells").length + cellsOf(map, "freeCells").length > 0;

const renderMapExport = ({ variant, map }) => {
  const normalized = variant === "camera" ? "camera" : "lidar";
  if (!hasCells(map)) {
    throw Object.assign(new Error(normalized === "camera" ? "Область обследования лидара пока пустая." : "Лидарная карта пока пустая."), { statusCode: 400 });
  }
  return {
    png: normalized === "camera" ? renderSurveyMap(map) : renderLidarMap(map),
    fileName: `${normalized === "camera" ? "lidar-survey-map" : "lidar-map"}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
  };
};

module.exports = { renderMapExport };
