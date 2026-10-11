import { HALF_HEIGHT, HALF_WIDTH } from "../../../lib/zonePlanner";
import { pickRandomObstacleCenter, randomBetween } from "../model/randomObstacle";
import {
  buildMappingSurveyPayload,
  getMappingSurveyModeLabel,
} from "../model/runtimeCommands";
import { sendRouteChannelPayload } from "../services/routeChannel";
import { buildSceneSnapshot } from "../model/sceneSnapshot";
import { calculateSceneRevision } from "../model/sceneRevision";

export const usePlannerRuntimeCommands = ({
  batteryRangeMeters,
  mappingSurveyMode,
  optimizedRoute,
  payloadKg,
  plannerModel,
  points,
  routeSocketRef,
  setStatus,
  telemetry,
  onMissionSubmitted,
}) => {
  const addRandomObstacle = () => {
    const obstacle = {
      sizeX: Number(randomBetween(0.46, 1.15).toFixed(3)),
      sizeY: Number(randomBetween(0.38, 0.95).toFixed(3)),
      height: Number(randomBetween(0.32, 0.9).toFixed(3)),
    };
    const center = pickRandomObstacleCenter({
      telemetry,
      optimizedRoute,
      points,
      polygons: plannerModel.polygons,
      obstacle,
    });
    if (!center) {
      setStatus("Не удалось подобрать безопасное место для случайного препятствия.");
      return;
    }
    const payload = {
      type: "spawn_random_obstacle",
      commandId: Date.now(),
      obstacle: {
        x: Number(center.x.toFixed(4)),
        y: Number(center.y.toFixed(4)),
        ...obstacle,
      },
    };
    sendRouteChannelPayload(routeSocketRef, payload, {
      onSent: () =>
        setStatus(
          `Препятствие запрошено в Webots: X ${payload.obstacle.x.toFixed(2)} м, Y ${payload.obstacle.y.toFixed(2)} м. На веб-карте появится после обнаружения лидаром.`
        ),
      onError: (error) =>
        setStatus(`Не удалось добавить препятствие: ${error.message}`),
    });
  };

  const startMappingSurvey = () => {
    const payload = buildMappingSurveyPayload({
      batteryRangeMeters,
      commandId: Date.now(),
      field: {
        minX: -HALF_WIDTH,
        maxX: HALF_WIDTH,
        minY: -HALF_HEIGHT,
        maxY: HALF_HEIGHT,
      },
      mode: mappingSurveyMode,
      payloadKg,
    });
    const modeLabel = getMappingSurveyModeLabel(mappingSurveyMode);
    sendRouteChannelPayload(routeSocketRef, payload, {
      onSent: () =>
        setStatus(
          `Команда обследования сохранена bridge: скорость 0.8 м/с, сначала периметр, затем "${modeLabel}".`
        ),
      onError: () => setStatus("Не удалось отправить команду объезда карты."),
    });
  };

  const startObjectTransfer = async destination => {
    const snapshot = buildSceneSnapshot({
      plannerModel,
      batteryRangeMeters,
      energyOptions: { speedMps: 0.22, payloadKg },
    });
    // Keep the same normalized key order used by the bridge before hashing.
    const scene = {
      polygons: snapshot.polygons.map((zone, index) => ({
        id: String(zone.id || `zone-${index + 1}`).trim(),
        name: String(zone.name || `Zone ${index + 1}`).trim(),
        points: zone.points.map(point => ({ x: Number(point.x), y: Number(point.y) })),
      })),
      surfaceZones: snapshot.surfaceZones.map((zone, index) => ({
        id: String(zone.id || `surface-zone-${index + 1}`).trim(),
        name: String(zone.name || `Surface ${index + 1}`).trim(),
        surfaceKey: ["neutral", "rough", "slippery"].includes(zone.surfaceKey) ? zone.surfaceKey : "neutral",
        points: zone.points.map(point => ({ x: Number(point.x), y: Number(point.y) })),
      })),
      chargingStations: snapshot.chargingStations.map(point => ({ x: Number(point.x), y: Number(point.y) })),
      motion: {
        cruiseSpeedMps: Number(snapshot.motion.cruiseSpeedMps),
        payloadKg: Number(snapshot.motion.payloadKg),
        batteryRange: Number(snapshot.motion.batteryRange),
      },
    };
    const payload = {
      type: "transfer_object",
      objectId: "demo-box",
      destination,
      scene,
      sceneRevision: await calculateSceneRevision(scene),
    };
    setStatus("Сервис проверяет миссию переноса...");
    return sendRouteChannelPayload(routeSocketRef, payload, {
      timeoutMs: 35000,
      onSent: acknowledgement => {
        setStatus(`Перенос demo-box запущен в точку (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}).`);
        onMissionSubmitted?.(acknowledgement);
      },
      onError: error => setStatus(error.message),
    });
  };

  return { addRandomObstacle, startMappingSurvey, startObjectTransfer };
};
