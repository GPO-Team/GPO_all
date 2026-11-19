import { describe, expect, it, vi } from "vitest";
import { renderPlannerPointLayer } from "./plannerCanvasPointRenderer";
import { drawPlannerBackground } from "./plannerCanvasRenderer";
import { renderPlannerRouteLayer } from "./plannerCanvasRouteRenderer";

describe("map visual states", () => {
  it("distinguishes ordered and free points without changing their coordinates", () => {
    const fills = [];
    const ctx = Object.fromEntries(["arc", "beginPath", "fillText", "lineTo", "moveTo", "setLineDash", "stroke", "strokeText"].map(key => [key, vi.fn()]));
    ctx.fill = () => fills.push(ctx.fillStyle);
    renderPlannerPointLayer(ctx, { visitEntries: [
      { index: 0, order: 1, point: { x: 0, y: 0, kind: "visit" } },
      { index: 1, order: null, point: { x: 1, y: 0, kind: "free_visit" } },
    ], chargeEntries: [], plannedVisitEntryMap: new Map() });
    expect(fills).toEqual(["#a855f7", "#14b8a6"]);
    expect(ctx.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
  });
  it("switches map background for dark theme and highlights blocked routes", () => {
    const fills = [];
    const ctx = Object.fromEntries(["fillRect", "strokeRect", "beginPath", "moveTo", "lineTo", "stroke", "fillText"].map(key => [key, vi.fn()]));
    ctx.createLinearGradient = () => ({ addColorStop: vi.fn() });
    Object.defineProperty(ctx, "fillStyle", { set: value => { fills.push(value); } });
    drawPlannerBackground(ctx, [], { dark: true, grid: false, annotate: false });
    expect(fills).toContain("#111f2c");
    renderPlannerRouteLayer(ctx, { optimizedRoute: [{ x: 0, y: 0 }, { x: 1, y: 1 }], routeBlocked: true });
    expect(ctx.strokeStyle).toBe("#dc2626");
  });
});
