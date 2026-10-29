import { afterEach, describe, expect, it, vi } from "vitest";
import { warehouseApi, validateLayout } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("warehouse API client", () => {
  it("preserves the server conflict code for refreshing stale data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ ok: false, code: "revision_conflict", error: "Склад изменился" }),
      })),
    );
    await expect(
      warehouseApi("/tasks", { body: { id: "task", expectedRevision: 4 } }),
    ).rejects.toMatchObject({
      status: 409,
      code: "revision_conflict",
      message: "Склад изменился",
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      id: "task",
      expectedRevision: 4,
    });
  });

  it("reports a bounded timeout instead of leaving the workspace locked", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const result = warehouseApi("");
    const checked = expect(result).rejects.toThrow(/не ответил|время ожидания/);
    await vi.advanceTimersByTimeAsync(15000);
    await checked;
  });

  it("does not accept a non-JSON or malformed success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("HTML");
        },
      })),
    );
    await expect(warehouseApi("")).rejects.toThrow(/некорректный ответ/);
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: "yes" }) });
    await expect(warehouseApi("")).rejects.toThrow();
  });
});

describe("layout file boundary", () => {
  it("imports layout only and leaves inventory and task history out of the payload", () => {
    const layout = validateLayout(
      JSON.stringify({
        schemaVersion: 1,
        racks: [],
        stations: [],
        cargo: [{ id: "other" }],
        tasks: [],
      }),
    );
    expect(Object.keys(layout).sort()).toEqual(["racks", "schemaVersion", "stations"]);
  });

  it.each([
    "null",
    "[]",
    "{}",
    '{"schemaVersion":2,"racks":[],"stations":[]}',
    '{"schemaVersion":1,"racks":[null],"stations":[]}',
  ])("rejects unsupported layout JSON %s", (text) => {
    expect(() => validateLayout(text)).toThrow();
  });
});
