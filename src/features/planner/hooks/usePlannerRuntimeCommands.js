import { buildSceneSnapshot } from "../model/sceneSnapshot";
import { calculateSceneRevision } from "../model/sceneRevision";
import { useRef } from "react";
import { HALF_HEIGHT, HALF_WIDTH } from "../../../lib/zonePlanner";
import { pickRandomObstacleCenter, randomBetween } from "../model/randomObstacle";
import {
  buildMappingSurveyPayload,
  getMappingSurveyModeLabel,
} from "../model/runtimeCommands";
import { sendRouteChannelPayload } from "../services/routeChannel";

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
  const pendingSurvey = useRef(null);
  const pendingManipulation = useRef(null);
  const startPickPlace = async ({ objectDef, destination }) => {
    const payload = { type: "pick_place", objectDef, destination };
    const identity = JSON.stringify(payload);
    if (pendingManipulation.current?.identity !== identity) {
      pendingManipulation.current = { identity, command: { ...payload, requestId: crypto.randomUUID() } };
    }
    const command = pendingManipulation.current.command;
    let rejection;
    const accepted = await sendRouteChannelPayload(routeSocketRef, command, {
      timeoutMs: 35000,
      onSent: acknowledgement => {
        if (pendingManipulation.current?.command === command) pendingManipulation.current = null;
        onMissionSubmitted?.(acknowledgement);
        setStatus(`Миссия переноса объекта ${objectDef} сохранена. Ожидаем выполнения контроллером.`);
      },
      onError: error => { rejection = error; setStatus(error.message); },
    });
    if (!accepted) throw rejection || new Error("Bridge не подтвердил команду манипулятора.");
    return true;
  };
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
          `Команда добавления препятствия сохранена bridge: (${payload.obstacle.x.toFixed(2)}, ${payload.obstacle.y.toFixed(2)}).`
        ),
      onError: () =>
        setStatus("Не удалось отправить команду добавления препятствия."),
    });
  };

  const startMappingSurvey = () => {
    const payload = buildMappingSurveyPayload({
      batteryRangeMeters,
      field: {
        minX: -HALF_WIDTH,
        maxX: HALF_WIDTH,
        minY: -HALF_HEIGHT,
        maxY: HALF_HEIGHT,
      },
      mode: mappingSurveyMode,
      payloadKg,
    });
    const identity = JSON.stringify(payload);
    if (pendingSurvey.current?.identity !== identity) {
      pendingSurvey.current = {identity, command: {...payload, requestId: crypto.randomUUID()}};
    }
    const command = pendingSurvey.current.command;
    const modeLabel = getMappingSurveyModeLabel(mappingSurveyMode);
    return sendRouteChannelPayload(routeSocketRef, command, {
      timeoutMs: 35000,
      onSent: acknowledgement => {
        if (pendingSurvey.current?.command === command) pendingSurvey.current = null;
        onMissionSubmitted?.(acknowledgement);
        setStatus(
          `Команда обследования сохранена bridge: скорость 0.8 м/с, сначала периметр, затем "${modeLabel}".`
        );
      },
      onError: error => setStatus(error.message),
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

  return { addRandomObstacle, startMappingSurvey, startPickPlace, startObjectTransfer };
};
