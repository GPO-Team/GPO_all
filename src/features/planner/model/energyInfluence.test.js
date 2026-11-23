import { describe, expect, it } from "vitest";
import { analyzeRouteInfluence } from "../../../../shared/planning/routeInfluence.js";
import { buildRouteInfluenceRows } from "./energyInfluence";

describe("energy influence", () => {
  it("adds runtime rows to the server rows and reports actual time only when measured", () => {
    const serverRows = analyzeRouteInfluence([{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    expect(serverRows.map((row) => row.key)).toEqual(["distance", "payload", "speed", "turns", "slip", "charging"]);
    const withoutActual = buildRouteInfluenceRows(serverRows);
    const withActual = buildRouteInfluenceRows(serverRows, { plannedTimeSec: 8, actualTimeSec: 10 });

    expect(withoutActual.some((row) => row.key === "actual-time")).toBe(false);
    expect(withoutActual.some((row) => row.key === "avoidance-time")).toBe(true);
    expect(withActual.find((row) => row.key === "actual-time")).toMatchObject({ value: "10 сек", impact: "+2 сек" });
    expect(buildRouteInfluenceRows([])).toEqual([]);
  });
});
