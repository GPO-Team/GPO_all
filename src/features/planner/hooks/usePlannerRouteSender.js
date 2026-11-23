import { useRef, useEffect } from "react";
import { listMissions } from "../services/missionClient";
import { sendRouteChannelPayload } from "../services/routeChannel";
import { buildSceneSnapshot } from "../model/sceneSnapshot";
import {
  buildControllerRoutePayload,
  buildRouteCommand,
  buildRouteSentStatus,
} from "../model/routeCommand";

export const usePlannerRouteSender = ({
  algorithmKey,
  batteryRangeMeters,
  cruiseSpeedMps,
  energyOptions,
  optimizedRoute,
  payloadKg,
  plannerModel,
  routeSeed,
  routeSocketRef,
  routeTaskKey,
  selectedAlgorithmParams,
  setEnergyWarning,
  setStatus,
  onMissionSubmitted,
  setIsSubmitting,
  editingLockRef,
  isEditingLocked = () => false,
}) => {
  const pendingCommand = useRef(null);
  const recoveryRequest = useRef(null);
  useEffect(() => () => recoveryRequest.current?.abort(), []);
  const release = () => {
    if (editingLockRef) editingLockRef.current = false;
    setIsSubmitting?.(false);
  };
  return () => {
    if (isEditingLocked()) {
      setStatus(
        "Текущая миссия ещё активна. Сначала остановите её и дождитесь подтверждения.",
      );
      return;
    }
    if (!optimizedRoute.length) {
      setStatus("Сначала постройте маршрут.");
      return;
    }
    if (plannerModel.routeBlocked) {
      setStatus("Маршрут всё ещё пересекает ограничивающий контур.");
      return;
    }
    const payload = buildControllerRoutePayload({
      algorithmKey,
      batteryRangeMeters,
      cruiseSpeedMps,
      payloadKg,
      route: optimizedRoute,
      routeTaskKey,
      selectedAlgorithmParams,
    });
    payload.seedRoute = routeSeed.length > 1 ? routeSeed : optimizedRoute;
    payload.scene = buildSceneSnapshot({
      plannerModel,
      batteryRangeMeters,
      energyOptions,
    });
    const identity = JSON.stringify(payload);
    if (pendingCommand.current?.identity !== identity)
      pendingCommand.current = {
        identity,
        command: {
          ...buildRouteCommand(payload),
          requestId: crypto.randomUUID(),
        },
      };
    const command = pendingCommand.current.command;
    if (editingLockRef) editingLockRef.current = true;
    setIsSubmitting?.(true);
    setStatus("Сервис проверяет и сохраняет маршрут...");
    return sendRouteChannelPayload(routeSocketRef, command, {
      timeoutMs: 35000,
      onSent: (acknowledgement) => {
        setIsSubmitting?.(false);
        pendingCommand.current = null;
        setEnergyWarning("");
        setStatus(
          buildRouteSentStatus(
            acknowledgement.route?.length || optimizedRoute.length,
            acknowledgement.planning?.stationStopCount || 0,
          ),
        );
        onMissionSubmitted?.(acknowledgement);
      },
      onError: (error) => {
        setStatus(error.message);
        if (!error.mayHaveReachedRobot) {
          release();
          return;
        }
        setStatus(
          `${error.message} Команда могла дойти до робота: граф заблокирован до проверки состояния миссии.`,
        );
        recoveryRequest.current?.abort();
        const controller = new AbortController();
        recoveryRequest.current = controller;
        const reconcile = async () => {
          try {
            const records = await listMissions(
              AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
            );
            if (controller.signal.aborted) return;
            const active =
              records.find(
                (record) => record.missionId === command.requestId,
              ) ||
              records.find(
                (record) =>
                  !["completed", "failed", "cancelled"].includes(record.status),
              );
            if (active) {
              onMissionSubmitted?.(active);
              setIsSubmitting?.(false);
            } else release();
          } catch {
            if (!controller.signal.aborted) setTimeout(reconcile, 1000);
          }
        };
        void reconcile();
      },
    });
  };
};
