import { INITIAL_TELEMETRY } from "./dashboardTelemetryState";
import { pickNumber } from "./telemetryNumbers";

export const normalizeNavigation = (
  rawNavigation,
  prevNavigation = INITIAL_TELEMETRY.navigation
) => {
  if (!rawNavigation || typeof rawNavigation !== "object") return prevNavigation;

  let target = prevNavigation?.target;
  if (Object.hasOwn(rawNavigation, "target")) {
    const x = pickNumber(rawNavigation.target?.x);
    const y = pickNumber(rawNavigation.target?.y);
    target = x !== null && y !== null
      ? { x, y, headingDeg: pickNumber(rawNavigation.target?.headingDeg) }
      : null;
  }

  const distanceToTarget = pickNumber(
    rawNavigation.distanceToTarget,
    prevNavigation?.distanceToTarget
  );
  const avoidanceTimeSec = pickNumber(
    rawNavigation.avoidanceTimeSec,
    prevNavigation?.avoidanceTimeSec
  );
  const avoidanceSteps = pickNumber(
    rawNavigation.avoidanceSteps,
    prevNavigation?.avoidanceSteps
  );

  return {
    status:
      typeof rawNavigation.status === "string"
        ? rawNavigation.status
        : prevNavigation?.status ?? "",
    finished: Boolean(rawNavigation.finished),
    ...(target !== undefined ? { target } : {}),
    ...(typeof rawNavigation.error === "string" ? { error: rawNavigation.error }
      : typeof prevNavigation?.error === "string" ? { error: prevNavigation.error } : {}),
    currentWaypointIndex:
      pickNumber(rawNavigation.currentWaypointIndex, prevNavigation?.currentWaypointIndex, 0) ?? 0,
    ...(distanceToTarget !== null ? { distanceToTarget } : {}),
    ...(avoidanceTimeSec !== null ? { avoidanceTimeSec } : {}),
    ...(avoidanceSteps !== null ? { avoidanceSteps } : {}),
    ...(typeof rawNavigation.avoidanceActive === "boolean"
      ? { avoidanceActive: rawNavigation.avoidanceActive }
      : {}),
    ...(typeof rawNavigation.offRouteActive === "boolean"
      ? { offRouteActive: rawNavigation.offRouteActive }
      : {}),
  };
};
