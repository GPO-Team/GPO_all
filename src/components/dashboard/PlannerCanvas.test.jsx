// @vitest-environment jsdom
import React, { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PlannerCanvas from "./PlannerCanvas";
import { INITIAL_TELEMETRY } from "../../lib/telemetry/dashboardTelemetryState";
import { worldToCanvas } from "../../lib/zonePlannerCoordinates";

vi.mock("../../features/planner/services/plannerCanvasRenderLoop", () => ({ startPlannerCanvasRenderLoop: () => () => {} }));
vi.mock("../../features/planner/model/plannerCanvasDrawState", () => ({ createPlannerCanvasDrawState: () => ({}) }));

it("commits one obstacle move on release and cancels an interrupted drag without placing points", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const container = document.createElement("div");
  const root = createRoot(container);
  const canvasRef = createRef();
  const apply = vi.fn(), select = vi.fn(), place = vi.fn();
  const obstacle = { commandId: 42, confirmed: true, status: "accepted", x: 0, y: 0, sizeX: 1, sizeY: 1, height: 0.8 };
  try {
    await act(async () => root.render(<PlannerCanvas canvasRef={canvasRef} telemetry={INITIAL_TELEMETRY}
      runtimeObstacles={[obstacle]} onEditRuntimeObstacle={apply} onSelectRuntimeObstacle={select} onCanvasClick={place} />));
    const canvas = canvasRef.current;
    canvas.plannerViewport = { scale: 1, x: 0, y: 0 };
    canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = () => false;
    const pointer = (type, x, y) => {
      const point = worldToCanvas(x, y);
      canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: point.x, clientY: point.y }));
    };
    await act(async () => pointer("pointerdown", 0, 0));
    await act(async () => pointer("pointermove", 2, 3));
    expect(apply).not.toHaveBeenCalled();
    await act(async () => pointer("pointerup", 2, 3));
    await act(async () => canvas.click());
    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith(42, { x: 2, y: 3, sizeX: 1, sizeY: 1, height: 0.8 });
    expect(place).not.toHaveBeenCalled();
    await act(async () => pointer("pointerdown", 0, 0));
    await act(async () => pointer("pointermove", 1, 1));
    await act(async () => pointer("pointercancel", 1, 1));
    expect(apply).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("returns from panning to point placement when a menu section is selected", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const container = document.createElement("div");
  const root = createRoot(container);
  const canvasRef = createRef();
  const onCanvasClick = vi.fn();
  const render = (revision) => root.render(<PlannerCanvas canvasRef={canvasRef} telemetry={INITIAL_TELEMETRY} onCanvasClick={onCanvasClick} pointPlacementRevision={revision} />);
  try {
    await act(async () => render(0));
    await act(async () => container.querySelector('button[aria-pressed]').click());
    expect(container.querySelector('button[aria-pressed]').getAttribute("aria-pressed")).toBe("true");
    await act(async () => canvasRef.current.click());
    expect(onCanvasClick).not.toHaveBeenCalled();
    await act(async () => render(1));
    expect(container.querySelector('button[aria-pressed]').getAttribute("aria-pressed")).toBe("false");
    await act(async () => canvasRef.current.click());
    expect(onCanvasClick).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
