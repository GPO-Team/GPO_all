import { afterEach, expect, it, vi } from "vitest";
import { createViewport } from "../model/plannerViewport";
import { startPlannerCanvasRenderLoop } from "./plannerCanvasRenderLoop";

const context = () => Object.fromEntries([
  "arc", "beginPath", "fill", "fillRect", "fillText", "strokeText", "lineTo", "moveTo", "setLineDash", "stroke", "strokeRect", "setTransform", "clearRect", "drawImage",
].map(key => [key, vi.fn()]).concat([["createLinearGradient", () => ({ addColorStop() {} })]]));
afterEach(() => vi.unstubAllGlobals());

it("keeps native pixel resolution with thousands of points and repeated zoom, while caching the static scene", () => {
  const front = context(), background = context();
  const cache = { getContext: () => background };
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("document", { createElement: () => cache });
  const canvas = { getContext: () => front };
  const state = {
    visitEntries: Array.from({ length: 2000 }, (_, index) => ({ index, order: index + 1, point: { x: (index % 40) - 20, y: (index % 30) - 15 } })),
    chargeEntries: [], plannedVisitEntryMap: new Map(), zoneEntries: [], surfaceZones: [], optimizedRoute: [], obstacleTrace: [],
    obstacleMap: { cells: [] }, cameraMap: { cells: [], freeCells: [] }, routeBlocked: false,
  };
  const drawStateRef = { current: state };
  const viewportRef = { current: createViewport(960, 700) };
  let nextFrame;
  const stop = startPlannerCanvasRenderLoop({
    canvasRef: { current: canvas }, drawStateRef, viewportRef,
    telemetryTargetRef: { current: { x: 2, y: 1, yaw: 0 } }, telemetryRenderRef: { current: { x: 0, y: 0, yaw: 0 } },
    scheduleFrame: callback => { nextFrame = callback; return 1; }, cancelFrame: vi.fn(),
  });
  expect(canvas.width).toBe(1920);
  expect(canvas.height).toBe(1400);
  expect(background.strokeText).toHaveBeenCalledTimes(2000);
  for (let frame = 0; frame < 60; frame += 1) nextFrame();
  expect(background.strokeText).toHaveBeenCalledTimes(2000);
  drawStateRef.current = { ...state, visitEntries: [...state.visitEntries, ...state.visitEntries] };
  for (const zoom of [8, 0.25, 2, 1]) {
    viewportRef.current = createViewport(960, 700, zoom);
    nextFrame();
    expect([canvas.width, canvas.height]).toEqual([1920, 1400]);
    const expectedMarkerScale = viewportRef.current.fitScale * Math.max(1, zoom);
    expect(front.arc).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 11 / expectedMarkerScale, 0, Math.PI * 2);
  }
  expect(background.strokeText).toHaveBeenCalledTimes(18000);
  stop();
});
