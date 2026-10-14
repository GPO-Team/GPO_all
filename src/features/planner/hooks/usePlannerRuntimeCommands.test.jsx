import React from "react";
import {renderToString} from "react-dom/server";
import {beforeEach,expect,it,vi} from "vitest";
import {usePlannerRuntimeCommands} from "./usePlannerRuntimeCommands";
import {sendRouteChannelPayload} from "../services/routeChannel";
vi.mock("../services/routeChannel", () => ({sendRouteChannelPayload:vi.fn()}));
beforeEach(() => vi.resetAllMocks());

it("propagates a manipulator rejection to its form and preserves retry identity", async () => {
  vi.clearAllMocks();
  const captured = [];
  function Harness() {
    const actions = usePlannerRuntimeCommands({routeSocketRef:{current:null},setStatus:vi.fn()});
    captured.push(actions);
    return null;
  }
  renderToString(<Harness />);
  sendRouteChannelPayload.mockImplementation(async (_socket,_command,callbacks) => {
    callbacks.onError(new Error("Robot has an active command."));
    return false;
  });
  const payload = {objectDef:"PICK_BOX",destination:{x:0.4,y:0.1,z:0.04}};
  await expect(captured[0].startPickPlace(payload)).rejects.toThrow("Robot has an active command.");
  await expect(captured[0].startPickPlace(payload)).rejects.toThrow();
  expect(sendRouteChannelPayload.mock.calls[1][1].requestId).toBe(sendRouteChannelPayload.mock.calls[0][1].requestId);
});

it("keeps survey identity after a lost ACK and hands the accepted mission to tracking", async () => {
  const track = vi.fn();
  const status = vi.fn();
  const captured = [];
  function Harness() {
    const actions = usePlannerRuntimeCommands({mappingSurveyMode:"snake",batteryRangeMeters:100,payloadKg:0,
      routeSocketRef:{current:null},setStatus:status,onMissionSubmitted:track});
    captured.push(actions);
    return null;
  }
  renderToString(<Harness />);
  const [actions] = captured;
  sendRouteChannelPayload.mockImplementationOnce(async (_socket,_command,callbacks) => {
    callbacks.onError(new Error("Lost ACK"));
    return false;
  });
  sendRouteChannelPayload.mockImplementation(async (_socket,command,callbacks) => {
    callbacks.onSent({missionId:command.requestId,status:"persisted"});
    return true;
  });
  await actions.startMappingSurvey();
  expect(track).not.toHaveBeenCalled();
  await actions.startMappingSurvey();
  const first = sendRouteChannelPayload.mock.calls[0][1];
  expect(sendRouteChannelPayload.mock.calls[1][1]).toEqual(first);
  expect(track).toHaveBeenCalledWith({missionId:first.requestId,status:"persisted"});
  await actions.startMappingSurvey();
  expect(sendRouteChannelPayload.mock.calls[2][1].requestId).not.toBe(first.requestId);
});

it("shows a large-box rejection and safely retries the same mission", async () => {
  const track = vi.fn();
  const captured = [];
  function Harness() {
    const actions = usePlannerRuntimeCommands({
      plannerModel: {}, batteryRangeMeters: 100, payloadKg: 0,
      routeSocketRef: { current: null }, setStatus: vi.fn(), onMissionSubmitted: track,
    });
    captured.push(actions);
    return null;
  }
  renderToString(<Harness />);
  const [actions] = captured;
  sendRouteChannelPayload.mockImplementationOnce(async (_socket, _command, callbacks) => {
    callbacks.onError(new Error("Путь к коробке перекрыт."));
    return false;
  });
  await expect(actions.startObjectTransfer({ x: 2, y: 0.6 })).rejects.toThrow("Путь к коробке перекрыт.");
  sendRouteChannelPayload.mockImplementation(async (_socket, command, callbacks) => {
    callbacks.onSent({ missionId: command.requestId, status: "persisted" });
    return true;
  });
  await actions.startObjectTransfer({ x: 2, y: 0.6 });
  const first = sendRouteChannelPayload.mock.calls[0][1];
  expect(first.requestId).toBeTruthy();
  expect(sendRouteChannelPayload.mock.calls[1][1]).toEqual(first);
  expect(track).toHaveBeenCalledWith({ missionId: first.requestId, status: "persisted" });
  await actions.startObjectTransfer({ x: 2, y: 0.6 });
  expect(sendRouteChannelPayload.mock.calls[2][1].requestId).not.toBe(first.requestId);
});
