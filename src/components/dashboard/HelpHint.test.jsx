// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import HelpHint from "./HelpHint";

it("opens help outside the layout and dismisses it with Escape or an outside click", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<div className="legend"><span>Точки 0 · зоны 1</span><HelpHint label="Обозначения карты">Красные точки — посещения.</HelpHint></div>));
    const button = container.querySelector("button");
    const originalParent = button.parentElement;
    await act(async () => button.click());
    const note = document.querySelector('[role="note"]');
    expect(note.parentElement).toBe(document.body);
    expect(container.querySelector(".help-content")).toBeNull();
    expect(button.parentElement).toBe(originalParent);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(note.id);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[role="note"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    await act(async () => button.click());
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
