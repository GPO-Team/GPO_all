import coordinateContract from "../../../shared/coordinate-contract.json";
import { unwrapTelemetryEvent } from "../../../shared/contracts/index.js";
import { INITIAL_TELEMETRY } from "./dashboardTelemetryState";
import { normalizeTelemetryMap } from "./telemetryMaps";
import { normalizeNavigation } from "./telemetryNavigation";
import { normalizeCamera, normalizeObstacleTrace } from "./telemetryPerception";
import { pickNumber } from "./telemetryNumbers";
import { normalizeManipulator } from "./manipulatorTelemetry";

const TELEMETRY_MESSAGE_TYPE = coordinateContract.telemetry.messageType;
const TELEMETRY_POSE_KEY = coordinateContract.telemetry.poseKey;

export const normalizeTelemetry = (raw, prev = INITIAL_TELEMETRY) => {
  raw = unwrapTelemetryEvent(raw) ?? raw;
  if (!raw || typeof raw !== "object") return null;
  if (raw.type && raw.type !== TELEMETRY_MESSAGE_TYPE) return null;

  const pose = raw[TELEMETRY_POSE_KEY] || null;
  const x = pickNumber(pose?.x, raw.x);
  const y = pickNumber(pose?.y, raw.y);
  const z = pickNumber(pose?.z, raw.z, prev.z, 0);
  const yaw = pickNumber(pose?.yaw, raw.yaw, prev.yaw, 0);
  const simulationTime = pickNumber(raw.simulationTime, raw.time, prev.simulationTime);
  const navigation = normalizeNavigation(raw.navigation, prev.navigation);
  const rawObstacleTrace =
    (raw.perception && Array.isArray(raw.perception.obstacleTrace)
      ? raw.perception.obstacleTrace
      : null) ??
    (Array.isArray(raw.obstacleTrace) ? raw.obstacleTrace : null);
  const obstacleTrace = normalizeObstacleTrace(rawObstacleTrace, prev.obstacleTrace);
  const lidar = raw?.perception?.lidar ?? prev.perception?.lidar ?? null;
  const camera = normalizeCamera(raw?.perception?.camera ?? raw?.camera, prev.perception?.camera);
  const obstacleMap = normalizeTelemetryMap(raw?.obstacleMap, prev.obstacleMap);
  const cameraMap = normalizeTelemetryMap(
    raw?.cameraMap,
    prev.cameraMap || INITIAL_TELEMETRY.cameraMap
  );

  if (x === null || y === null) return null;
  return {
    simulationTime,
    x,
    y,
    z,
    yaw,
    navigation,
    manipulator: normalizeManipulator(raw.manipulator, prev.manipulator ?? null),
    obstacleTrace,
    obstacleMap,
    cameraMap,
    perception: {
      lidar,
      camera,
    },
  };
};
