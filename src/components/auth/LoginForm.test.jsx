// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
let root, container;
const set = async (name, value) => act(async () => {
  const element = container.querySelector(`input[name="${name}"]`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
const click = async (text) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text).click());
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("checks registration fields and password confirmation before sending", async () => {
  const register = vi.fn().mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<LoginForm onSubmit={vi.fn()} api={{ register }} />));
  await click("Регистрация");
  await set("email", "user@example.com"); await set("displayName", "Иван");
  await set("password", "очень длинный пароль"); await set("confirmPassword", "другой пароль");
  await click("Зарегистрироваться");
  expect(container.textContent).toContain("Пароли не совпадают.");
  expect(register).not.toHaveBeenCalled();
  await set("confirmPassword", "очень длинный пароль"); await click("Зарегистрироваться");
  expect(register).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Сервис авторизации сейчас недоступен");
});
it("requests recovery without confirming whether the email is registered", async () => {
  const requestPasswordReset = vi.fn().mockResolvedValue({});
  await act(async () => root.render(<LoginForm onSubmit={vi.fn()} api={{ requestPasswordReset }} />));
  await click("Забыли пароль?"); await set("email", "user@example.com"); await click("Отправить сообщение");
  expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com");
  expect(container.textContent).toContain("Если аккаунт с такой почтой существует");
});

it("accepts a login as well as an email and rejects invalid input", async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<LoginForm onSubmit={onSubmit} />));
  await set("identifier", "bad name"); await set("password", "password"); await click("Войти");
  expect(onSubmit).not.toHaveBeenCalled();
  expect(container.querySelector('input[name="identifier"]').getAttribute("aria-invalid")).toBe("true");
  await set("identifier", "Иван_42"); await click("Войти");
  expect(onSubmit).toHaveBeenCalledWith({ identifier: "Иван_42", password: "password" });
});

it("reveals a password only while the eye button is hovered or focused", async () => {
  await act(async () => root.render(<LoginForm onSubmit={vi.fn()} />));
  const input = container.querySelector('input[name="password"]');
  const reveal = container.querySelector('button[aria-label="Показать пароль"]');
  expect(input.type).toBe("password");
  await act(async () => reveal.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(input.type).toBe("text");
  await act(async () => reveal.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(input.type).toBe("password");
  await act(async () => reveal.focus());
  expect(input.type).toBe("text");
  await act(async () => reveal.blur());
  expect(input.type).toBe("password");
});
