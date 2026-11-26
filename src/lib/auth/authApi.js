import { AUTH_LOGIN_URL, AUTH_MOCK } from "../runtimeConfig";
import { normalizeEmail, normalizeIdentifier } from "../../../shared/auth-validation";

export const AUTH_ERROR_CODES = Object.freeze({ invalidCredentials: "invalid_credentials", unavailable: "unavailable", badRequest: "bad_request", badResponse: "bad_response" });
export const LOGIN_TIMEOUT_MS = 10000;
export const MOCK_CREDENTIALS = Object.freeze({ email: "admin@example.com", password: "admin" });
export const MOCK_OFFLINE_LOGIN = "offline@example.com";

export class AuthError extends Error {
  constructor(code, message, status = null) { super(message || code); this.name = "AuthError"; this.code = code; this.status = status; }
}

const readJson = async (response) => { try { return await response.json(); } catch { return null; } };
export const parseLoginResponse = (payload) => {
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) throw new AuthError(AUTH_ERROR_CODES.badResponse, "Ответ сервера без токена");
  const user = payload.user && typeof payload.user === "object" ? payload.user : {};
  return { token, expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null, user: { login: String(user.login || ""), name: String(user.name || "") } };
};

const postAuth = async (url, body, { fetchImpl = globalThis.fetch, timeoutMs = LOGIN_TIMEOUT_MS } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, payload;
  try {
    response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    payload = await readJson(response);
    controller.signal.throwIfAborted();
  } catch (error) { throw new AuthError(AUTH_ERROR_CODES.unavailable, error?.message); }
  finally { clearTimeout(timer); }
  if (response.ok) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AuthError(AUTH_ERROR_CODES.badResponse);
    return payload;
  }
  if (response.status === 401 || response.status === 403) throw new AuthError(AUTH_ERROR_CODES.invalidCredentials, "", response.status);
  if (response.status >= 500) throw new AuthError(AUTH_ERROR_CODES.unavailable, "", response.status);
  throw new AuthError(AUTH_ERROR_CODES.badRequest, "", response.status);
};

export async function login(credentials, options = {}) {
  const { url = AUTH_LOGIN_URL, mock = AUTH_MOCK, mockDelayMs = 600 } = options;
  const body = { identifier: normalizeIdentifier(credentials?.identifier), password: String(credentials?.password || "") };
  if (mock) {
    await new Promise(resolve => setTimeout(resolve, mockDelayMs));
    if (body.identifier === MOCK_OFFLINE_LOGIN) throw new AuthError(AUTH_ERROR_CODES.unavailable);
    if ((body.identifier !== MOCK_CREDENTIALS.email && body.identifier !== "admin") || body.password !== MOCK_CREDENTIALS.password) throw new AuthError(AUTH_ERROR_CODES.invalidCredentials);
    return { token: `mock-token-${Date.now()}`, expiresAt: null, user: { login: body.identifier, name: "" } };
  }
  return parseLoginResponse(await postAuth(url, body, options));
}

const authBase = () => AUTH_LOGIN_URL.replace(/\/login\/?$/, "");
export const register = (data, options = {}) => postAuth(options.url || `${authBase()}/register`, { email: normalizeEmail(data.email), displayName: data.displayName.trim(), password: data.password }, options);
export const requestPasswordReset = (email, options = {}) => postAuth(options.url || `${authBase()}/forgot-password`, { email: normalizeEmail(email) }, options);
export const resetPassword = (token, password, options = {}) => postAuth(options.url || `${authBase()}/reset-password`, { token, password }, options);
