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
    const id = second[1].commandId;
    const original = second[1].obstacle;
    const geometry = { x: 2, y: 3, sizeX: 1.2, sizeY: 0.7, height: 0.8 };
    await act(async () => { actions.editRuntimeObstacle(id, geometry); actions.editRuntimeObstacle(id, geometry); });
    expect(sendRouteChannelPayload).toHaveBeenCalledTimes(3);
    const edit = sendRouteChannelPayload.mock.calls.at(-1);
    expect(edit[1]).toMatchObject({ type: "update_runtime_obstacle", obstacleId: id, obstacle: geometry });
    expect(edit[1].commandId).toBeGreaterThan(id);
    await act(async () => edit[2].onError(new Error("Robot busy")));
    expect(actions.runtimeObstacles[1]).toMatchObject({ ...original, confirmed: true, status: "error" });
    await act(async () => actions.editRuntimeObstacle(id, geometry));
    await act(async () => sendRouteChannelPayload.mock.calls.at(-1)[2].onSent());
    expect(actions.runtimeObstacles[1]).toMatchObject({ ...geometry, commandId: id, status: "accepted" });
    await act(async () => actions.selectRuntimeObstacle(id));
    await act(async () => actions.deleteRuntimeObstacle(id));
    const deletion = sendRouteChannelPayload.mock.calls.at(-1);
    expect(deletion[1]).toMatchObject({ type: "delete_runtime_obstacle", obstacleId: id });
    expect(actions.runtimeObstacles[1]).toMatchObject({ ...geometry, status: "deleting" });
    await act(async () => deletion[2].onError(new Error("Robot busy")));
    expect(actions.runtimeObstacles[1]).toMatchObject({ ...geometry, status: "error" });
    await act(async () => actions.deleteRuntimeObstacle(id));
    await act(async () => sendRouteChannelPayload.mock.calls.at(-1)[2].onSent());
    expect(actions.runtimeObstacles).toHaveLength(1);
    expect(actions.activeRuntimeObstacleId).toBeNull();
  } finally { await act(async () => root.unmount()); }
});
