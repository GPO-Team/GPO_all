import { describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES, login, MOCK_CREDENTIALS, MOCK_OFFLINE_LOGIN } from "./authApi";

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const expectCode = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ name: "AuthError", code });
};

describe("authApi.login", () => {
  it("posts JSON credentials and returns the token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { token: "abc", expiresAt: "2030-01-01T00:00:00Z", user: { login: "operator" } }));
    const result = await login({ login: "operator", password: "secret" }, { url: "http://auth.test/login", mock: false, fetchImpl });
    expect(result).toEqual({ token: "abc", expiresAt: "2030-01-01T00:00:00Z", user: { login: "operator", name: "" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://auth.test/login");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ login: "operator", password: "secret" });
  });

  it("maps statuses and network failures to error codes", async () => {
    const run = (fetchImpl) => login({ login: "a", password: "b" }, { url: "/login", mock: false, fetchImpl });
    await expectCode(run(vi.fn().mockResolvedValue(jsonResponse(401, { error: "bad" }))), AUTH_ERROR_CODES.invalidCredentials);
    await expectCode(run(vi.fn().mockResolvedValue(jsonResponse(403, {}))), AUTH_ERROR_CODES.invalidCredentials);
    await expectCode(run(vi.fn().mockResolvedValue(jsonResponse(400, {}))), AUTH_ERROR_CODES.badRequest);
    await expectCode(run(vi.fn().mockResolvedValue(jsonResponse(503, null))), AUTH_ERROR_CODES.unavailable);
    await expectCode(run(vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))), AUTH_ERROR_CODES.unavailable);
    await expectCode(run(vi.fn().mockResolvedValue(jsonResponse(200, { user: {} }))), AUTH_ERROR_CODES.badResponse);
  });

  it("aborts a hanging request as unavailable", async () => {
    const fetchImpl = vi.fn((url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    await expectCode(login({ login: "a", password: "b" }, { url: "/login", mock: false, fetchImpl, timeoutMs: 5 }), AUTH_ERROR_CODES.unavailable);
  });

  it("stub accepts the demo account and simulates failures without a server", async () => {
    const options = { mock: true, mockDelayMs: 0, fetchImpl: vi.fn() };
    await expect(login(MOCK_CREDENTIALS, options)).resolves.toMatchObject({ user: { login: MOCK_CREDENTIALS.login } });
    await expectCode(login({ login: MOCK_CREDENTIALS.login, password: "x" }, options), AUTH_ERROR_CODES.invalidCredentials);
    await expectCode(login({ login: MOCK_OFFLINE_LOGIN, password: "x" }, options), AUTH_ERROR_CODES.unavailable);
    expect(options.fetchImpl).not.toHaveBeenCalled();
  });
});
