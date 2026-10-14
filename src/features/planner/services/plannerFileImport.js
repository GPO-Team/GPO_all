import { INITIAL_ZONE } from "../../../lib/plannerModel";
import { DEFAULT_POINT_TASK } from "../../../lib/zonePlanner";

const parseNumber = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase();

export const parsePlannerTableRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("Файл пуст.");
  }

  const firstRow = rows[0] || [];
  const firstRowHasCoordinates =
    parseNumber(firstRow[0]) !== null && parseNumber(firstRow[1]) !== null;
  const headers = firstRowHasCoordinates ? [] : firstRow.map(normalizeHeader);
  const dataRows = firstRowHasCoordinates ? rows : rows.slice(1);
  const findColumn = (aliases, fallback) => {
    const index = headers.findIndex((header) => aliases.includes(header));
    return index >= 0 ? index : fallback;
  };

  const xCol = findColumn(["x", "х", "xcoord", "x coordinate", "координата x"], 0);
  const yCol = findColumn(["y", "у", "ycoord", "y coordinate", "координата y"], 1);
  const kindCol = findColumn(["kind", "type", "тип", "роль"], -1);
  const taskCol = findColumn(["task", "operation", "операция", "задача"], -1);
  const zoneIdCol=findColumn(["zone_id","zoneid"],-1);
  const zoneNameCol=findColumn(["zone_name","zonename"],-1);
  const zoneClosedCol=findColumn(["zone_closed","closed"],-1);
  const zones=new Map();
  const surfaces=new Map();
  const surfaceKeyCol=findColumn(["surface_key","surfacekey"],-1);

  const points = dataRows
    .map((row) => {
      const x = parseNumber(row?.[xCol]);
      const y = parseNumber(row?.[yCol]);
      if (x === null || y === null) return null;

      const kindText = kindCol >= 0 ? normalizeHeader(row?.[kindCol]) : "";
      const kind =
        kindText === "surface" || kindText.includes("покрыт") ? "surface" : kindText === "free_visit" || kindText.includes("свобод") ? "free_visit" : kindText.includes("charge") || kindText.includes("зар")
          ? "charge"
          : kindText.includes("limit") ||
              kindText.includes("zone") ||
              kindText.includes("зон")
            ? "limit"
            : "visit";
      const zoneId=zoneIdCol>=0 && row[zoneIdCol] ? String(row[zoneIdCol]) : INITIAL_ZONE.id;
      if(kind==="surface"){
        if(!surfaces.has(zoneId))surfaces.set(zoneId,{id:zoneId,name:zoneNameCol>=0?String(row[zoneNameCol]):"Покрытие",closed:zoneClosedCol>=0?["true","1"].includes(normalizeHeader(row[zoneClosedCol])):false,surfaceKey:surfaceKeyCol>=0?String(row[surfaceKeyCol]):"neutral",points:[]});
        surfaces.get(zoneId).points.push({x,y});return null;
      }
      if(kind==="limit")zones.set(zoneId,{id:zoneId,name:zoneNameCol>=0 && row[zoneNameCol] ? String(row[zoneNameCol]) : INITIAL_ZONE.name,closed:zoneClosedCol>=0 ? ["true","1"].includes(normalizeHeader(row[zoneClosedCol])) : false});
      return {
        x,
        y,
        kind,
        zoneId: kind === "limit" ? zoneId : null,
        task:
          ["visit","free_visit"].includes(kind) && taskCol >= 0
            ? String(row?.[taskCol] || DEFAULT_POINT_TASK)
            : null,
      };
    })
    .filter(Boolean);

  if (!points.length && !surfaces.size) {
    throw new Error("В файле не найдено валидных координат.");
  }

  return {
    points,
    limitZones: [...zones.values()],
    ...(surfaces.size?{surfaceZones:[...surfaces.values()]}:{}),
  };
};

export const readPlannerImportFile = async (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "json") {
    return {
      graph: JSON.parse(await file.text()),
      sourceName: file.name,
    };
  }

  if (!["xlsx", "xls", "csv"].includes(extension)) {
    throw new Error("Поддерживаются JSON, Excel и CSV.");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) throw new Error("В файле не найден лист с точками.");

  return {
    graph: parsePlannerTableRows(
      XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
    ),
    sourceName: file.name,
  };
};
