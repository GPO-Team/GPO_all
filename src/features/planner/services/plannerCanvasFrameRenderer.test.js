import { describe, expect, it, vi } from "vitest";
import { renderPlannerCanvasFrame } from "./plannerCanvasFrameRenderer";

const createContext = () => ({
  arc: vi.fn(),
  beginPath: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setLineDash: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
});

describe("planner canvas frame renderer", () => {
  it("shows the sensor dots and current lidar trace independently", () => {
    const state = {
      visitEntries: [], chargeEntries: [], plannedVisitEntryMap: new Map(),
      zoneEntries: [], surfaceZones: [], optimizedRoute: [],
      obstacleTrace: [{ x: 1, y: 2 }],
      cameraMap: { cells: [{ x: 2, y: 3 }], freeCells: [{ x: 3, y: 4 }] },
      mapLayers: { lidar: true, lidarTrace: false, camera: false, route: false, robot: false, axes: false, grid: false },
    };
    const ctx = createContext();
    renderPlannerCanvasFrame(ctx, state, { x: 0, y: 0, yaw: 0 });
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    ctx.arc.mockClear();
    ctx.fillRect.mockClear();
    state.mapLayers = { ...state.mapLayers, lidar: false, lidarTrace: true, camera: true, route: true };
    renderPlannerCanvasFrame(ctx, state, { x: 0, y: 0, yaw: 0 });
    expect(ctx.arc).toHaveBeenCalledOnce();
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    ctx.arc.mockClear();
    state.mapLayers.lidarTrace = false;
    renderPlannerCanvasFrame(ctx, state, { x: 0, y: 0, yaw: 0 });
    expect(ctx.arc).not.toHaveBeenCalled();
  });
  it("renders the background and robot for an empty planner state", () => {
    const ctx = createContext();

    renderPlannerCanvasFrame(
      ctx,
      {
        visitEntries: [],
        chargeEntries: [],
        plannedVisitEntryMap: new Map(),
        zoneEntries: [],
        surfaceZones: [],
        optimizedRoute: [],
        obstacleTrace: [],
        obstacleMap: { cells: [] },
        cameraMap: { cells: [], freeCells: [] },
        routeBlocked: false,
        hoveredPointIndex: null,
      },
      { x: 0, y: 0, yaw: 0 }
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 11, 0, Math.PI * 2);
  });

  it("hides map objects without deleting their underlying data", () => {
    const ctx = createContext();
    const state = {
      visitEntries: [{ index: 0, order: 1, point: { x: 1, y: 2 } }],
      chargeEntries: [{ index: 1, order: 1, point: { x: 3, y: 4 } }],
      plannedVisitEntryMap: new Map(), zoneEntries: [{ points: [] }],
      surfaceZones: [{ points: [{ x: 0, y: 0 }] }],
      optimizedRoute: [{ x: 0, y: 0 }, { x: 1, y: 2 }],
      obstacleMap: { cells: [{ x: 5, y: 6 }] }, cameraMap: { cells: [{ x: 7, y: 8 }] },
      mapLayers: Object.fromEntries(["visits", "charges", "zones", "surfaces", "route", "lidar", "camera", "robot", "axes", "grid"].map(key => [key, false])),
    };
    renderPlannerCanvasFrame(ctx, state, { x: 0, y: 0, yaw: 0 });
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(state.visitEntries).toHaveLength(1);
    expect(state.optimizedRoute).toHaveLength(2);
    expect(state.zoneEntries).toHaveLength(1);
  });
});
