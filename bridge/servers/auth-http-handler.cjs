const { isAllowedOrigin } = require("../protocol/origin-policy.cjs");
const { sendJson, readJson } = require("./service-http.cjs");

// The endpoint contract is deliberately unavailable until a persistent user store
// and a mail provider are connected. It must never report fictitious success.
const createAuthHttpHandler = () => async (request, response) => {
  if (!isAllowedOrigin(request.headers.origin)) return sendJson(response, 403, { ok: false, code: "origin_forbidden" });
  if (request.headers.origin) { response.setHeader("Access-Control-Allow-Origin", request.headers.origin); response.setHeader("Vary", "Origin"); }
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.writeHead(204); response.end(); return;
  }
  const path = new URL(request.url, "http://localhost").pathname;
  const kinds = { "/api/auth/login": "login", "/api/auth/register": "register", "/api/auth/forgot-password": "forgot", "/api/auth/reset-password": "reset" };
  if (request.method !== "POST" || !kinds[path]) return sendJson(response, 404, { ok: false, code: "not_found" });
  try {
    const body = await readJson(request, 8192);
    const { validateAuth } = await import("../../shared/auth-validation.js");
    const errors = validateAuth(kinds[path], body);
    if (Object.keys(errors).length) return sendJson(response, 400, { ok: false, code: "invalid_input", errors });
    return sendJson(response, 503, { ok: false, code: "auth_unavailable" });
  } catch (error) {
    return sendJson(response, error.statusCode || 503, { ok: false, code: error.code || "auth_unavailable" });
  }
};
module.exports = { createAuthHttpHandler };
