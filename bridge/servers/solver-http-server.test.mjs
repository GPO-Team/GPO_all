import { afterEach, describe, expect, it } from "vitest";
import serverModule from "./solver-http-server.cjs";
import { createPlanningRequest, unwrapPlanningResult } from "../../shared/contracts/index.js";

const { createSolverHttpServer } = serverModule;

let activeServer = null;

afterEach(async () => {
  if (!activeServer) return;
  await new Promise((resolve) => activeServer.close(resolve));
  activeServer = null;
});

const listenForTest = async (nativeSolver) => {
  const instance = createSolverHttpServer({
    coordinateContract: { version: 1 },
    host: "127.0.0.1",
    nativeSolver,
    port: 0,
    solverPath: "/test/solver",
  });
  activeServer = instance.server;
  await new Promise((resolve) => activeServer.listen(0, "127.0.0.1", resolve));
  const address = activeServer.address();
  return `http://127.0.0.1:${address.port}`;
};

const solveRequest = (baseUrl, points = [{ x: 0, y: 0 }, { x: 1, y: 0 }]) =>
  fetch(`${baseUrl}/api/solve-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points,
      task: "tsp",
      algorithm: { key: "ga_tabu", params: {} },
    }),
  });

const prepareRequest = (baseUrl, batteryRange) =>
  fetch(`${baseUrl}/api/prepare-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seedRoute: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }],
      scene: { polygons: [], surfaceZones: [], chargingStations: [], motion: { cruiseSpeedMps: 0.22, payloadKg: 0, batteryRange } },
    }),
  });

describe("solver HTTP server", () => {
  it("imports an uploaded graph file", async () => {
    const baseUrl = await listenForTest({ solverExists: async () => true });
    const response = await fetch(`${baseUrl}/api/import-graph`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent("граф.csv") },
      body: "x,y,type\n1,2,visit\n3,4,charge\n",
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.sourceName).toBe("граф.csv");
    expect(body.graph.points.map((point) => point.kind)).toEqual(["visit", "charge"]);
  });

  it("re-plans an ordered route against the scene and reports energy shortages", async () => {
    const baseUrl = await listenForTest({ solverExists: async () => true });
    const prepared = await prepareRequest(baseUrl, 100);
    const body = await prepared.json();
    expect(prepared.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.planning.routeEnergy).toBeGreaterThan(0);
    expect(body.route.length).toBeGreaterThanOrEqual(3);
    const short = await prepareRequest(baseUrl, 1);
    expect(short.status).toBe(422);
    expect(await short.json()).toMatchObject({ ok: false, reason: "insufficient_range" });
  });

  it("rejects untrusted browser origins and reflects only allowed origins", async () => {
    const baseUrl = await listenForTest({ solverExists: async () => true });
    const rejected = await fetch(`${baseUrl}/health`, { headers: { Origin: "https://untrusted.example" } });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
    const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://127.0.0.1:5173" } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
  });
  it("reports health without requiring a solver run", async () => {
    const baseUrl = await listenForTest({
      solverExists: async () => false,
      run: async () => {
        throw new Error("must not run");
      },
    });

    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      coordinateContractVersion: 1,
      solverAvailable: false,
      solverPath: "/test/solver",
    });
  });

  it("keeps the existing solve-route response contract", async () => {
    const baseUrl = await listenForTest({
      solverExists: async () => true,
      run: async () => ({
        length: 1,
        closed: true,
        order: [0, 1],
        route: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
    });

    const response = await fetch(`${baseUrl}/api/solve-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        task: "tsp",
        algorithm: { key: "ga_tabu", params: {} },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      task: "tsp",
      algorithm: "ga_tabu",
      route: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
  });

  it("returns a matched planning result contract for a versioned request", async () => {
    const baseUrl = await listenForTest({
      solverExists: async () => true,
      run: async () => ({
        length: 1,
        closed: true,
        order: [0],
        route: [{ x: 0, y: 0 }],
      }),
    });
    const request = createPlanningRequest({
      source: "planner-frontend",
      requestId: "planning-77",
      timestamp: "2026-01-01T00:00:00.000Z",
      payload: {
        points: [{ x: 0, y: 0 }],
        task: "tsp",
        algorithm: { key: "ga_tabu", params: {} },
      },
    });

    const response = await fetch(`${baseUrl}/api/solve-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      contractVersion: 1,
      type: "planning.result",
      source: "planning-service",
      requestId: "planning-77",
    });
    expect(unwrapPlanningResult(result)).toMatchObject({ ok: true, route: [{ x: 0, y: 0 }] });
  });

  it("returns 400 without invoking the solver for oversized routes", async () => {
    let runCount = 0;
    const baseUrl = await listenForTest({
      solverExists: async () => true,
      run: async () => {
        runCount += 1;
      },
    });
    const points = Array.from({ length: 1001 }, (_, index) => ({ x: index, y: 0 }));

    const response = await solveRequest(baseUrl, points);

    expect(response.status).toBe(400);
    expect(runCount).toBe(0);
  });

  it("allows only two native solver runs at once", async () => {
    const releases = [];
    let runCount = 0;
    const baseUrl = await listenForTest({
      solverExists: async () => true,
      run: async () => {
        runCount += 1;
        return new Promise((resolve) => releases.push(() => resolve({
          length: 1,
          closed: true,
          order: [0, 1],
          route: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        })));
      },
    });

    const first = solveRequest(baseUrl);
    const second = solveRequest(baseUrl);
    while (runCount < 2) await new Promise((resolve) => setTimeout(resolve, 5));

    const thirdRequest = solveRequest(baseUrl);
    const third = await thirdRequest.finally(() => releases.forEach((release) => release()));
    expect(third.status).toBe(503);
    expect(runCount).toBe(2);

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
  });
});
