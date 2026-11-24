const { isAllowedOrigin } = require("../protocol/origin-policy.cjs");
const { sendJson, sendError, readJson } = require("./service-http.cjs");
const { warehouseError } = require("../protocol/warehouse-validation.cjs");

const createWarehouseHttpHandler =
  ({ warehouseService }) =>
  async (request, response) => {
    if (!isAllowedOrigin(request.headers.origin))
      return sendJson(response, 403, {
        ok: false,
        code: "origin_forbidden",
        error: "Origin is not allowed.",
      });
    if (request.headers.origin) {
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      const url = new URL(request.url, "http://localhost");
      const pathname = url.pathname;
      const live = url.searchParams.get("view") === "live";
      if (request.method === "GET" && pathname === "/api/warehouse")
        return sendJson(response, 200, await warehouseService.get(live));
      if (request.method === "GET" && pathname === "/api/warehouse/history")
        return sendJson(response, 200, await warehouseService.history({
          status: url.searchParams.get("status"),
          before: url.searchParams.get("before"),
          limit: url.searchParams.get("limit"),
        }));
      if (request.method === "GET" && pathname === "/api/warehouse/suggestions")
        return sendJson(
          response,
          200,
          await warehouseService.suggestions(url.searchParams.get("cargoId")),
        );
      if (request.method === "POST") {
        const handlers = {
          "/api/warehouse/racks": (body) => warehouseService.createRack(body, live),
          "/api/warehouse/stations": (body) => warehouseService.updateStations(body, live),
          "/api/warehouse/cargo": (body) => warehouseService.registerCargo(body, live),
          "/api/warehouse/tasks": (body) => warehouseService.prepareTask(body, live),
          "/api/warehouse/layout": (body) => warehouseService.importLayout(body, live),
        };
        let handle = handlers[pathname];
        const rackMatch = pathname.match(/^\/api\/warehouse\/racks\/([^/]+)(\/delete)?$/);
        const taskMatch = pathname.match(/^\/api\/warehouse\/tasks\/([^/]+)\/(cancel|start|stop)$/);
        if (rackMatch) {
          const id = decodeURIComponent(rackMatch[1]);
          handle = (body) =>
            rackMatch[2]
              ? warehouseService.deleteRack(id, body, live)
              : warehouseService.updateRack(id, body, live);
        } else if (taskMatch) {
          const id = decodeURIComponent(taskMatch[1]);
          const action = { start: "startTask", stop: "stopTask", cancel: "cancelTask" }[taskMatch[2]];
          handle = (body) => warehouseService[action](id, body, live);
        }
        if (handle) return sendJson(response, 200, await handle(await readJson(request)));
      }
      sendJson(response, 404, { ok: false, code: "not_found", error: "Not found." });
    } catch (error) {
      sendError(
        response,
        error instanceof URIError
          ? warehouseError(400, "invalid_path", "Invalid URL encoding.")
          : error,
      );
    }
  };
module.exports = { createWarehouseHttpHandler };
