import { validatePayload } from "./payloads.js";

export const CONTRACT_VERSION = 1;
export { CONTRACT_TYPES, validatePayload } from "./payloads.js";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

export const validateContractEnvelope = (envelope) => {
  if (!envelope || typeof envelope !== "object") {
    return { valid: false, error: "invalid_contract_envelope" };
  }
  if (envelope.contractVersion !== CONTRACT_VERSION) {
    return { valid: false, error: "unsupported_contract_version" };
  }
  if (!hasText(envelope.type) || !hasText(envelope.source) ||
      !hasText(envelope.requestId) || !hasText(envelope.timestamp) ||
      !("payload" in envelope)) {
    return { valid: false, error: "invalid_contract_envelope" };
  }
  return validatePayload(envelope.type, envelope.payload);
};

export const createContractEnvelope = ({
  type,
  source,
  requestId,
  timestamp = new Date().toISOString(),
  payload,
}) => ({
  contractVersion: CONTRACT_VERSION,
  type,
  source,
  requestId,
  timestamp,
  payload,
});

export const createRouteCommand = ({ source, requestId, timestamp, payload }) =>
  createContractEnvelope({
    type: "route.command",
    source,
    requestId,
    timestamp,
    payload,
  });

export const unwrapRouteCommand = (envelope) => {
  const validation = validateContractEnvelope(envelope);
  if (!validation.valid || envelope.type !== "route.command") return null;
  return ["route", "transfer_object"].includes(envelope.payload?.type)
    ? envelope.payload
    : null;
};

export const createTelemetryEvent = ({ source, requestId, timestamp, payload }) =>
  createContractEnvelope({
    type: "telemetry.event",
    source,
    requestId,
    timestamp,
    payload,
  });

export const unwrapTelemetryEvent = (envelope) => {
  const validation = validateContractEnvelope(envelope);
  if (!validation.valid || envelope.type !== "telemetry.event") return null;
  return envelope.payload?.type === "telemetry" ? envelope.payload : null;
};

export const createMotionCommand = ({ source, requestId, timestamp, payload }) =>
  createContractEnvelope({
    type: "motion.command",
    source,
    requestId,
    timestamp,
    payload,
  });

export const unwrapMotionCommand = (envelope) => {
  const validation = validateContractEnvelope(envelope);
  if (!validation.valid || envelope.type !== "motion.command") return null;
  return envelope.payload;
};

const createTypedContract = (type, options) => createContractEnvelope({ type, ...options });
const unwrapTypedContract = (type, envelope) => {
  const validation = validateContractEnvelope(envelope);
  return validation.valid && envelope.type === type ? envelope.payload : null;
};

export const createRobotState = (options) => createTypedContract("robot.state", options);
export const unwrapRobotState = (envelope) => unwrapTypedContract("robot.state", envelope);
export const createSensorFrame = (options) => createTypedContract("sensor.frame", options);
export const unwrapSensorFrame = (envelope) => unwrapTypedContract("sensor.frame", envelope);
export const createServiceError = (options) => createTypedContract("service.error", options);
export const unwrapServiceError = (envelope) => unwrapTypedContract("service.error", envelope);

export const createPlanningRequest = ({ source, requestId, timestamp, payload }) =>
  createContractEnvelope({
    type: "planning.request",
    source,
    requestId,
    timestamp,
    payload,
  });

export const unwrapPlanningRequest = (envelope) => {
  const validation = validateContractEnvelope(envelope);
  if (!validation.valid || envelope.type !== "planning.request") return null;
  return envelope.payload;
};

export const createPlanningResult = ({ source, requestId, timestamp, payload }) =>
  createContractEnvelope({
    type: "planning.result",
    source,
    requestId,
    timestamp,
    payload,
  });

export const unwrapPlanningResult = (envelope) => {
  const validation = validateContractEnvelope(envelope);
  if (!validation.valid || envelope.type !== "planning.result") return null;
  return envelope.payload;
};
