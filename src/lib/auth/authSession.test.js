// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { authHeaders, clearSession, getSession, saveSession, SESSION_STORAGE_KEY } from "./authSession";

describe("authSession", () => {
  afterEach(() => clearSession());

  it("keeps the token in sessionStorage until it is cleared", () => {
    saveSession({ token: "abc", user: { login: "operator" } });
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY))).toEqual({ token: "abc", expiresAt: null, login: "operator" });
    expect(getSession()).toMatchObject({ token: "abc" });
    expect(authHeaders()).toEqual({ Authorization: "Bearer abc" });
    clearSession();
    expect(getSession()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("drops an expired or corrupted session", () => {
    saveSession({ token: "abc", expiresAt: "2026-01-01T00:00:00Z" });
    expect(getSession(Date.parse("2026-01-02T00:00:00Z"))).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    sessionStorage.setItem(SESSION_STORAGE_KEY, "{not json");
    expect(getSession()).toBeNull();
  });
});
