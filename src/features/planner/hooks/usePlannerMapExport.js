import { MAP_EXPORT_URL } from "../../../lib/runtimeConfig";
import { hasMapData, normalizeMapExportVariant } from "../model/mapExport";

// The planning service renders the PNG; the browser only sends the map and saves the file.
const requestMapPng = async (variant, map) => {
  const response = await fetch(MAP_EXPORT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant, map: { cellSize: map?.cellSize, cells: map?.cells || [], freeCells: map?.freeCells || [] } }),
  }).catch(() => {
    throw new Error("Planning service недоступен: PNG карты строится на сервере.");
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Не удалось построить PNG карты.");
  }
  return { blob: await response.blob(), fileName: response.headers.get("X-File-Name") };
};

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
    if (!hasMapData(selectedMap)) {
      setStatus(
        normalizedVariant === "camera"
          ? "Область обследования лидара пока пустая."
          : "Лидарная карта пока пустая."
      );
      return;
    }

    setStatus("Строим PNG карты на сервере…");
    try {
      const { blob, fileName } = await requestMapPng(normalizedVariant, selectedMap);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName || `${normalizedVariant === "camera" ? "lidar-survey-map" : "lidar-map"}-${timestamp}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      setMapExportPromptOpen(false);
      setStatus(
        normalizedVariant === "camera"
          ? `Область обследования лидара сохранена в PNG: ${link.download}`
          : `Лидарная карта сохранена в PNG: ${link.download}`
      );
    } catch (error) {
      setStatus(error.message);
    }
  };

  return { exportMapImage, requestMapExport };
};
