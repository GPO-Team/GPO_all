import { describe, expect, it, vi } from "vitest";
import {
  createCanvasProps,
  createLeftSidebarProps,
  createRightSidebarProps,
} from "./dashboardPlannerWorkspaceProps";

describe("dashboard planner workspace props", () => {
  it("adapts canvas state and editor actions", () => {
    const canvasRef = { current: null };
    const addPointFromCanvas = vi.fn();
    const props = createCanvasProps({
      state: {
        canvas: { canvasRef },
        route: { optimizedRoute: [1] },
        interaction: { hoveredPointIndex: 2 },
      },
      runtime: { telemetry: { x: 1 } },
      derived: { plannerModel: { routeLength: 3 } },
      actions: { addPointFromCanvas },
    });

    expect(props).toMatchObject({ canvasRef, optimizedRoute: [1], hoveredPointIndex: 2 });
    expect(props.onCanvasClick).toBe(addPointFromCanvas);
  });

  it("creates point-specific clear handlers for the left sidebar", () => {
    const clearPoints = vi.fn();
    const setMapExportPromptOpen = vi.fn();
    const props = createLeftSidebarProps({
      state: { route: { optimizedRoute: [] }, interaction: { setMapExportPromptOpen }, surfaces: { surfaceZones: [] } },
      runtime: {},
      derived: { plannerModel: { visitEntries: [], chargeEntries: [], zoneEntries: [], polygons: [], adjustedVisits: [] } },
      actions: { clearPoints },
    });

    props.onClearVisitPoints();
    props.onClearChargePoints();
    props.onClearLimitPoints();
    props.onCancelMapExport();
    expect(clearPoints.mock.calls).toEqual([["visit"], ["charge"], ["limit"]]);
    expect(setMapExportPromptOpen).toHaveBeenCalledWith(false);
  });

  it("adapts runtime status and right-sidebar actions", () => {
    const props = createRightSidebarProps({
      state: { interaction: {} },
      runtime: { telemetryWsUp: true, routeWsUp: false, solverApiUp: true },
      derived: { plannerModel: { zoneEntries: [], visitEntries: [], chargeEntries: [], plannedVisitEntries: [], visitsInsideLimit: [], polygons: [], adjustedVisits: [] } },
      actions: {},
    });

    expect(props).toMatchObject({ telemetryWsUp: true, routeWsUp: false, solverApiUp: true });
  });
});
