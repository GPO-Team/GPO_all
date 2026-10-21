import { expect, it } from "vitest";
import { buildGraphCsv } from "./graphExport.js";
import { parsePlannerTableRows } from "../../../../shared/planning/graphImport.js";
import { normalizeImportedGraph } from "./graphImport.js";

it("round-trips point types, creation order, zone identity and metadata", () => {
  const points = [
    { x: 1.123456789, y: 2, kind: "visit", task: "inspect" },
    { x: 4, y: 3, kind: "free_visit", task: "visit" },
    { x: 5, y: 6, kind: "limit", zoneId: "zone-2" },
    { x: 5, y: 7, kind: "limit", zoneId: "zone-2" },
    { x: 6, y: 7, kind: "limit", zoneId: "zone-2" },
    { x: 8, y: 9, kind: "charge" },
  ];
  const zones = [{ id: "zone-2", name: "Склад", closed: true }];
  const csv = buildGraphCsv({ points, limitZones: zones });
  const rows = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(","));
  const restored = normalizeImportedGraph(parsePlannerTableRows(rows));
  expect(restored.points.map((p) => p.kind)).toEqual(points.map((p) => p.kind));
  expect(restored.points[0].x).toBe(points[0].x);
  expect(restored.points[2].zoneId).toBe("zone-2");
  expect(restored.limitZones[0]).toMatchObject(zones[0]);
});
it("quotes commas, quotes and newlines in metadata", () => {
  const csv = buildGraphCsv({
    points: [{ x: 1, y: 2, kind: "limit", zoneId: "z" }],
    limitZones: [{ id: "z", name: 'Зона, "А"\nБ', closed: false }],
  });
  expect(csv).toContain('"Зона, ""А""\nБ"');
});
it("preserves surface polygons separately from route visits", () => {
  const surfaceZones = [
    {
      id: "s",
      name: "Песок",
      closed: true,
      surfaceKey: "rough",
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
    },
  ];
  const csv = buildGraphCsv({
    points: [{ x: 0, y: 0, kind: "free_visit" }],
    surfaceZones,
  });
  const rows = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(","));
  const graph = normalizeImportedGraph(parsePlannerTableRows(rows));
  expect(graph.points).toHaveLength(1);
  expect(graph.surfaceZones).toEqual(surfaceZones);
});
