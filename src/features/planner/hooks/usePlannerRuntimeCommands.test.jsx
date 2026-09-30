import React from "react";
import {renderToString} from "react-dom/server";
import {expect,it,vi} from "vitest";
import {usePlannerRuntimeCommands} from "./usePlannerRuntimeCommands";
import {sendRouteChannelPayload} from "../services/routeChannel";
vi.mock("../services/routeChannel", () => ({sendRouteChannelPayload:vi.fn()}));

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
