// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DashboardPlannerWorkspace from "./DashboardPlannerWorkspace";
import { usePlannerSidebarState } from "./hooks/usePlannerSidebarState";

vi.mock("../../components/dashboard/PlannerCanvas", () => ({ default: () => <main>Карта</main> }));
vi.mock("../../components/dashboard/PlannerLeftSidebar", () => ({ default: ({ onCollapse }) => <button onClick={onCollapse}>Закрыть слева</button> }));
vi.mock("../../components/dashboard/PlannerRightSidebar", () => ({ default: ({ onCollapse }) => <button onClick={onCollapse}>Закрыть справа</button> }));
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); });

function Harness({ cancel = vi.fn() }) {
  const state = usePlannerSidebarState();
  return <DashboardPlannerWorkspace {...state} canvasProps={{}} rightSidebarProps={{}} leftSidebarProps={{ mission: { status: "running" }, onCancelMission: cancel }} />;
}
const click = async (text) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent.includes(text)).click());

it("leaves only arrow rails when both panels are collapsed and restores each panel", async () => {
  await act(async () => root.render(<Harness />));
  expect(container.querySelector("#planner-right-panel:not([hidden])")).toBeNull();
  await click("Закрыть слева");
  expect(container.querySelectorAll(".workspace-panel:not([hidden])")).toHaveLength(0);
  expect([...container.querySelectorAll("button")].some(button => button.textContent === ">" || button.textContent === "<")).toBe(true);
  await act(async () => container.querySelector('button[title="Открыть левое меню"]').click());
  expect(container.querySelector("#planner-left-panel:not([hidden])")).not.toBeNull();
  await act(async () => container.querySelector('button[title="Открыть правое меню"]').click());
  expect(container.querySelector("#planner-right-panel:not([hidden])")).not.toBeNull();
});

it("switches panels on narrow screens without shrinking the map to zero", async () => {
  window.matchMedia.mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  await act(async () => root.render(<Harness />));
  expect(container.querySelectorAll(".workspace-panel:not([hidden])")).toHaveLength(1);
  await act(async () => container.querySelector('button[title="Открыть правое меню"]').click());
  expect(container.querySelector("#planner-left-panel:not([hidden])")).toBeNull();
  expect(container.querySelector("#planner-right-panel:not([hidden])")).not.toBeNull();
});
