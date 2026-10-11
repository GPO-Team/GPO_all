import { useCallback, useState } from "react";
import { loadPlannerUiState, savePlannerUiState } from "../../../lib/plannerUiState";

export const usePlannerSidebarState = () => {
  const [plannerUiState, setPlannerUiState] = useState(loadPlannerUiState);
  const setSidebarCollapsed = useCallback((key, collapsed) => {
    setPlannerUiState((previous) => {
      const next = { ...previous, [key]: collapsed };
      savePlannerUiState(next);
      return next;
    });
  }, []);
  const setMapLayerVisible = useCallback((key, visible) => {
    setPlannerUiState((previous) => {
      if (!(key in previous.mapLayers)) return previous;
      const next = { ...previous, mapLayers: { ...previous.mapLayers, [key]: visible } };
      savePlannerUiState(next);
      return next;
    });
  }, []);
  return { plannerUiState, setSidebarCollapsed, setMapLayerVisible };
};
