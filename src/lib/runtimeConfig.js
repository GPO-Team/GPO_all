const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
};

const toHost = (value, fallback) => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

export const BRIDGE_HOST = toHost(import.meta.env.VITE_BRIDGE_HOST, "127.0.0.1");
export const TELEMETRY_PORT = toPort(import.meta.env.VITE_TELEMETRY_PORT, 9001);
export const ROUTE_PORT = toPort(import.meta.env.VITE_ROUTE_PORT, 9002);
export const SOLVER_PORT = toPort(import.meta.env.VITE_SOLVER_PORT, 9003);

export const TELEMETRY_WS_URL = import.meta.env.VITE_TELEMETRY_URL || `ws://${BRIDGE_HOST}:${TELEMETRY_PORT}`;
export const ROUTE_WS_URL = import.meta.env.VITE_ROUTE_URL || `ws://${BRIDGE_HOST}:${ROUTE_PORT}/ui`;
export const SOLVER_API_BASE_URL = (import.meta.env.VITE_PLANNING_URL || `http://${BRIDGE_HOST}:${SOLVER_PORT}`).replace(/\/$/, "");
export const SOLVER_ROUTE_URL = `${SOLVER_API_BASE_URL}/api/solve-route`;
export const PREPARE_ROUTE_URL = `${SOLVER_API_BASE_URL}/api/prepare-route`;
export const SOLVER_HEALTH_URL = `${SOLVER_API_BASE_URL}/health`;

export const MISSION_API_BASE_URL = (import.meta.env.VITE_MISSION_URL || `http://${BRIDGE_HOST}:${ROUTE_PORT}`).replace(/\/$/, "");
