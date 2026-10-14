import { describe, expect, it } from "vitest";
import validation from "./validation.cjs";

const {
  resolveAlgorithmKey,
  resolveTaskKey,
  sanitizeNativeParams,
  validatePoints,
  validatePolygons,
  validateSurfaceZones,
  validateTransferCommand,
} = validation;

describe("bridge protocol validation", () => {
  it("exports object transfer validation", () => {
    expect(typeof validateTransferCommand).toBe("function");
  });
  it("keeps legacy algorithm aliases compatible", () => {
    expect(resolveAlgorithmKey("genetik")).toBe("ga_tabu");
    expect(resolveAlgorithmKey("annealing")).toBe("otshig");
    expect(resolveAlgorithmKey("scatter")).toBe("rasseivanie");
  });

  it("falls back to a supported task", () => {
    expect(resolveTaskKey("hamiltonian_chain")).toBe("hamiltonian_chain");
    expect(resolveTaskKey("unknown")).toBe("tsp");
  });

  it("normalizes and validates route points", () => {
    expect(validatePoints([{ x: "1.5", y: 2 }])).toEqual([{ x: 1.5, y: 2 }]);
    expect(() => validatePoints([{ x: "bad", y: 2 }])).toThrow(/finite x and y/);
  });

  it("rejects routes larger than the solver limit", () => {
    const points = Array.from({ length: 769 }, (_, index) => ({ x: index, y: 0 }));
    expect(() => validatePoints(points)).toThrow(/at most 768 points/);
  });

  it("requires at least three polygon points", () => {
    expect(() => validatePolygons([{ points: [{ x: 0, y: 0 }] }])).toThrow(
      /at least three points/
    );
  });

  it("normalizes surface metadata", () => {
    const [zone] = validateSurfaceZones([
      {
        surfaceKey: "invalid",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
      },
    ]);

    expect(zone.id).toBe("surface-zone-1");
    expect(zone.surfaceKey).toBe("neutral");
  });

  it("clamps native solver parameters", () => {
    const params = sanitizeNativeParams("ga_tabu", {
      population_size: 99999,
      mutation_rate: -10,
      generations: 0,
    });

    expect(params.nests).toBe(1200);
    expect(params.pa).toBe(0);
    expect(params.max_iter).toBe(1);
  });
});
