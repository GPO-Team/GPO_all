import { afterEach, describe, expect, it, vi } from "vitest";
import { readPlannerImportFile } from "./plannerFileImport";

afterEach(() => vi.unstubAllGlobals());

describe("planner file import client", () => {
  it("uploads the file to the planning service and returns its validated graph", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, graph: { points: [] }, warnings: ["w"], visitPointMode: "free_visit", sourceName: "граф.xlsx" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    const result = await readPlannerImportFile({ name: "граф.xlsx", arrayBuffer: async () => bytes });

    expect(result).toEqual({ graph: { points: [] }, warnings: ["w"], visitPointMode: "free_visit", sourceName: "граф.xlsx" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/import-graph$/);
    expect(init.headers["X-File-Name"]).toBe(encodeURIComponent("граф.xlsx"));
    expect(init.body).toBe(bytes);
  });

  it("shows the server error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, error: "Поддерживаются JSON, Excel и CSV." }) })));
    await expect(readPlannerImportFile({ name: "a.txt", arrayBuffer: async () => new ArrayBuffer(0) }))
      .rejects.toThrow("Поддерживаются JSON, Excel и CSV.");
  });
});
