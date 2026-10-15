import { describe, expect, it } from "vitest";
import {
  buildImportedGraphStatus,
  deriveNextZoneNumber,
  normalizeImportedGraph,
} from "./graphImport";

describe("graph import model", () => {
  it("normalizes the current points format", () => {
    const graph = normalizeImportedGraph({
      limitZones: [{ id: "zone-3", name: "Зона 3", closed: true }],
      points: [
        { x: 1, y: 2, kind: "visit", task: "inspect" },
        { x: 2, y: 3, kind: "limit", zoneId: "missing" },
      ],
    });

    expect(graph.points[0]).toMatchObject({ kind: "visit", task: "inspect" });
    expect(graph.points[1]).toMatchObject({ kind: "limit", zoneId: "zone-3" });
  });

  it("normalizes the legacy entry format", () => {
    const graph = normalizeImportedGraph({
      visitEntries: [{ point: { x: 0, y: 0 }, task: "visit" }],
      chargeEntries: [{ point: { x: 1, y: 1 } }],
      zoneEntries: [],
    });

    expect(graph.points.map((point) => point.kind)).toEqual(["visit", "charge"]);
  });

  it("derives the next limit-zone number", () => {
    expect(deriveNextZoneNumber([{ id: "zone-8" }])).toBe(9);
  });

  it("summarizes imported point counts", () => {
    expect(
      buildImportedGraphStatus(
        [
          { kind: "visit" },
          { kind: "free_visit" },
          { kind: "charge" },
          { kind: "limit" },
          { kind: "limit" },
        ],
        "route.csv"
      )
    ).toBe(
      "Граф импортирован из route.csv: точек посещения 2, зарядок 1, точек зон 2."
    );
  });
});
