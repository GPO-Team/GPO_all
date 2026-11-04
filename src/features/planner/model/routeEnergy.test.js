import { describe, expect, it } from "vitest";
import {
  buildRouteEnergyStats,
  buildRouteWithEnergyStops,
  createEmptyRouteEnergyStats,
  getEnergyWarningText,
} from "./routeEnergy";

describe("route energy model", () => {
  it("provides stable empty statistics", () => {
    expect(createEmptyRouteEnergyStats()).toMatchObject({
      routeEnergy: 0,
      distanceMeters: 0,
      stationStopCount: 0,
    });
  });

  it("maps a successful planning result to UI statistics", () => {
    expect(
      buildRouteEnergyStats({
        routeEnergy: 12,
        routeDistance: 7,
        estimatedTimeSec: 30,
        limitingMaxSpeedMps: 0.2,
        averageSlipRisk: 0.1,
        stationStopCount: 1,
        influenceRows: [{ key: "distance" }],
      })
    ).toEqual({
      routeEnergy: 12,
      distanceMeters: 7,
      estimatedTimeSec: 30,
      limitingMaxSpeedMps: 0.2,
      averageSlipRisk: 0.1,
      stationStopCount: 1,
      influenceRows: [{ key: "distance" }],
    });
  });

  it("builds a direct route when its energy budget is sufficient", () => {
    const result = buildRouteWithEnergyStops({
      seedRoute: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      polygons: [],
      surfaceZones: [],
      chargingStations: [],
      batteryRangeMeters: 100,
      energyOptions: { speedMps: 0.22, payloadKg: 0 },
    });

    expect(result.ok).toBe(true);
    expect(result.route).toHaveLength(2);
  });

  it("only shows actionable battery warnings", () => {
    expect(getEnergyWarningText({ ok: false, reason: "insufficient_range" })).toContain(
      "Запаса хода"
    );
    expect(getEnergyWarningText({ ok: false, reason: "obstacle_routing_failed" })).toBe("");
  });
});
