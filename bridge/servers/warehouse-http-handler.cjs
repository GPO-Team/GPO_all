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
      if (request.method === "GET" && pathname === "/api/warehouse")
        return sendJson(response, 200, await warehouseService.get());
      if (request.method === "GET" && pathname === "/api/warehouse/suggestions")
        return sendJson(
          response,
          200,
          await warehouseService.suggestions(url.searchParams.get("cargoId")),
        );
      if (request.method === "POST") {
        const handlers = {
          "/api/warehouse/racks": (body) => warehouseService.createRack(body),
          "/api/warehouse/stations": (body) => warehouseService.updateStations(body),
          "/api/warehouse/cargo": (body) => warehouseService.registerCargo(body),
          "/api/warehouse/tasks": (body) => warehouseService.prepareTask(body),
          "/api/warehouse/layout": (body) => warehouseService.importLayout(body),
        };
        let handle = handlers[pathname];
        const rackMatch = pathname.match(/^\/api\/warehouse\/racks\/([^/]+)(\/delete)?$/);
        const taskMatch = pathname.match(/^\/api\/warehouse\/tasks\/([^/]+)\/cancel$/);
        if (rackMatch) {
          const id = decodeURIComponent(rackMatch[1]);
          handle = (body) =>
            rackMatch[2]
              ? warehouseService.deleteRack(id, body)
              : warehouseService.updateRack(id, body);
        } else if (taskMatch) {
          const id = decodeURIComponent(taskMatch[1]);
          handle = (body) => warehouseService.cancelTask(id, body);
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
