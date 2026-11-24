const path = require("path");
const { readSecret } = require("./secret.cjs");

const projectRoot = path.resolve(__dirname, "..", "..");
require("dotenv").config({ path: path.join(projectRoot, ".env"), quiet: true });

const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
};

const toHost = (value, fallback) => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toPath = (value, fallback) => {
  const normalized = String(value || "").trim();
  return normalized ? path.resolve(projectRoot, normalized) : fallback;
};

const BRIDGE_HOST = toHost(
  process.env.BRIDGE_BIND_HOST || process.env.BRIDGE_HOST,
  "127.0.0.1"
);
const TELEMETRY_PORT = toPort(process.env.TELEMETRY_PORT, 9001);
const ROUTE_PORT = toPort(process.env.ROUTE_PORT, 9002);
const SOLVER_PORT = toPort(process.env.SOLVER_PORT, 9003);
const WEB_STATE_DIR = toPath(
  process.env.WEB_STATE_DIR,
  path.join(projectRoot, "web_state")
);
const SOLVER_PATH = toPath(
  process.env.SOLVER_PATH,
  path.join(
    projectRoot,
    "native",
    "build",
    process.platform === "win32" ? "gpo_route_solver.exe" : "gpo_route_solver"
  )
);

const warehouseStorage = process.env.WAREHOUSE_STORAGE ||
  (process.env.POSTGRES_PASSWORD ? "postgres" : "sqlite");
if (!["postgres", "sqlite"].includes(warehouseStorage))
  throw new Error("WAREHOUSE_STORAGE must be postgres or sqlite.");

module.exports = {
  WAREHOUSE_POSTGRES: warehouseStorage === "postgres" ? {
    host: toHost(process.env.WAREHOUSE_POSTGRES_HOST, "127.0.0.1"),
    port: toPort(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || "gpo",
    user: process.env.POSTGRES_USER || "gpo",
    password: process.env.POSTGRES_PASSWORD,
  } : null,
  LOG_DIR: process.env.LOG_DIR ? toPath(process.env.LOG_DIR) : undefined,
  BRIDGE_HOST,
  ROUTE_PORT,
  ROUTE_WS_URL: `ws://${BRIDGE_HOST}:${ROUTE_PORT}`,
  SOLVER_HTTP_URL: `http://${BRIDGE_HOST}:${SOLVER_PORT}`,
  SOLVER_PATH,
  SOLVER_PORT,
  TELEMETRY_PORT,
  TELEMETRY_WS_URL: `ws://${BRIDGE_HOST}:${TELEMETRY_PORT}`,
  WEB_STATE_DIR,
  MISSION_STATE_DIR: toPath(process.env.MISSION_STATE_DIR,path.join(projectRoot,"data","missions")),
  GATEWAY_PORT: toPort(process.env.GATEWAY_PORT,9004),
  GATEWAY_BIND_HOST: toHost(process.env.GATEWAY_BIND_HOST,"127.0.0.1"),
  GATEWAY_URL: process.env.GATEWAY_URL || `http://127.0.0.1:${toPort(process.env.GATEWAY_PORT,9004)}`,
  GATEWAY_TOKEN: readSecret({ value: process.env.GATEWAY_TOKEN, file: process.env.GATEWAY_TOKEN_FILE, root: projectRoot }),
  SOLVER_BIND_HOST: toHost(process.env.SOLVER_BIND_HOST,BRIDGE_HOST),
  ROUTE_BIND_HOST: toHost(process.env.ROUTE_BIND_HOST,BRIDGE_HOST),
  TELEMETRY_BIND_HOST: toHost(process.env.TELEMETRY_BIND_HOST,BRIDGE_HOST),
};
