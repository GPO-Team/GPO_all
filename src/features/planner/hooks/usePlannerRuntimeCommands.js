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

  return { addRandomObstacle, startMappingSurvey };
};
