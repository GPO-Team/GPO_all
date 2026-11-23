const http = require("http");
const { isAllowedOrigin } = require("../protocol/origin-policy.cjs");
const { createPlanningService } = require("../services/planning-service.cjs");
const { createGraphImportService } = require("../services/graph-import-service.cjs");
const { renderMapExport } = require("../rendering/map-export-renderer.cjs");

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_MAP_EXPORT_BYTES = 16 * 1024 * 1024;

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type, X-File-Name",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = (request, limit = 1024 * 1024) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });
    request.on("error", reject);
  });

const readRawBody = (request, limit) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Файл больше 5 МБ."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const createSolverHttpServer = ({
  coordinateContract,
  host,
  nativeSolver,
  port,
  solverPath,
  planningService: suppliedPlanningService,
  graphImportService = createGraphImportService(),
}) => {
  const planningService = suppliedPlanningService || createPlanningService({ nativeSolver });
  const server = http.createServer(async (request, response) => {
    if (!isAllowedOrigin(request.headers.origin)) {
      sendJson(response, 403, { ok: false, error: "Origin is not allowed." });
      return;
    }
    if (request.headers.origin) {
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && request.url === "/ready") {
      const available = await nativeSolver.solverExists();
      sendJson(response,available ? 200 : 503,{ok:available,service:"planning"});
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        coordinateContractVersion: coordinateContract.version,
        solverAvailable: await nativeSolver.solverExists(),
        solverPath,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/solve-route") {
      try {
        const body = await readJsonBody(request);
        const result = await planningService.solve(body);
        if (body?.type === "planning.request") {
          const { createPlanningResult } = await import("../../shared/contracts/index.js");
          sendJson(response, 200, createPlanningResult({
            source: "planning-service",
            requestId: body.requestId,
            payload: result,
          }));
        } else {
          sendJson(response, 200, result);
        }
      } catch (error) {
        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        sendJson(response, statusCode, {
          ok: false,
          error: error instanceof Error ? error.message : "Unexpected solver failure.",
          ...(typeof error?.reason === "string" ? { reason: error.reason } : {}),
        });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/import-graph") {
      try {
        const fileName = decodeURIComponent(String(request.headers["x-file-name"] || ""));
        const bytes = await readRawBody(request, MAX_IMPORT_BYTES);
        sendJson(response, 200, await graphImportService.importGraph({ fileName, bytes }));
      } catch (error) {
        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        sendJson(response, statusCode, {
          ok: false,
          error: error instanceof Error ? error.message : "Не удалось импортировать граф.",
        });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/prepare-route") {
      try {
        sendJson(response, 200, await planningService.prepare(await readJsonBody(request)));
      } catch (error) {
        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        sendJson(response, statusCode, {
          ok: false,
          error: error instanceof Error ? error.message : "Unexpected planning failure.",
          ...(typeof error?.reason === "string" ? { reason: error.reason } : {}),
        });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/map-export") {
      try {
        const { png, fileName } = renderMapExport(await readJsonBody(request, MAX_MAP_EXPORT_BYTES));
        response.writeHead(200, {
          "Access-Control-Expose-Headers": "X-File-Name",
          "Content-Type": "image/png",
          "Content-Length": png.length,
          "X-File-Name": fileName,
        });
        response.end(png);
      } catch (error) {
        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        sendJson(response, statusCode, {
          ok: false,
          error: error instanceof Error ? error.message : "Не удалось построить PNG карты.",
        });
      }
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: "Not found.",
    });
  });

  return {
    server,
    start() {
      server.listen(port, host, () => {
        console.log(`[solver] http://${host}:${port}`);
      });
      return server;
    },
  };
};

module.exports = { createSolverHttpServer };
