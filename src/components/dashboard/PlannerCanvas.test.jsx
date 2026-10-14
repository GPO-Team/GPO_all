// @vitest-environment jsdom
import React, { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PlannerCanvas from "./PlannerCanvas";
import { INITIAL_TELEMETRY } from "../../lib/telemetry/dashboardTelemetryState";

vi.mock("../../features/planner/services/plannerCanvasRenderLoop", () => ({ startPlannerCanvasRenderLoop: () => () => {} }));
vi.mock("../../features/planner/model/plannerCanvasDrawState", () => ({ createPlannerCanvasDrawState: () => ({}) }));

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
