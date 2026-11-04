// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlannerRightSidebar from "./PlannerRightSidebar";
import { usePlannerSidebarState } from "../../features/planner/hooks/usePlannerSidebarState";
import { loadPlannerUiState } from "../../lib/plannerUiState";
import { INITIAL_TELEMETRY } from "../../lib/dashboardTelemetry";
vi.mock("./sections/PlannerSimulationSection", () => ({ default: () => <div>Симуляция</div> }));
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); });
function Harness() {
  const { plannerUiState, setMapLayerVisible } = usePlannerSidebarState();
  return <PlannerRightSidebar telemetry={{ ...INITIAL_TELEMETRY, obstacleMap: { cells: [{ x: 1, y: 2 }] } }}
    telemetryWsUp mapLayers={plannerUiState.mapLayers} onMapLayerChange={setMapLayerVisible}
    status="Маршрут построен: длинное техническое описание" />;
}
it("keeps only telemetry and map controls without task or route description", async () => {
  await act(async () => root.render(<Harness />));
  const telemetryPanel = container.querySelector("#planner-right-telemetry");
  const mapPanel = container.querySelector("#planner-right-map");
  expect(telemetryPanel.hidden).toBe(false);
  expect(mapPanel.hidden).toBe(true);
  expect(container.querySelector("#planner-right-task")).toBeNull();
  expect(container.textContent).not.toContain("Задача");
  expect(container.textContent).not.toContain("Маршрут построен");
  expect(telemetryPanel.textContent).toContain("Манипулятор · перенос объекта");
  expect(telemetryPanel.textContent).not.toContain("Алгоритм");
  expect(mapPanel.textContent).not.toContain("Алгоритм");
  expect(mapPanel.textContent).not.toContain("Камера");
  expect(mapPanel.textContent).toContain("Карта лидара");
  expect(mapPanel.textContent).toContain("След лидара");
  expect(mapPanel.textContent).toContain("Разметка осей");
  expect(mapPanel.textContent).not.toContain("Скрытые зоны и покрытия");
  expect(mapPanel.textContent).not.toContain("Отметки препятствий");
  expect(mapPanel.textContent).not.toContain("Карта препятствий");
  expect(mapPanel.querySelectorAll(".map-layer-group summary")).toHaveLength(3);
  await act(async () => [...container.querySelectorAll("nav button")].find(button => button.textContent === "Карта").click());
  expect(mapPanel.hidden).toBe(false);
  expect(telemetryPanel.hidden).toBe(true);
  const zones = [...mapPanel.querySelectorAll("label")].find(label => label.textContent === "Запретные зоны").querySelector("input");
  await act(async () => zones.click());
  expect(zones.checked).toBe(false);
  expect(loadPlannerUiState().mapLayers.zones).toBe(false);
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
  expect([...container.querySelectorAll("label")].find(label => label.textContent === "Запретные зоны").querySelector("input").checked).toBe(false);
});
