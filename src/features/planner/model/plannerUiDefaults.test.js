// @vitest-environment jsdom
import { expect, it } from "vitest";
import { loadPlannerUiState, savePlannerUiState } from "../../../lib/plannerUiState";

it("starts with the right panel closed while retaining saved map visibility and left panel state", () => {
  localStorage.clear();
  expect(loadPlannerUiState().rightCollapsed).toBe(true);
  savePlannerUiState({ leftCollapsed: true, rightCollapsed: false, mapLayers: { axes: true, axisLabels: false, grid: false } });
  const next = loadPlannerUiState();
  expect(next.rightCollapsed).toBe(true);
  expect(next.leftCollapsed).toBe(true);
  expect(next.mapLayers).toMatchObject({ axes: true, axisLabels: false, grid: false });
  localStorage.clear();
});
