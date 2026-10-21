// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerRouteOptimization } from "./usePlannerRouteOptimization";
import { usePlannerBridgeSync } from "./usePlannerBridgeSync";
import { usePlannerRouteRebuild } from "./usePlannerRouteRebuild";
import { usePlannerRouteSender } from "./usePlannerRouteSender";
import { prepareRouteOnServer, solveRouteWithNativeAlgorithm } from "../../../lib/routeAlgorithms";
import { sendRouteChannelPayload } from "../services/routeChannel";

vi.mock("../../../lib/routeAlgorithms", () => ({ solveRouteWithNativeAlgorithm: vi.fn(), prepareRouteOnServer: vi.fn(), getAlgorithmLabel: () => "GA", getTaskLabel: () => "TSP" }));
vi.mock("../services/routeChannel", () => ({ sendRouteChannelPayload: vi.fn() }));
let root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; root = createRoot(document.createElement("div")); vi.clearAllMocks(); });
afterEach(async () => { await act(async () => root.unmount()); });

const routeProps = () => ({
  algorithmKey: "ga_tabu", batteryRangeMeters: 100, energyOptions: {}, isOptimizing: false,
  plannerModel: { visitPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }], previewPolygons: [], surfaceZones: [], chargePoints: [], adjustedVisits: [] },
  routeTaskKey: "tsp", selectedAlgorithmParams: {},
  setEnergyWarning: vi.fn(), setIsOptimizing: vi.fn(), setOptimizedRoute: vi.fn(),
  setRouteEnergyStats: vi.fn(), setRouteSeed: vi.fn(), setStatus: vi.fn(), telemetry: {},
});

describe("planner lifecycle regressions", () => {
  it("sends projected safe visit coordinates to the planning service", async () => {
    const props = routeProps();
    props.plannerModel.visitEntries = [
      { point: { x: 0, y: 0 } },
      { point: { x: 3, y: 0 } },
    ];
    props.plannerModel.visitPoints = [
      { x: 1.45, y: 0 },
      { x: 3, y: 0 },
    ];
    solveRouteWithNativeAlgorithm.mockResolvedValue({
      seedRoute: props.plannerModel.visitPoints,
      planning: { ok: true, route: props.plannerModel.visitPoints },
    });
    let optimize;
    function Harness() {
      const action = usePlannerRouteOptimization(props);
      React.useEffect(() => { optimize = action; });
      return null;
    }

    await act(async () => root.render(<Harness />));
    await act(async () => optimize());

    expect(solveRouteWithNativeAlgorithm.mock.calls[0][0]).toEqual(props.plannerModel.visitPoints);
  });

  it("submits the numbered seed unchanged for server safety validation", async () => {
    const seed = [{ x: 4, y: 3 }, { x: -3, y: 2 }, { x: 2, y: 1 }];
    const props = { ...routeProps(), driveMode: "ordered", optimizedRoute: seed,
      routeSeed: seed, routeSocketRef: { current: null } };
    let send;
    function Harness() {
      const action = usePlannerRouteSender(props);
      React.useEffect(() => { send = action; });
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => send());
    const command = sendRouteChannelPayload.mock.calls[0][1];
    expect(command.payload.seedRoute).toEqual(seed);
    expect(command.payload.algorithm.task).toBe("hamiltonian_chain");
  });
  it("preserves numbered visit order with obstacle detours without calling the optimizer", async () => {
    const props = routeProps();
    props.driveMode = "ordered";
    props.plannerModel.visitPoints = [{ x: -4, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }];
    props.plannerModel.previewPolygons = [{ points: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }] }];
    let optimize;
    function Harness() {
      const action = usePlannerRouteOptimization(props);
      React.useEffect(() => { optimize = action; });
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => optimize());
    expect(solveRouteWithNativeAlgorithm).not.toHaveBeenCalled();
    expect(props.setRouteSeed).toHaveBeenCalledWith(props.plannerModel.visitPoints);
    const route = props.setOptimizedRoute.mock.calls[0][0];
    expect(route.length).toBeGreaterThan(3);
    const positions = props.plannerModel.visitPoints.map((visit) => route.findIndex((point) => point.x === visit.x && point.y === visit.y));
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBeGreaterThan(positions[0]);
    expect(positions[2]).toBe(route.length - 1);
  });

  it("rejects an ordered route with insufficient energy", async () => {
    const props = { ...routeProps(), driveMode: "ordered", batteryRangeMeters: 0.01 };
    let optimize;
    function Harness() {
      const action = usePlannerRouteOptimization(props);
      React.useEffect(() => { optimize = action; });
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => optimize());
    expect(props.setOptimizedRoute).toHaveBeenCalledWith([]);
    expect(props.setStatus.mock.calls.at(-1)[0]).toMatch(/запас|достижим/i);
    expect(solveRouteWithNativeAlgorithm).not.toHaveBeenCalled();
  });
  it("aborts a stale solve and does not restore deleted points", async () => {
    const pending = Promise.withResolvers();
    solveRouteWithNativeAlgorithm.mockReturnValue(pending.promise);
    const actions = {};
    function Harness({ config }) {
      const optimize = usePlannerRouteOptimization(config);
      React.useEffect(() => { actions.optimize = optimize; });
      return null;
    }
    const props = routeProps();
    await act(async () => root.render(<Harness config={props} />));
    let completion;
    await act(async () => { completion = actions.optimize(); });
    const signal = solveRouteWithNativeAlgorithm.mock.calls[0][4];
    await act(async () => root.render(<Harness config={{ ...props, plannerModel: { ...props.plannerModel, visitPoints: [] } }} />));
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ route: props.plannerModel.visitPoints }); await completion; });
    expect(props.setRouteSeed).not.toHaveBeenCalled();
    expect(props.setOptimizedRoute).not.toHaveBeenCalled();
    expect(props.setIsOptimizing).toHaveBeenLastCalledWith(false);
  });

  it("resends current zones and motion on every connection", async () => {
    const props = { routeSocketRef: { current: null }, routeConnected: false,
      batteryRangeMeters: 100, cruiseSpeedMps: 0.2, payloadKg: 0, setStatus: vi.fn(),
      zoneSyncPayloadText: '{"type":"limit_zones","zones":[]}', surfaceSyncPayloadText: '{"type":"surface_zones","zones":[]}' };
    function Harness({ connected }) { usePlannerBridgeSync({ ...props, routeConnected: connected }); return null; }
    await act(async () => root.render(<Harness connected={false} />));
    expect(sendRouteChannelPayload).not.toHaveBeenCalled();
    await act(async () => root.render(<Harness connected />));
    expect(sendRouteChannelPayload).toHaveBeenCalledTimes(3);
    await act(async () => root.render(<Harness connected={false} />));
    await act(async () => root.render(<Harness connected />));
    expect(sendRouteChannelPayload).toHaveBeenCalledTimes(6);
  });

  it("re-plans a changed scene on the planning service without sending a route command", async () => {
    vi.useFakeTimers();
    try {
      const route = [{x:0,y:0},{x:0.5,y:0.2},{x:1,y:0}];
      prepareRouteOnServer.mockResolvedValue({ ok: true, route, routeEnergy: 2 });
      const props = { ...routeProps(), chargePointsRoutingText: "[]", previewPolygonRoutingText: "[]",
        routeSeed: [{x:0,y:0},{x:1,y:0}], surfaceZones: [], zoneSyncPayloadText: '{"zones":[]}',
        surfaceSyncPayloadText: '{"zones":[]}', routeSocketRef: {current:null}, startRouteTiming: vi.fn() };
      function Harness({ config }) { usePlannerRouteRebuild(config); return null; }
      await act(async () => root.render(<Harness config={props} />));
      await act(async () => vi.advanceTimersByTimeAsync(500));
      expect(prepareRouteOnServer).not.toHaveBeenCalled();
      await act(async () => root.render(<Harness config={{ ...props, batteryRangeMeters: 90 }} />));
      await act(async () => vi.advanceTimersByTimeAsync(500));
      expect(prepareRouteOnServer).toHaveBeenCalledWith(props.routeSeed,
        expect.objectContaining({ motion: expect.objectContaining({ batteryRange: 90 }) }), expect.any(AbortSignal));
      expect(props.setOptimizedRoute).toHaveBeenCalledWith(route);
      expect(sendRouteChannelPayload).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the energy warning when the server reports a shortage after a scene change", async () => {
    vi.useFakeTimers();
    try {
      prepareRouteOnServer.mockRejectedValue(Object.assign(new Error("Не хватает заряда"), { reason: "insufficient_range" }));
      const props = { ...routeProps(), chargePointsRoutingText: "[]", previewPolygonRoutingText: "[]",
        routeSeed: [{x:0,y:0},{x:1,y:0}], surfaceZones: [] };
      function Harness({ config }) { usePlannerRouteRebuild(config); return null; }
      await act(async () => root.render(<Harness config={props} />));
      await act(async () => root.render(<Harness config={{ ...props, batteryRangeMeters: 1 }} />));
      await act(async () => vi.advanceTimersByTimeAsync(500));
      expect(props.setEnergyWarning).toHaveBeenLastCalledWith("Не хватает заряда");
      expect(props.setOptimizedRoute).toHaveBeenLastCalledWith([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
