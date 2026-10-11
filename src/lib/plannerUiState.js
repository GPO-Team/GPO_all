import { createDefaultMapLayers, normalizeMapLayers } from "../features/planner/model/mapLayers";

const STORAGE_KEY = "gpo.planner.ui.v2";

const defaultState = () => ({
  leftCollapsed: false,
  rightCollapsed: true,
  mapLayers: createDefaultMapLayers(),
});

export function loadPlannerUiState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      mapLayers: normalizeMapLayers(parsed.mapLayers),
    };
  } catch {
    return defaultState();
  }
}

export function savePlannerUiState(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/private mode limitations.
  }
}
