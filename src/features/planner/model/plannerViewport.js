import { DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT } from "../../../lib/zonePlannerCoordinates";

export const clampZoom = (zoom) => Math.min(8, Math.max(0.25, zoom));

export const getMapScaleBar = (pixelsPerMeter, targetWidth = 120) => {
  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null;
  const targetMeters = targetWidth / pixelsPerMeter;
  const power = 10 ** Math.floor(Math.log10(targetMeters));
  const unit = targetMeters / power;
  const meters = (unit >= 5 ? 5 : unit >= 2 ? 2 : 1) * power;
  return { meters: Number(meters.toPrecision(6)), width: meters * pixelsPerMeter };
};

// Logical map coordinates stay independent of CSS pixels and the backing bitmap.
export const createViewport = (width, height, zoom = 1, pan = { x: 0, y: 0 }) => {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const fitScale = Math.min(width / DRAWING_WIDTH, height / DRAWING_HEIGHT);
  const scale = fitScale * zoom;
  return {
    width, height, scale, fitScale, zoom,
    x: (width - DRAWING_WIDTH * scale) / 2 - DRAWING_LEFT * scale + pan.x,
    y: (height - DRAWING_HEIGHT * scale) / 2 - DRAWING_TOP * scale + pan.y,
  };
};

export const screenToMap = (viewport, point) => ({
  x: (point.x - viewport.x) / viewport.scale,
  y: (point.y - viewport.y) / viewport.scale,
});

export const zoomAt = (viewport, anchor, zoom, nextZoom, pan) => {
  const ratio = nextZoom / zoom;
  return {
    x: (pan.x - (anchor.x - viewport.width / 2)) * ratio + anchor.x - viewport.width / 2,
    y: (pan.y - (anchor.y - viewport.height / 2)) * ratio + anchor.y - viewport.height / 2,
  };
};

export const getCanvasEventPosition = (canvas, event) => {
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (canvas.plannerViewport) return screenToMap(canvas.plannerViewport, point);
  return { x: point.x * canvas.width / rect.width, y: point.y * canvas.height / rect.height };
};
