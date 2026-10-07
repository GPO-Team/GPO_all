const path = require("path");
const { clamp } = require("../protocol/number-normalization.cjs");

const resolveCameraFrameMimeType = (frameFile, rawMimeType) => {
  if (typeof rawMimeType === "string" && rawMimeType.startsWith("image/")) {
    return rawMimeType;
  }
  const extension = path.extname(frameFile || "").toLowerCase();
  if (extension === ".bmp") return "image/bmp";
  if (extension === ".png") return "image/png";
  return "image/jpeg";
};

const normalizeObstacleMap = (rawMap, fallback = null) => {
  const fallbackMap = fallback && typeof fallback === "object" ? fallback : {};
  const normalizeCells = (rawCells, limit) =>
    rawCells
      .map((cell) => ({
        x: Number(cell?.x),
        y: Number(cell?.y),
        confidence: Number(cell?.confidence),
      }))
      .filter((cell) => Number.isFinite(cell.x) && Number.isFinite(cell.y))
      .map((cell) => ({
        x: cell.x,
        y: cell.y,
        confidence: Number.isFinite(cell.confidence) ? Math.max(0, cell.confidence) : 0,
      }))
      .slice(-limit);
  const rawCells = Array.isArray(rawMap?.cells)
    ? rawMap.cells
    : Array.isArray(fallbackMap?.cells)
      ? fallbackMap.cells
      : [];
  const rawFreeCells = Array.isArray(rawMap?.freeCells)
    ? rawMap.freeCells
    : Array.isArray(fallbackMap?.freeCells)
      ? fallbackMap.freeCells
      : [];
  const cells = normalizeCells(rawCells, 4096);
  const freeCells = normalizeCells(rawFreeCells, 4096);
  const cellSize = Number(rawMap?.cellSize ?? fallbackMap?.cellSize);
  const cellCount = Number(
    rawMap?.totalCells ?? rawMap?.cellCount ?? fallbackMap?.cellCount ?? cells.length
  );
  const obstacleCellCount = Number(
    rawMap?.obstacleCellCount ?? fallbackMap?.obstacleCellCount ?? cells.length
  );
  const freeCellCount = Number(
    rawMap?.freeCellCount ?? fallbackMap?.freeCellCount ?? freeCells.length
  );

  return {
    cellSize: Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 0.06,
    cellCount: Number.isFinite(cellCount) && cellCount >= 0 ? cellCount : cells.length,
    obstacleCellCount:
      Number.isFinite(obstacleCellCount) && obstacleCellCount >= 0
        ? obstacleCellCount
        : cells.length,
    freeCellCount:
      Number.isFinite(freeCellCount) && freeCellCount >= 0
        ? freeCellCount
        : freeCells.length,
    mapFile:
      typeof fallbackMap?.mapFile === "string" && fallbackMap.mapFile.trim()
        ? fallbackMap.mapFile
        : "obstacle_map.json",
    jsonFile:
      typeof fallbackMap?.jsonFile === "string" && fallbackMap.jsonFile.trim()
        ? fallbackMap.jsonFile
        : "obstacle_map.json",
    excelCsvFile:
      typeof fallbackMap?.excelCsvFile === "string" && fallbackMap.excelCsvFile.trim()
        ? fallbackMap.excelCsvFile
        : "obstacle_map.csv",
    imageFile:
      typeof fallbackMap?.imageFile === "string" && fallbackMap.imageFile.trim()
        ? fallbackMap.imageFile
        : "obstacle_map.png",
    cells,
    freeCells,
  };
};

const normalizeCameraTelemetry = (rawCamera) => {
  if (!rawCamera || typeof rawCamera !== "object") return null;
  const numeric = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const frameFile =
    typeof rawCamera.frameFile === "string" && rawCamera.frameFile.trim()
      ? path.basename(rawCamera.frameFile)
      : "camera_frame.bmp";

  return {
    enabled: Boolean(rawCamera.enabled),
    width: numeric(rawCamera.width),
    height: numeric(rawCamera.height),
    fov: numeric(rawCamera.fov),
    frameFile,
    mimeType: resolveCameraFrameMimeType(frameFile, rawCamera.mimeType),
    mode:
      typeof rawCamera.mode === "string" && rawCamera.mode.trim()
        ? rawCamera.mode
        : "webots_camera",
    frameSequence: numeric(rawCamera.frameSequence),
    capturedAt: numeric(rawCamera.capturedAt),
    obstacleVisible: Boolean(rawCamera.obstacleVisible),
    obstacleScore: numeric(rawCamera.obstacleScore),
    obstacleOffset: numeric(rawCamera.obstacleOffset),
    obstacleAngle: numeric(rawCamera.obstacleAngle),
    obstacleRange: numeric(rawCamera.obstacleRange),
    detectionCount: numeric(rawCamera.detectionCount),
  };
};

const createTelemetryNormalizer = (coordinateContract) => {
  const messageType = coordinateContract.telemetry.messageType;
  const poseKey = coordinateContract.telemetry.poseKey;

  return (raw, rawMap = null, rawCameraMap = null) => {
    const pose = raw?.[poseKey] || null;
    const x = Number(pose?.x ?? raw?.robot?.x ?? raw?.x);
    const y = Number(pose?.y ?? raw?.robot?.y ?? raw?.robot?.z ?? raw?.y);
    const z = Number(pose?.z ?? raw?.robot?.z ?? raw?.z ?? 0);
    const yaw = Number(pose?.yaw ?? raw?.robot?.yaw ?? raw?.robot?.heading ?? raw?.yaw);
    if (![x, y, z, yaw].every(Number.isFinite)) return null;

    const obstacleTrace = Array.isArray(raw?.perception?.obstacleTrace)
      ? raw.perception.obstacleTrace
          .map((point) => ({
            x: Number(point?.x),
            y: Number(point?.y),
            confidence: Number(point?.confidence),
          }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
          .map((point) => ({
            x: point.x,
            y: point.y,
            confidence: Number.isFinite(point.confidence) ? clamp(point.confidence, 0, 1) : 1,
          }))
      : [];
    const obstacleMap = normalizeObstacleMap(rawMap, raw?.obstacleMap || null);
    const cameraMap = normalizeObstacleMap(rawCameraMap, raw?.cameraMap || null);
    const camera = normalizeCameraTelemetry(raw?.perception?.camera ?? raw?.camera);

    return {
      type: messageType,
      coordinateContractVersion: coordinateContract.version,
      pose: { x, y, z, yaw },
      x,
      y,
      z,
      yaw,
      navigation: raw?.navigation || null,
      objectTransfer: raw?.objectTransfer || null,
      perception: {
        lidar: raw?.perception?.lidar || null,
        camera,
        obstacleTrace,
      },
      camera,
      obstacleMap,
      cameraMap,
      obstacleTrace,
      simulationTime: Number(raw?.simulationTime) || 0,
    };
  };
};

module.exports = {
  createTelemetryNormalizer,
  normalizeCameraTelemetry,
  normalizeObstacleMap,
  resolveCameraFrameMimeType,
};
