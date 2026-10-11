// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePlannerRuntimeCommands } from "./usePlannerRuntimeCommands";
import { sendRouteChannelPayload } from "../services/routeChannel";

vi.mock("../services/routeChannel", () => ({ sendRouteChannelPayload: vi.fn() }));

it("tracks exact spawn sizes and independent acknowledgements and failures", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  const root = createRoot(document.createElement("div"));
  let actions;
  function Harness() {
    const currentActions = usePlannerRuntimeCommands({ plannerModel: { polygons: [] }, points: [],
      telemetry: { x: 0, y: 0 }, optimizedRoute: [], setStatus: vi.fn(), routeSocketRef: { current: null } });
    React.useEffect(() => { actions = currentActions; });
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => { actions.addRandomObstacle(); actions.addRandomObstacle(); });
    const [first, second] = sendRouteChannelPayload.mock.calls;
    expect(first[1].commandId).not.toBe(second[1].commandId);
    expect(actions.runtimeObstacles[0]).toMatchObject({ ...first[1].obstacle, status: "sending" });
    await act(async () => second[2].onSent());
    await act(async () => first[2].onError(new Error("Bridge offline")));
    expect(actions.runtimeObstacles.map(({ status }) => status)).toEqual(["error", "accepted"]);
    expect(actions.runtimeObstacles[0].error).toBe("Bridge offline");
  } finally { await act(async () => root.unmount()); }
});
