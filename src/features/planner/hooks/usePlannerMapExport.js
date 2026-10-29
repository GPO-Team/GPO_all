import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  SCALE,
  drawPlannerBackground,
  worldToCanvas,
} from "../../../lib/zonePlanner";
import { hasMapData, normalizeMapExportVariant } from "../model/mapExport";
import { drawCameraMapExport } from "../services/mapExportRenderer";

export const usePlannerMapExport = ({
  setMapExportPromptOpen,
  setStatus,
  telemetry,
}) => {
  const requestMapExport = () => {
    if (!hasMapData(telemetry.obstacleMap) && !hasMapData(telemetry.cameraMap)) {
      setStatus("Пока нет накопленной карты препятствий для экспорта.");
      return;
    }
    setMapExportPromptOpen(true);
  };

  const exportMapImage = async (variant = "lidar") => {
    const normalizedVariant = normalizeMapExportVariant(variant);
    const selectedMap =
      normalizedVariant === "camera" ? telemetry.cameraMap : telemetry.obstacleMap;
    const selectedCells = Array.isArray(selectedMap?.cells) ? selectedMap.cells : [];
    const selectedFreeCells = Array.isArray(selectedMap?.freeCells)
      ? selectedMap.freeCells
      : [];
    if (!selectedCells.length && !selectedFreeCells.length) {
      setStatus(
        normalizedVariant === "camera"
          ? "Область обследования лидара пока пустая."
          : "Лидарная карта пока пустая."
      );
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_WIDTH;
    exportCanvas.height = CANVAS_HEIGHT;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      setStatus("Не удалось подготовить PNG-экспорт карты.");
      return;
    }
    if (normalizedVariant === "camera") {
      await drawCameraMapExport(ctx, exportCanvas, selectedMap, telemetry.perception?.camera);
    } else {
      drawPlannerBackground(ctx, [], { annotate: false });
      const rawCellSize = Number(selectedMap?.cellSize);
      const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : 0.06;
      const cellCanvasSize = Math.max(3, cellSize * SCALE * 0.92);
      selectedCells.forEach((cell) => {
        const confidenceRaw = Number(cell?.confidence);
        const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, confidenceRaw) : 0;
        const intensity = Math.max(0.16, Math.min(1, confidence / 6));
        const point = worldToCanvas(cell.x, cell.y);
        ctx.fillStyle = `rgba(14, 165, 233, ${0.12 + intensity * 0.3})`;
        ctx.strokeStyle = `rgba(2, 132, 199, ${0.18 + intensity * 0.38})`;
        ctx.lineWidth = 1;
        ctx.fillRect(
          point.x - cellCanvasSize / 2,
          point.y - cellCanvasSize / 2,
          cellCanvasSize,
          cellCanvasSize
        );
        ctx.strokeRect(
          point.x - cellCanvasSize / 2,
          point.y - cellCanvasSize / 2,
          cellCanvasSize,
          cellCanvasSize
        );
      });
    }

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `${normalizedVariant === "camera" ? "lidar-survey-map" : "lidar-map"}-${timestamp}.png`;
    link.click();
    setMapExportPromptOpen(false);
    setStatus(
      normalizedVariant === "camera"
        ? `Область обследования лидара сохранена в PNG: ${link.download}`
        : `Лидарная карта сохранена в PNG: ${link.download}`
    );
  };

  return { exportMapImage, requestMapExport };
};
