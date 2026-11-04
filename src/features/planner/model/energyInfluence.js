import { formatSigned } from "../../../../shared/planning/routeInfluence.js";

// Route rows come from the planning service; only live mission measurements are added here.
export const buildRouteInfluenceRows = (serverRows, {
  plannedTimeSec = 0,
  actualTimeSec = null,
  avoidanceTimeSec = 0,
} = {}) => {
  if (!Array.isArray(serverRows) || !serverRows.length) return [];
  const rows = [
    ...serverRows,
    { key: "avoidance-time", label: "Объезд вне маршрута", value: `${Math.round(Math.max(0, Number(avoidanceTimeSec) || 0))} сек`, impact: Number(avoidanceTimeSec) > 0 ? `+${Math.round(Number(avoidanceTimeSec))} сек к факту` : "без внепланового объезда" },
  ];
  if (Number.isFinite(actualTimeSec) && actualTimeSec > 0 && Number.isFinite(plannedTimeSec)) {
    rows.push({ key: "actual-time", label: "Факт против плана", value: `${Math.round(actualTimeSec)} сек`, impact: `${formatSigned(actualTimeSec - plannedTimeSec, 0)} сек` });
  }
  return rows;
};
