import { PREPARE_ROUTE_URL, SOLVER_HEALTH_URL, SOLVER_ROUTE_URL } from "./runtimeConfig";
import { createPlanningRequest, unwrapPlanningResult } from "../../shared/contracts/index.js";

export {
  ALGORITHM_OPTIONS,
  TASK_OPTIONS,
  getAlgorithmFields,
  getAlgorithmLabel,
  getDefaultAlgorithmParams,
  getTaskLabel,
} from "./routeAlgorithmRegistry";

const normalizeRoutePoint = (point) => ({ x: Number(point?.x), y: Number(point?.y) });

export const solveRouteWithNativeAlgorithm = async (points, algorithmKey, params, taskKey = "tsp", signal, {scene,anchor,visitOrder} = {}) => {
  const response = await fetch(SOLVER_ROUTE_URL, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createPlanningRequest({
      source: "planner-frontend",
      requestId: crypto.randomUUID(),
      payload: {
        points: points.map((point) => ({ x: point.x, y: point.y })),
        algorithm: { key: algorithmKey, params },
        task: taskKey,
        scene,
        anchor,
        ...(visitOrder ? {visitOrder} : {}),
      },
    })),
  });
  const rawPayload = await response.json().catch(() => null);
  const payload = unwrapPlanningResult(rawPayload) || rawPayload;
  const failure = (fallback) => Object.assign(new Error(payload?.error || fallback),
    payload?.reason ? { reason: payload.reason } : {});
  if (!response.ok) throw failure("Не удалось связаться с нативным solver.");
  if (!payload?.ok || !Array.isArray(payload.route)) throw failure("Solver вернул некорректный ответ.");
  return { ...payload, route: payload.route.map(normalizeRoutePoint) };
};

// Server-side re-planning of an ordered route after zones, chargers or motion settings change.
export const prepareRouteOnServer = async (seedRoute, scene, signal) => {
  const response = await fetch(PREPARE_ROUTE_URL, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seedRoute: seedRoute.map(normalizeRoutePoint), scene }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.planning?.ok) {
    throw Object.assign(new Error(payload?.error || "Planning service недоступен."),
      payload?.reason ? { reason: payload.reason } : {});
  }
  return payload.planning;
};

export const probeNativeSolver = async () => {
  const response = await fetch(SOLVER_HEALTH_URL, { method: "GET" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error("Solver API недоступен.");
  return payload;
};
