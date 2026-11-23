const http = require("http");
const {createMissionHttpHandler} = require("./mission-http-handler.cjs");
const {createWarehouseHttpHandler} = require("./warehouse-http-handler.cjs");
const WebSocket = require("ws");
const { createRouteService } = require("../services/route-service.cjs");
const { verifyWebSocketOrigin } = require("../protocol/origin-policy.cjs");

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeIncomingPayload = async (payload) => {
  if (payload?.type !== "route.command") return payload;
  const { unwrapRouteCommand } = await import("../../shared/contracts/index.js");
  return unwrapRouteCommand(payload);
};

const createRouteServer = ({ artifactStore, host, port, routeService: suppliedRouteService, missionService, warehouseService, ready }) => {
  const missionHandler = createMissionHttpHandler({missionService,getStatus:() => getStatus(),ready});
  const warehouseHandler = warehouseService && createWarehouseHttpHandler({warehouseService});
  const server = http.createServer((request,response) => {
    const pathname = (request.url || "/").split("?")[0];
    return warehouseHandler && /^\/api\/warehouse(?:\/|$)/.test(pathname)
      ? warehouseHandler(request,response) : missionHandler(request,response);
  });
  const wss = new WebSocket.Server({ server, maxPayload: 1024 * 1024, verifyClient: verifyWebSocketOrigin });
  const uiClients = new Set();
  let controllerConnection = null;
  const routeService = suppliedRouteService || createRouteService({ artifactStore });
  let pending = Promise.resolve();

  wss.on("connection", (ws, request) => {
    const url = request?.url || "/";
    const isUi = url.split("?")[0] === "/ui";
    if (isUi) uiClients.add(ws);
    else controllerConnection = ws;
    console.log(`[route] client connected (${isUi ? "ui" : "controller"})`);

    ws.on("error", error => console.error("[route] socket error:", error.message));
    ws.on("message", (data) => {
      if (!isUi) return;
      const raw = safeJsonParse(data.toString());
      const requestId = typeof raw?.requestId === "string" ? raw.requestId : null;
      const reply = result => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "route.ack", requestId, ...result }));
      };
      pending = pending.then(async () => {
        try {
          const payload = await normalizeIncomingPayload(raw);
          if (!payload) throw new Error("Invalid command contract.");
          const result = await routeService.handle(payload, {requestId});
          if (!result.handled) throw new Error("Unsupported command type.");
          if (!result.missionId && controllerConnection?.readyState === WebSocket.OPEN) controllerConnection.send(JSON.stringify(payload));
          reply({ ok: true, status: "persisted", ...result });
        } catch (error) {
          reply({ ok: false, error: error.message, code:error.code || "command_failed", statusCode:error.statusCode || 503 });
        }
      });
    });

    ws.on("close", () => {
      if (isUi) uiClients.delete(ws);
      if (controllerConnection === ws) controllerConnection = null;
      console.log("[route] client disconnected");
    });
  });

  const getStatus = () => ({
    controllerConnected: controllerConnection?.readyState === WebSocket.OPEN,
    uiClientCount: uiClients.size,
  });
  server.listen(port,host);
  return {
    close: async () => {
      await pending;
      await missionService?.drain();
      await warehouseService?.drain();
      for (const client of wss.clients) client.terminate();
      await new Promise(resolve => wss.close(resolve));
      await new Promise(resolve => server.close(resolve));
    },
    getStatus,
    persistMessage: routeService.handle,
    wss,
    server,
  };
};

module.exports = { createRouteServer, normalizeIncomingPayload, safeJsonParse };
