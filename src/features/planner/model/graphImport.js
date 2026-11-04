export { normalizeImportedGraph } from "../../../../shared/planning/graphImport.js";

export const deriveNextZoneNumber = (zones) => {
  const maxNumber = zones.reduce((best, zone) => {
    const idMatch = String(zone?.id ?? "").match(/zone-(\d+)/i);
    const nameMatch = String(zone?.name ?? "").match(/(\d+)/);
    const candidates = [idMatch?.[1], nameMatch?.[1]]
      .map((value) => Number(value))
      .filter(Number.isFinite);
    return candidates.length ? Math.max(best, ...candidates) : best;
  }, 1);
  return Math.max(2, maxNumber + 1);
};

export const buildImportedGraphStatus = (points, sourceName) => {
  const count = (kind) => points.filter((point) => point.kind === kind).length;
  return `Граф импортирован из ${sourceName}: точек посещения ${count("visit") + count("free_visit")}, зарядок ${count("charge")}, точек зон ${count("limit")}.`;
};
