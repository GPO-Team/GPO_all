import { useRef } from "react";
import { sendRouteChannelPayload } from "../services/routeChannel";
import { buildSceneSnapshot } from "../model/sceneSnapshot";
import { buildControllerRoutePayload, buildRouteCommand, buildRouteSentStatus } from "../model/routeCommand";

export const usePlannerRouteSender = ({driveMode,algorithmKey,batteryRangeMeters,cruiseSpeedMps,energyOptions,
  optimizedRoute,payloadKg,plannerModel,routeSeed,routeSocketRef,routeTaskKey,selectedAlgorithmParams,
  setEnergyWarning,setStatus,onMissionSubmitted}) => {
  const pendingCommand = useRef(null);
  return () => {
    if (!optimizedRoute.length) { setStatus("Сначала постройте маршрут."); return; }
    if (plannerModel.routeBlocked) { setStatus("Маршрут всё ещё пересекает ограничивающий контур."); return; }
    const payload = buildControllerRoutePayload({algorithmKey,batteryRangeMeters,cruiseSpeedMps,payloadKg,
      route:optimizedRoute,routeTaskKey:driveMode === "ordered" ? "hamiltonian_chain" : routeTaskKey,selectedAlgorithmParams});
    payload.seedRoute = routeSeed.length > 1 ? routeSeed : optimizedRoute;
    payload.scene = buildSceneSnapshot({plannerModel,batteryRangeMeters,energyOptions});
    const identity = JSON.stringify(payload);
    if (pendingCommand.current?.identity !== identity) pendingCommand.current = {identity,command:{...buildRouteCommand(payload),requestId:crypto.randomUUID()}};
    const command = pendingCommand.current.command;
    setStatus("Сервис проверяет и сохраняет маршрут...");
    return sendRouteChannelPayload(routeSocketRef,command,{
      timeoutMs:35000,
      onSent: acknowledgement => {
        pendingCommand.current = null;
        setEnergyWarning("");
        setStatus(buildRouteSentStatus(acknowledgement.route?.length || optimizedRoute.length,acknowledgement.planning?.stationStopCount || 0));
        onMissionSubmitted?.(acknowledgement);
      },
      onError:error => setStatus(error.message),
    });
  };
};
