import { describe, expect, it, vi } from "vitest";
import { drawDiamond, drawPlannerBackground, getAxisTickStep } from "./plannerCanvasRenderer";

describe("planner canvas renderer", () => {
  it("draws a closed diamond path", () => {
    const ctx = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
    };
    drawDiamond(ctx, 10, 20, 4);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 16);
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.closePath).toHaveBeenCalledOnce();
  });
  it("labels axes in meters with readable ticks that adjust to zoom", () => {
    const ctx = Object.fromEntries(["fillRect", "strokeRect", "beginPath", "moveTo", "lineTo", "stroke", "fillText"].map((key) => [key, vi.fn()]));
    ctx.createLinearGradient = () => ({ addColorStop() {} });
    drawPlannerBackground(ctx, [], { border: false, grid: false, viewScale: 0.4 });
    expect(ctx.fillText).toHaveBeenCalledWith("X, м", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("Y, м", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("-10", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("0", expect.any(Number), expect.any(Number));
    expect(getAxisTickStep(0.4)).toBeGreaterThan(getAxisTickStep(2));
    ctx.fillText.mockClear();
    drawPlannerBackground(ctx, [], { annotate: false, border: false, grid: false });
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
