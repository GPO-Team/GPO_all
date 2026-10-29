import { pickNumber } from "./telemetryNumbers";

const MOTION_FIELDS = [
  "cruiseSpeedMps", "payloadKg", "batteryRange", "batterySpeedFactor",
  "runtimeLinearLimitMps", "runtimeAngularLimitRad",
];

export const normalizeMotionProfile = (raw, previous) => {
  if (!raw || typeof raw !== "object") return previous;
  return Object.fromEntries(MOTION_FIELDS.map((key) => [key, pickNumber(raw[key], previous?.[key])]));
};
