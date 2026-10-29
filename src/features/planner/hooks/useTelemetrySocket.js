import { useEffect, useState } from "react";
import { TELEMETRY_WS_URL } from "../../../lib/runtimeConfig";
import { INITIAL_TELEMETRY } from "../../../lib/telemetry/dashboardTelemetryState";
import { normalizeTelemetry } from "../../../lib/telemetry/normalizeDashboardTelemetry";
import { decodeWsData } from "../../../lib/telemetry/telemetryTransport";

export const useTelemetrySocket = ({ reconnectDelayMs = 1000, staleAfterMs = 5000 } = {}) => {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer = 0;
    let staleTimer = 0;
    let previous = INITIAL_TELEMETRY;
    let socket = null;

    const connect = () => {
      if (disposed) return;
      const current = new WebSocket(TELEMETRY_WS_URL);
      socket = current;
      let closed = false;
      const active = () => !disposed && !closed && socket === current;
      current.onopen = () => { if (active()) setConnected(false); };
      current.onmessage = async (message) => {
        try {
          const payload = JSON.parse(await decodeWsData(message.data));
          if (!active()) return;
          const normalized = normalizeTelemetry(payload, previous);
          if (!normalized) return;
          previous = normalized;
          setTelemetry(normalized);
          setConnected(true);
          window.clearTimeout(staleTimer);
          staleTimer = window.setTimeout(() => {
            if (active()) setConnected(false);
          }, staleAfterMs);
        } catch {
          // Malformed telemetry should not interrupt the live connection.
        }
      };
      current.onclose = () => {
        if (!active()) return;
        closed = true;
        window.clearTimeout(staleTimer);
        setConnected(false);
        if (!disposed) reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
      };
      current.onerror = () => { if (active()) setConnected(false); };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(staleTimer);
      socket?.close();
    };
  }, [reconnectDelayMs, staleAfterMs]);

  return { connected, telemetry };
};
