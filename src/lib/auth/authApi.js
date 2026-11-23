import { AUTH_LOGIN_URL, AUTH_MOCK } from "../runtimeConfig";

/*
 * Адаптер входа. Весь обмен с сервером авторизации проходит через этот модуль:
 * после согласования API менять нужно только его (и, при необходимости, URL
 * в runtimeConfig.js).
 *
 * ПРЕДПОЛАГАЕМЫЙ КОНТРАКТ (пока не согласован с API-разработчиком):
 *   POST AUTH_LOGIN_URL
 *   Content-Type: application/json
 *   Тело запроса: { "login": string, "password": string }
 *   200 OK:       { "token": string, "expiresAt"?: string (ISO 8601),
 *                   "user"?: { "login": string, "name"?: string } }
 *   401 / 403:    { "error": string } — неверный логин или пароль
 *   прочие 4xx:   { "error": string } — некорректный запрос
 *   5xx, сеть, таймаут — сервер недоступен
 *
 * Результат login(): { token, expiresAt, user: { login, name } }.
 * Ошибка: AuthError с полем code из AUTH_ERROR_CODES.
 */

export const AUTH_ERROR_CODES = Object.freeze({
  invalidCredentials: "invalid_credentials",
  unavailable: "unavailable",
  badRequest: "bad_request",
  badResponse: "bad_response",
});

export const LOGIN_TIMEOUT_MS = 10000;

// Учётные данные заглушки (VITE_AUTH_MOCK=1). Логин "offline" имитирует
// недоступный сервер, чтобы проверить это сообщение без сети.
export const MOCK_CREDENTIALS = Object.freeze({ login: "admin", password: "admin" });
export const MOCK_OFFLINE_LOGIN = "offline";
const MOCK_DELAY_MS = 600;

export class AuthError extends Error {
  constructor(code, message, status = null) {
    super(message || code);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

const mockLogin = async ({ login, password }, { mockDelayMs = MOCK_DELAY_MS, signal } = {}) => {
  await delay(mockDelayMs, signal);
  if (login === MOCK_OFFLINE_LOGIN) {
    throw new AuthError(AUTH_ERROR_CODES.unavailable, "Заглушка: сервер недоступен");
  }
  if (login !== MOCK_CREDENTIALS.login || password !== MOCK_CREDENTIALS.password) {
    throw new AuthError(AUTH_ERROR_CODES.invalidCredentials, "Заглушка: неверный логин или пароль", 401);
  }
  return { token: `mock-token-${Date.now()}`, expiresAt: null, user: { login, name: "" } };
};

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const parseLoginResponse = (payload) => {
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) throw new AuthError(AUTH_ERROR_CODES.badResponse, "Ответ сервера без токена");
  const user = payload.user && typeof payload.user === "object" ? payload.user : {};
  return {
    token,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null,
    user: { login: String(user.login || ""), name: String(user.name || "") },
  };
};

export async function login(credentials, options = {}) {
  const { url = AUTH_LOGIN_URL, mock = AUTH_MOCK, fetchImpl = globalThis.fetch, timeoutMs = LOGIN_TIMEOUT_MS } = options;
  const body = { login: String(credentials?.login || ""), password: String(credentials?.password || "") };
  if (mock) return mockLogin(body, options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new AuthError(AUTH_ERROR_CODES.unavailable, error?.message || "Сервер недоступен");
  } finally {
    clearTimeout(timer);
  }

  const payload = await readJson(response);
  if (response.ok) return parseLoginResponse(payload);
  const message = typeof payload?.error === "string" ? payload.error : "";
  if (response.status === 401 || response.status === 403) {
    throw new AuthError(AUTH_ERROR_CODES.invalidCredentials, message, response.status);
  }
  if (response.status >= 500) {
    throw new AuthError(AUTH_ERROR_CODES.unavailable, message, response.status);
  }
  throw new AuthError(AUTH_ERROR_CODES.badRequest, message, response.status);
}
