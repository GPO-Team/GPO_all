import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { usePlannerRouteSender } from "./usePlannerRouteSender";
import { sendRouteChannelPayload } from "../services/routeChannel";
import { listMissions } from "../services/missionClient";

vi.mock("../services/routeChannel", () => ({ sendRouteChannelPayload: vi.fn() }));
vi.mock("../services/missionClient", () => ({ listMissions: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const createSender = () => {
  const editingLockRef = { current: false };
  const track = vi.fn();
  const captured = [];
  function Harness() {
    const send = usePlannerRouteSender({
      optimizedRoute: [{ x: 0, y: 0 }, { x: 1, y: 0 }], routeSeed: [],
      plannerModel: {}, batteryRangeMeters: 100, cruiseSpeedMps: 0.22, payloadKg: 0,
      algorithmKey: "ga", routeTaskKey: "hamiltonian_chain", selectedAlgorithmParams: {},
      routeSocketRef: { current: null }, setStatus: vi.fn(), setEnergyWarning: vi.fn(),
      setIsSubmitting: vi.fn(), editingLockRef, isEditingLocked: () => editingLockRef.current,
      onMissionSubmitted: track,
    });
    captured.push(send);
    return null;
  }
  renderToString(<Harness />);
  return { send: captured[0], editingLockRef, track };
};

it("locks before acknowledgement and prevents duplicate route submission", async () => {
  const { send, editingLockRef } = createSender();
  let accept;
  sendRouteChannelPayload.mockImplementation(() => new Promise(resolve => { accept = resolve; }));
  const pending = send();
  expect(editingLockRef.current).toBe(true);
  send();
  expect(sendRouteChannelPayload).toHaveBeenCalledTimes(1);
  accept(true);
  await pending;
});

it("unlocks after a definitive rejection", async () => {
  const { send, editingLockRef } = createSender();
  sendRouteChannelPayload.mockImplementation(async (_socket, _command, callbacks) => {
    callbacks.onError(new Error("Запретная зона перекрывает путь."));
    return false;
  });
  await send();
  expect(editingLockRef.current).toBe(false);
  expect(listMissions).not.toHaveBeenCalled();
});

it("keeps the graph locked after a lost ACK and recovers the accepted mission", async () => {
  const { send, editingLockRef, track } = createSender();
  let finishRecovery;
  listMissions.mockImplementation(() => new Promise(resolve => { finishRecovery = resolve; }));
  sendRouteChannelPayload.mockImplementation(async (_socket, _command, callbacks) => {
    callbacks.onError(Object.assign(new Error("Lost ACK"), { mayHaveReachedRobot: true }));
    return false;
  });
  await send();
  expect(editingLockRef.current).toBe(true);
  const mission = { missionId: sendRouteChannelPayload.mock.calls[0][1].requestId, status: "running" };
  finishRecovery([mission]);
  await vi.waitFor(() => expect(track).toHaveBeenCalledWith(mission));
  expect(editingLockRef.current).toBe(true);
});
