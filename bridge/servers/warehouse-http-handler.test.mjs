import { describe, expect, it } from "vitest";
import routeModule from "./route-server.cjs";
import warehouseModule from "../services/warehouse-service.cjs";

const rack = {
  id: "r",
  code: "R",
  name: "Rack",
  x: 0,
  y: 0,
  yaw: 0,
  bays: 1,
  placesPerBay: 1,
  bayWidth: 1,
  depth: 1,
  levels: [{ supportZ: 0.1, clearHeight: 1, maxLoadKg: 10 }],
};
const cargo = { id: "b", label: "Box", width: 0.4, depth: 0.4, height: 0.4, massKg: 2 };
const fixture = async (run, { failSave = false } = {}) => {
  const service = warehouseModule.createWarehouseService({
    repository: {
      load: async () => null,
      save: async () => {
        if (failSave) throw new Error("disk full");
      },
    },
  });
  const server = routeModule.createRouteServer({
    artifactStore: {},
    warehouseService: service,
    ready: async () => {
      throw new Error("gateway unavailable");
    },
    host: "127.0.0.1",
    port: 0,
  });
  await new Promise((resolve) => server.server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.server.address().port}`;
  const request = async (endpoint = "", body, options = {}) => {
    const response = await fetch(`${base}/api/warehouse${endpoint}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...options,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  try {
    await run({ request, base, service });
  } finally {
    await server.close();
  }
};

describe("warehouse HTTP on existing route server", () => {
  it("works independently of gateway readiness and preserves mission health routes", async () =>
    fixture(async ({ request, base }) => {
      expect((await request()).body.warehouse.revision).toBe(0);
      expect((await fetch(`${base}/health`)).status).toBe(200);
      expect((await fetch(`${base}/ready`)).status).toBe(503);
    }));
  it("serves the complete nested mutation contract, suggestions and cancellation", async () =>
    fixture(async ({ request }) => {
      const created = await request("/racks", { rack, expectedRevision: 0 });
      expect(created).toMatchObject({
        status: 200,
        body: { ok: true, warehouse: { revision: 1 } },
      });
      expect(
        (await request("/racks/r", { rack: { ...rack, name: "Edited" }, expectedRevision: 1 })).body
          .warehouse.racks[0].name,
      ).toBe("Edited");
      let current = (await request()).body;
      current = (
        await request("/stations", {
          stations: current.warehouse.stations.map((station) => ({ ...station, x: 1 })),
          expectedRevision: 2,
        })
      ).body;
      expect(current.warehouse.revision).toBe(3);
      expect(
        (await request("/cargo", { cargo, expectedRevision: 3 })).body.warehouse.cargo[0]
          .locationId,
      ).toBe("receiving");
      expect((await request("/suggestions?cargoId=b")).body.suggestions[0]).toMatchObject({
        slotId: "r:1:1:1",
        eligible: true,
        robotAccess: "unverified",
      });
      const command = { id: "t", cargoId: "b", destinationId: "r:1:1:1", expectedRevision: 4 };
      expect((await request("/tasks", command)).body.slots[0].reservedBy).toBe("t");
      expect((await request("/tasks", command)).body.warehouse.revision).toBe(5);
      expect(
        (await request("/tasks/t/cancel", { expectedRevision: 5 })).body.slots[0].reservedBy,
      ).toBe(null);
      expect(
        (await request("/tasks/t/cancel", { expectedRevision: 0 })).body.warehouse.revision,
      ).toBe(6);
      expect(
        (await request("/racks/r/delete", { expectedRevision: 6 })).body.warehouse.racks,
      ).toEqual([]);
      const imported = await request("/layout", {
        layout: { schemaVersion: 1, racks: [rack], stations: current.warehouse.stations },
        expectedRevision: 7,
      });
      expect(imported.body.warehouse).toMatchObject({
        revision: 8,
        cargo: [{ id: "b" }],
        racks: [{ id: "r" }],
      });
    }));
  it("rejects foreign origins and allows local preflight", async () =>
    fixture(async ({ request }) => {
      expect(
        (await request("", undefined, { headers: { Origin: "https://evil.example" } })).status,
      ).toBe(403);
      const allowed = await request("", undefined, {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    }));
  it("returns structured stale, malformed, missing and bounded-body errors", async () =>
    fixture(async ({ request }) => {
      expect((await request("/racks", { rack, expectedRevision: 0 })).status).toBe(200);
      expect(await request("/cargo", { cargo, expectedRevision: 0 })).toMatchObject({
        status: 409,
        body: { ok: false, code: "revision_conflict" },
      });
      expect((await request("/cargo", null)).status).toBe(400);
      expect((await request("/cargo", {}, { method: "POST", body: "{bad" })).status).toBe(400);
      expect(
        (await request("/cargo", {}, { method: "POST", body: "x".repeat(1024 * 1024 + 1) })).status,
      ).toBe(413);
      expect((await request("/unknown")).status).toBe(404);
      expect((await request("/suggestions?cargoId=unknown")).status).toBe(404);
      expect((await request("/racks/%ZZ/delete", { expectedRevision: 1 })).status).toBe(400);
    }));
  it("never reports a false success on storage failure", async () =>
    fixture(
      async ({ request }) => {
        expect(await request("/racks", { rack, expectedRevision: 0 })).toMatchObject({
          status: 503,
          body: { ok: false, error: "disk full" },
        });
        expect((await request()).body.warehouse.revision).toBe(0);
      },
      { failSave: true },
    ));
});
