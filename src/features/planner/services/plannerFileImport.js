import { IMPORT_GRAPH_URL } from "../../../lib/runtimeConfig";

// The planning service parses JSON, Excel and CSV graphs and validates them.
export const readPlannerImportFile = async (file, { signal } = {}) => {
  const response = await fetch(IMPORT_GRAPH_URL, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
    body: await file.arrayBuffer(),
  }).catch(() => {
    throw new Error("Planning service недоступен: импорт графа выполняется на сервере.");
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Не удалось импортировать граф.");
  return {
    graph: payload.graph,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    visitPointMode: payload.visitPointMode === "free_visit" ? "free_visit" : "visit",
    sourceName: payload.sourceName || file.name,
  };
};
