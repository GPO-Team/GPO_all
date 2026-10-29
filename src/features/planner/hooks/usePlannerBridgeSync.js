import { useEffect } from "react";
import { sendRouteChannelPayload } from "../services/routeChannel";

export const usePlannerBridgeSync = ({
  batteryRangeMeters,
  cruiseSpeedMps,
  payloadKg,
  routeSocketRef,
  routeConnected,
  setStatus,
  surfaceSyncPayloadText,
  zoneSyncPayloadText,
  editingLocked=false,
}) => {

  useEffect(() => {
    if (!routeConnected || editingLocked) return;
    sendRouteChannelPayload(routeSocketRef, JSON.parse(zoneSyncPayloadText), { onError: error => setStatus(`Зоны не сохранены: ${error.message}`) });
  }, [editingLocked,setStatus, routeConnected, routeSocketRef, zoneSyncPayloadText]);

  useEffect(() => {
    if (!routeConnected || editingLocked) return;
    sendRouteChannelPayload(routeSocketRef, JSON.parse(surfaceSyncPayloadText), { onError: error => setStatus(`Поверхности не сохранены: ${error.message}`) });
  }, [editingLocked,setStatus, routeConnected, routeSocketRef, surfaceSyncPayloadText]);

  useEffect(() => {
    if (!routeConnected || editingLocked) return;
    sendRouteChannelPayload(routeSocketRef, {
      type: "motion_profile",
      motion: {
        cruiseSpeedMps,
        payloadKg,
        batteryRange: batteryRangeMeters,
      },
    }, { onError: error => setStatus(`Параметры движения не сохранены: ${error.message}`) });
  }, [editingLocked,setStatus, routeConnected, batteryRangeMeters, cruiseSpeedMps, payloadKg, routeSocketRef]);
};
