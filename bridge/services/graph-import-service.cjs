const path = require("path");

const TABLE_EXTENSIONS = ["xlsx", "xls", "csv"];

// CSV has no encoding marker: accept UTF-8 (with or without BOM), otherwise
// assume Windows-1251, which Excel uses for CSV on Russian Windows.
const decodeCsvText = (bytes) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
};

const importError = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });

// Parses an uploaded graph file (JSON, Excel, CSV) and validates it with the
// shared editor rules, so the browser no longer needs a spreadsheet parser.
const createGraphImportService = ({ loadXlsx = () => require("xlsx") } = {}) => {
  const readRawGraph = (extension, bytes) => {
    if (extension === "json") {
      try {
        return JSON.parse(bytes.toString("utf8"));
      } catch {
        throw importError("Файл JSON повреждён.");
      }
    }
    const XLSX = loadXlsx();
    const workbook = extension === "csv"
      ? XLSX.read(decodeCsvText(bytes), { type: "string", raw: false })
      : XLSX.read(bytes, { type: "buffer", raw: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    if (!sheet) throw importError("В файле не найден лист с точками.");
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  };

  const importGraph = async ({ fileName, bytes }) => {
    const sourceName = path.basename(String(fileName || "graph.json"));
    const extension = sourceName.split(".").pop()?.toLowerCase() || "";
    if (extension !== "json" && !TABLE_EXTENSIONS.includes(extension))
      throw importError("Поддерживаются JSON, Excel и CSV.", 400);
    if (!bytes?.length) throw importError("Файл пуст.");
    const { normalizeImportedGraph, parsePlannerTableRows, validateImportedGraph } =
      await import("../../shared/planning/graphImport.js");
    const raw = readRawGraph(extension, bytes);
    try {
      const table = extension === "json" ? raw : parsePlannerTableRows(raw);
      return { ok: true, sourceName, ...validateImportedGraph(normalizeImportedGraph(table)) };
    } catch (error) {
      throw importError(error instanceof Error ? error.message : "Не удалось разобрать граф.");
    }
  };

  return { importGraph };
};

module.exports = { createGraphImportService };
