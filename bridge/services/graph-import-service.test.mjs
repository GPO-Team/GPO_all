import { describe, expect, it } from "vitest";
import packageLock from "../../package-lock.json" with { type: "json" };
import * as XLSX from "xlsx";
import { parsePlannerTableRows } from "../../shared/planning/graphImport.js";
import serviceModule from "./graph-import-service.cjs";

const { createGraphImportService } = serviceModule;
const service = createGraphImportService();
const importFile = (fileName, bytes) => service.importGraph({ fileName, bytes: Buffer.from(bytes) });

describe("planner file import service", () => {
  it("uses a SheetJS release with the known import vulnerabilities fixed", () => {
    const installedVersion = packageLock.packages["node_modules/xlsx"]?.version;
    expect(installedVersion).toBe("0.20.3");
  });

  it("converts localized table columns into planner points", () => {
    expect(
      parsePlannerTableRows([
        ["Координата X", "Координата Y", "Тип", "Операция"],
        ["1,5", "-2.25", "зарядка", ""],
        [3, 4, "зона", ""],
        [5, 6, "visit", "inspect"],
      ])
    ).toEqual({
      points: [
        { x: 1.5, y: -2.25, kind: "charge", zoneId: null, task: null },
        { x: 3, y: 4, kind: "limit", zoneId: "zone-1", task: null },
        { x: 5, y: 6, kind: "visit", zoneId: null, task: "inspect" },
      ],
      limitZones: [{ id: "zone-1", name: "Зона 1", closed: false }],
    });
  });

  it("rejects a table without valid coordinates", () => {
    expect(() => parsePlannerTableRows([["x", "y"], ["bad", "data"]])).toThrow(
      "В файле не найдено валидных координат."
    );
  });

  it("normalizes an uploaded JSON graph", async () => {
    const graph = { points: [{ x: 1, y: 2, kind: "visit" }] };
    const result = await importFile("route.json", JSON.stringify(graph));
    expect(result).toMatchObject({ ok: true, sourceName: "route.json", visitPointMode: "visit", warnings: [] });
    expect(result.graph.points).toEqual([{ x: 1, y: 2, kind: "visit", zoneId: null, task: "Ожидание 2 сек" }]);
  });

  it("reads coordinates from an XLSX workbook on the server", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["x", "y", "type"],
      [1.5, 2.5, "visit"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Route");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const result = await importFile("route.xlsx", bytes);

    expect(result.graph.points).toEqual([
      { x: 1.5, y: 2.5, kind: "visit", zoneId: null, task: "Ожидание 2 сек" },
    ]);
  });

  it("opens closed zones without a contour and unifies mixed visit kinds", async () => {
    const result = await importFile("graph.json", JSON.stringify({
      limitZones: [{ id: "zone-1", name: "Зона 1", closed: true }],
      points: [
        { x: 0, y: 0, kind: "limit", zoneId: "zone-1" },
        { x: 1, y: 1, kind: "visit" },
        { x: 2, y: 2, kind: "free_visit" },
      ],
    }));
    expect(result.graph.limitZones[0].closed).toBe(false);
    expect(result.graph.points.filter((point) => point.kind === "visit")).toHaveLength(2);
    expect(result.warnings).toHaveLength(2);
  });

  it("keeps the no-number mode when every visit point is free", async () => {
    const result = await importFile("graph.json", JSON.stringify({ points: [{ x: 1, y: 1, kind: "free_visit" }] }));
    expect(result.visitPointMode).toBe("free_visit");
  });

  it("reads Russian CSV in UTF-8 and Windows-1251", async () => {
    const csv = "x,y,тип\n1,2,зарядка\n3,4,свободная\n";
    const utf8 = await importFile("graph.csv", "﻿" + csv);
    expect(utf8.graph.points.map((point) => point.kind)).toEqual(["charge", "free_visit"]);
    const cp1251 = Buffer.from([...csv].map((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x410 && code <= 0x44f ? code - 0x350 : code;
    }));
    const legacy = await importFile("graph.csv", cp1251);
    expect(legacy.graph.points.map((point) => point.kind)).toEqual(["charge", "free_visit"]);
  });

  it("rejects unsupported files and broken JSON", async () => {
    await expect(importFile("route.txt", "x")).rejects.toMatchObject({ statusCode: 400, message: "Поддерживаются JSON, Excel и CSV." });
    await expect(importFile("route.json", "{")).rejects.toMatchObject({ statusCode: 422, message: "Файл JSON повреждён." });
  });
});
