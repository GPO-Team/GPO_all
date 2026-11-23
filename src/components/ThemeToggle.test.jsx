// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import ThemeToggle from "./ThemeToggle";

let container;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});
it("switches and restores the selected theme", async () => {
  await act(async () => root.render(<ThemeToggle />));
  expect(document.documentElement.dataset.theme).toBe("light");
  await act(async () => container.querySelector("button").click());
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("gpo-theme")).toBe("dark");
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<ThemeToggle />));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(container.querySelector("button").getAttribute("aria-label")).toBe("Включить светлую тему");
});
