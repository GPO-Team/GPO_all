import { useRef, useState } from "react";
import { HALF_HEIGHT, HALF_WIDTH } from "../../../lib/zonePlanner";
import { pickRandomObstacleCenter, randomBetween } from "../model/randomObstacle";
import {
  buildMappingSurveyPayload,
  getMappingSurveyModeLabel,
} from "../model/runtimeCommands";
import { sendRouteChannelPayload } from "../services/routeChannel";
import { buildSceneSnapshot } from "../model/sceneSnapshot";
import { calculateSceneRevision } from "../model/sceneRevision";
import { normalizeRuntimeObstacle } from "../model/runtimeObstacles";

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

  const [runtimeObstacles, setRuntimeObstacles] = useState([]);
  const obstaclesRef = useRef([]);
  const [activeRuntimeObstacleId, setActiveRuntimeObstacleId] = useState(null);
  const commitObstacles = (update) => {
    obstaclesRef.current = update(obstaclesRef.current);
    setRuntimeObstacles(obstaclesRef.current);
  };
  const lastObstacleCommandId = useRef(0);
  const nextCommandId = () => {
    lastObstacleCommandId.current = Math.max(Date.now(), lastObstacleCommandId.current + 1);
    return lastObstacleCommandId.current;
  };
  const updateObstacle = (commandId, patch) => commitObstacles((previous) =>
    previous.map((item) => item.commandId === commandId ? { ...item, ...patch } : item));
  const editRuntimeObstacle = (obstacleId, rawGeometry) => {
    const item = obstaclesRef.current.find((obstacle) => obstacle.commandId === obstacleId);
    if (!item?.confirmed || ["updating", "deleting"].includes(item.status)) return;
    let geometry;
    try { geometry = normalizeRuntimeObstacle(rawGeometry); }
    catch (error) { setStatus(error.message); return; }
    updateObstacle(obstacleId, { status: "updating", error: null });
    return sendRouteChannelPayload(routeSocketRef, {
      type: "update_runtime_obstacle", commandId: nextCommandId(), obstacleId, obstacle: geometry,
    }, {
      onSent: () => {
        updateObstacle(obstacleId, { ...geometry, status: "accepted", error: null });
        setStatus("Изменение препятствия принято bridge.");
      },
      onError: (error) => {
        updateObstacle(obstacleId, { status: "error", error: error.message });
        setStatus(`Не удалось изменить препятствие: ${error.message}`);
      },
    });
  };
  const deleteRuntimeObstacle = (obstacleId) => {
    const item = obstaclesRef.current.find((obstacle) => obstacle.commandId === obstacleId);
    if (!item || ["sending", "updating", "deleting"].includes(item.status)) return;
    const remove = () => {
      commitObstacles((previous) => previous.filter((obstacle) => obstacle.commandId !== obstacleId));
      setActiveRuntimeObstacleId((previous) => previous === obstacleId ? null : previous);
    };
    if (!item.confirmed) { remove(); return; }
    updateObstacle(obstacleId, { status: "deleting", error: null });
    return sendRouteChannelPayload(routeSocketRef, {
      type: "delete_runtime_obstacle", commandId: nextCommandId(), obstacleId,
    }, {
      onSent: () => { remove(); setStatus("Удаление препятствия принято bridge."); },
      onError: (error) => {
        updateObstacle(obstacleId, { status: "error", error: error.message });
        setStatus(`Не удалось удалить препятствие: ${error.message}`);
      },
    });
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
      commandId: nextCommandId(),
      obstacle: {
        x: Number(center.x.toFixed(4)),
        y: Number(center.y.toFixed(4)),
        ...obstacle,
      },
    };
    payload.obstacleId = payload.commandId;
    commitObstacles((previous) => [...previous, {
      ...payload.obstacle, commandId: payload.commandId, status: "sending",
    }]);
    sendRouteChannelPayload(routeSocketRef, payload, {
      onSent: () => {
        updateObstacle(payload.commandId, { status: "accepted", confirmed: true });
        setStatus(
          `Команда препятствия принята: X ${payload.obstacle.x.toFixed(2)} м, Y ${payload.obstacle.y.toFixed(2)} м. Размер ${obstacle.sizeX} × ${obstacle.sizeY} м.`
        );
      },
      onError: (error) => {
        updateObstacle(payload.commandId, { status: "error", error: error.message });
        setStatus(`Не удалось добавить препятствие: ${error.message}`);
      },
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

  const setManipulatorPose = pose => sendRouteChannelPayload(
    routeSocketRef,
    { type: "set_manipulator_pose", pose, commandId: Date.now() },
    {
      onSent: () => setStatus(`Манипулятор переводится в позу «${pose}».`),
      onError: error => setStatus(error.message),
    }
  );

  return { runtimeObstacles, activeRuntimeObstacleId, selectRuntimeObstacle: setActiveRuntimeObstacleId,
    editRuntimeObstacle, deleteRuntimeObstacle, addRandomObstacle, setManipulatorPose,
    startMappingSurvey, startPickPlace, startObjectTransfer };
};
