// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import RequireAuth from "../components/auth/RequireAuth";
import { AUTH_ERROR_CODES, AuthError } from "../lib/auth/authApi";
import { clearSession, getSession, saveSession } from "../lib/auth/authSession";

const setInput = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("Login", () => {
  let container;
  let root;

  const render = async (loginRequest, { initialEntries = ["/login"], required = true } = {}) => {
    await act(async () => root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<Login loginRequest={loginRequest} mock={false} />} />
          <Route path="/dashboard" element={<RequireAuth required={required}><div>Планировщик</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    ));
  };
  const field = (name) => container.querySelector(`input[name="${name}"]`);
  const button = () => container.querySelector('button[type="submit"]');
  const alertText = () => container.querySelector('[role="alert"]')?.textContent;
  const fill = async (login, password) => act(async () => {
    setInput(field("login"), login);
    setInput(field("password"), password);
  });
  const submit = async () => act(async () => button().click());

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    clearSession();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    clearSession();
  });

  it("shows login and password fields with the sign-in button", async () => {
    await render(vi.fn());
    expect(container.querySelector('label[for="login-name"]').textContent).toBe("Логин");
    expect(container.querySelector('label[for="login-password"]').textContent).toBe("Пароль");
    expect(field("password").type).toBe("password");
    expect(button().textContent).toBe("Войти");
    expect(alertText()).toBeUndefined();
  });

  it("reports empty fields without calling the server", async () => {
    const loginRequest = vi.fn();
    await render(loginRequest);
    await submit();
    expect(alertText()).toBe("Введите логин и пароль.");
    expect(field("login").getAttribute("aria-invalid")).toBe("true");
    await fill("   ", "secret");
    await submit();
    expect(alertText()).toBe("Введите логин.");
    await fill("operator", "");
    await submit();
    expect(alertText()).toBe("Введите пароль.");
    expect(field("login").getAttribute("aria-invalid")).toBeNull();
    expect(field("password").getAttribute("aria-invalid")).toBe("true");
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it("locks the button while the request runs and opens the dashboard on success", async () => {
    const pending = deferred();
    const loginRequest = vi.fn(() => pending.promise);
    await render(loginRequest, { initialEntries: ["/dashboard"] });
    expect(field("login")).not.toBeNull();
    await fill(" operator ", "secret");
    await submit();
    expect(loginRequest).toHaveBeenCalledWith({ login: "operator", password: "secret" });
    expect(button().disabled).toBe(true);
    expect(button().textContent).toBe("Входим…");
    expect(container.querySelector("form").getAttribute("aria-busy")).toBe("true");
    await submit();
    expect(loginRequest).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ token: "abc", expiresAt: null, user: { login: "operator" } }));
    expect(container.textContent).toBe("Планировщик");
    expect(getSession()).toMatchObject({ token: "abc", login: "operator" });
  });

  it("explains wrong credentials and clears the password", async () => {
    const loginRequest = vi.fn().mockRejectedValue(new AuthError(AUTH_ERROR_CODES.invalidCredentials, "", 401));
    await render(loginRequest);
    await fill("operator", "wrong");
    await submit();
    expect(alertText()).toBe("Неверный логин или пароль.");
    expect(field("password").value).toBe("");
    expect(field("login").value).toBe("operator");
    expect(button().disabled).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("explains that the server is unavailable", async () => {
    const loginRequest = vi.fn().mockRejectedValue(new AuthError(AUTH_ERROR_CODES.unavailable));
    await render(loginRequest);
    await fill("operator", "secret");
    await submit();
    expect(alertText()).toBe("Сервер недоступен. Проверьте подключение и попробуйте позже.");
    expect(field("password").value).toBe("secret");
    expect(button().textContent).toBe("Войти");
  });

  it("keeps the dashboard open when sign-in is not required or a session exists", async () => {
    await render(vi.fn(), { initialEntries: ["/dashboard"], required: false });
    expect(container.textContent).toBe("Планировщик");
    saveSession({ token: "abc", user: { login: "operator" } });
    await render(vi.fn(), { initialEntries: ["/dashboard"], required: true });
    expect(container.textContent).toBe("Планировщик");
  });
});
