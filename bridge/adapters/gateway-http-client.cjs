const { VERSION, serviceError, validateEnvelope } = require("../protocol/service-contract.cjs");
const createGatewayClient = ({baseUrl, token = "", timeoutMs = 3000, retries = 1, fetchImpl = fetch}) => {
  const url = new URL(baseUrl);
  if (!["http:","https:"].includes(url.protocol)) throw new Error("Gateway URL must use HTTP(S).");
  let closed = false;
  const controllers = new Set();
  const request = async (pathname, body) => {
    for (let attempt = 0; ; attempt++) {
      if (closed) throw serviceError(503, "client_closed", "Gateway client closed.");
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(new URL(pathname, url), {
          method:body ? "POST" : "GET", signal:controller.signal,
          headers:{"Content-Type":"application/json", ...(token ? {Authorization:`Bearer ${token}`} : {})},
          ...(body ? {body:JSON.stringify({version:VERSION,...body})} : {}),
        });
        const text = await response.text();
        if (text.length > 16 * 1024 * 1024) throw serviceError(502, "invalid_response", "Gateway response too large.");
        const result = validateEnvelope(JSON.parse(text));
        if (!response.ok || result.ok !== true) throw serviceError(response.status, result.code || "gateway_error", result.error || "Gateway request failed.");
        return result.payload;
      } catch (error) {
        const transient = !error.statusCode || error.statusCode >= 500;
        if (!transient || attempt >= retries || closed) throw transient ? serviceError(503, "gateway_unavailable", `Gateway unavailable: ${error.message}`) : error;
      } finally { clearTimeout(timer); controllers.delete(controller); }
    }
  };
  return {
    ready:() => request("/ready"),
    getControllerSession: () => request("/v1/controller-session"),
    submit: (command, controllerBootId) => request("/v1/commands", {
      operation: "submit", requestId: command.commandId, payload: command,
      ...(controllerBootId ? { controllerBootId } : {}),
    }),
    update:(payload, requestId) => request("/v1/commands", {operation:"update",requestId,payload}).then(() => true),
    cancel:missionId => request("/v1/commands", {operation:"cancel",requestId:missionId,payload:{missionId}}),
    getFeedback:missionId => request(`/v1/feedback/${encodeURIComponent(missionId)}`),
    telemetry:() => request("/v1/telemetry"),
    close:() => {closed=true;for (const controller of controllers) controller.abort();},
  };
};
const createGatewayTelemetrySource = ({client}) => {
  let lastRevision = null, inFlight = false;
  return {async poll() {
    if (inFlight) return null;
    inFlight = true;
    try {
      const frame = await client.telemetry();
      if (!frame?.telemetry || frame.revision === lastRevision || !frame.fresh) return null;
      lastRevision = frame.revision;
      return frame.telemetry;
    } finally {inFlight=false;}
  }, close:client.close};
};
module.exports = {createGatewayClient, createGatewayTelemetrySource};
