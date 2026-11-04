import { describe, expect, it } from "vitest";
import { ALGORITHM_OPTIONS, getAlgorithmPrecision } from "../../../lib/routeAlgorithms";
import { createDashboardAlgorithmParams } from "./dashboardAlgorithmParams";

describe("dashboard algorithm parameters", () => {
  it("creates an independent default parameter object for every algorithm", () => {
    const params = createDashboardAlgorithmParams();
    expect(Object.keys(params)).toEqual(ALGORITHM_OPTIONS.map((option) => option.key));
    expect(params[ALGORITHM_OPTIONS[0].key]).not.toBe(params[ALGORITHM_OPTIONS[1].key]);
  });

  it.each(["low", "medium", "high"])("applies the %s precision preset to every algorithm", (precision) => {
    const params = createDashboardAlgorithmParams(precision);
    for (const { key } of ALGORITHM_OPTIONS) expect(getAlgorithmPrecision(key, params[key])).toBe(precision);
  });
});
