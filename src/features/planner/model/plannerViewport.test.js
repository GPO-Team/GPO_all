import { describe, expect, it } from "vitest";
import { worldToCanvas, canvasToWorld, DRAWING_WIDTH, DRAWING_HEIGHT } from "../../../lib/zonePlannerCoordinates";
import { createViewport, getCanvasEventPosition, getMapScaleBar, screenToMap, zoomAt } from "./plannerViewport";

describe("map viewport coordinates", () => {
  it.each([3, 12, 25, 55, 100, 400])("keeps the scale bar accurate at %s pixels per meter", (pixelsPerMeter) => {
    const bar = getMapScaleBar(pixelsPerMeter);
    expect(bar.width).toBeCloseTo(bar.meters * pixelsPerMeter);
    expect(bar.width).toBeLessThanOrEqual(120);
    expect(bar.width).toBeGreaterThanOrEqual(48);
  });
  it.each([0.25, 1, 2, 8])("places a point under the cursor at zoom %s, regardless of DPR", (zoom) => {
    const viewport = createViewport(960, 700, zoom, { x: 137, y: -92 });
    const logical = worldToCanvas(8.3, -4.7);
    for (const dpr of [1, 1.25, 2, 3]) {
      const canvas = {
        width: 960 * dpr, height: 700 * dpr, plannerViewport: viewport,
        getBoundingClientRect: () => ({ left: 300, top: 52, width: 960, height: 700 }),
      };
      const clicked = getCanvasEventPosition(canvas, { clientX: 300 + logical.x * viewport.scale + viewport.x, clientY: 52 + logical.y * viewport.scale + viewport.y });
      const point = canvasToWorld(clicked.x, clicked.y);
      expect(point.x).toBeCloseTo(8.3, 8);
      expect(point.y).toBeCloseTo(-4.7, 8);
    }
  });

  it("keeps the world point beneath the wheel cursor anchored", () => {
    const pan = { x: -52, y: 37 };
    const viewport = createViewport(1100, 760, 1.5, pan);
    const anchor = { x: 300, y: 140 };
    const before = screenToMap(viewport, anchor);
    const nextPan = zoomAt(viewport, anchor, 1.5, 4, pan);
    const after = screenToMap(createViewport(1100, 760, 4, nextPan), anchor);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it("fits the whole map at 100% after panels or window resize", () => {
    for (const [width, height] of [[320, 700], [670, 668], [1920, 1028]]) {
      const viewport = createViewport(width, height);
      expect(DRAWING_WIDTH * viewport.scale).toBeLessThanOrEqual(width + 1e-8);
      expect(DRAWING_HEIGHT * viewport.scale).toBeLessThanOrEqual(height + 1e-8);
      expect(Math.min(width - DRAWING_WIDTH * viewport.scale, height - DRAWING_HEIGHT * viewport.scale)).toBeCloseTo(0);
    }
  });
});
