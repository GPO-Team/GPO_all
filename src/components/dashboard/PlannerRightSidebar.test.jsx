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
function Harness({ onStartMappingSurvey, onExportMapVariant, onAlgorithmPrecisionChange }) {
  const { plannerUiState, setMapLayerVisible } = usePlannerSidebarState();
  return <PlannerRightSidebar telemetry={{ ...INITIAL_TELEMETRY, obstacleMap: { cells: [{ x: 1, y: 2 }] } }}
    telemetryWsUp mapLayers={plannerUiState.mapLayers} onMapLayerChange={setMapLayerVisible}
    routeTaskKey="tsp" algorithmKey="ga_tabu" onRouteTaskChange={vi.fn()} onAlgorithmChange={vi.fn()}
    algorithmPrecision="medium" onAlgorithmPrecisionChange={onAlgorithmPrecisionChange} mappingSurveyMode="double" mappingSurveyModes={[{ key: "double", label: "Двойной" }]}
    onMappingSurveyModeChange={vi.fn()} onStartMappingSurvey={onStartMappingSurvey} mapExportPromptOpen
    onExportMapVariant={onExportMapVariant} onRequestMapExport={vi.fn()} onCancelMapExport={vi.fn()} />;
}
it("separates robot readings from map controls, persists visibility, and keeps survey/export actions working", async () => {
  const survey = vi.fn(), exportMap = vi.fn(), precision = vi.fn();
  await act(async () => root.render(<Harness onStartMappingSurvey={survey} onExportMapVariant={exportMap} onAlgorithmPrecisionChange={precision} />));
  const telemetryPanel = container.querySelector("#planner-right-telemetry");
  const mapPanel = container.querySelector("#planner-right-map");
  expect(telemetryPanel.hidden).toBe(false);
  expect(mapPanel.hidden).toBe(true);
  expect(telemetryPanel.textContent).not.toContain("Алгоритм");
  expect(mapPanel.textContent).toContain("Алгоритм");
  expect(mapPanel.textContent).not.toContain("Размер популяции");
  const precisionButton = text => [...mapPanel.querySelectorAll('[aria-label="Точность расчёта"] button')].find(button => button.textContent === text);
  expect(precisionButton("Средняя").getAttribute("aria-pressed")).toBe("true");
  await act(async () => precisionButton("Большая").click());
  expect(precision).toHaveBeenCalledWith("high");
  expect(mapPanel.textContent).not.toContain("Камера");
  expect(mapPanel.textContent).toContain("Карта лидара");
  expect(mapPanel.textContent).toContain("След лидара");
  expect(mapPanel.textContent).toContain("Разметка осей");
  expect(mapPanel.textContent).not.toContain("Скрытые зоны и покрытия");
  expect(mapPanel.textContent).not.toContain("Отметки препятствий");
  expect(mapPanel.querySelectorAll(".map-layer-group summary")).toHaveLength(3);
  await act(async () => [...container.querySelectorAll("nav button")].find(button => button.textContent === "Карта").click());
  expect(mapPanel.hidden).toBe(false);
  expect(telemetryPanel.hidden).toBe(true);
  const zones = [...mapPanel.querySelectorAll("label")].find(label => label.textContent === "Запретные зоны").querySelector("input");
  await act(async () => zones.click());
  expect(zones.checked).toBe(false);
  expect(loadPlannerUiState().mapLayers.zones).toBe(false);
  const mapButton = text => [...mapPanel.querySelectorAll("button")].find(button => button.textContent === text);
  await act(async () => mapButton("Двойной объезд").click());
  await act(async () => mapButton("Лидар").click());
  expect(survey).toHaveBeenCalledOnce();
  expect(exportMap).toHaveBeenCalledWith("lidar");
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
  expect([...container.querySelectorAll("label")].find(label => label.textContent === "Запретные зоны").querySelector("input").checked).toBe(false);
});
