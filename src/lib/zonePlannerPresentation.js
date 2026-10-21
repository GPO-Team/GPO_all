import { SURFACE_ZONE_PRESETS } from "./energyModel";

export const POINT_KIND_META = {
  visit: { key: "visit", label: "Точки посещения", shortLabel: "V", color: "#dc2626", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  free_visit: { key: "free_visit", label: "Точки без номера", shortLabel: "", color: "#dc2626", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  charge: { key: "charge", label: "Станция зарядки", shortLabel: "C", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  limit: { key: "limit", label: "Ограничивающий контур", shortLabel: "Z", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  surface: { key: "surface", label: "Зона покрытия", shortLabel: "S", color: "#0f766e", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
};

export const POINT_KIND_OPTIONS = Object.values(POINT_KIND_META);
export const DEFAULT_SURFACE_ZONES = SURFACE_ZONE_PRESETS;
export { DEFAULT_POINT_TASK, POINT_TASKS } from "../../shared/planning/graphImport.js";

const ZONE_COLORS = [
  { stroke: "#2563eb", fill: "rgba(37, 99, 235, 0.12)", badge: "bg-blue-500" },
  { stroke: "#7c3aed", fill: "rgba(124, 58, 237, 0.12)", badge: "bg-violet-500" },
  { stroke: "#0891b2", fill: "rgba(8, 145, 178, 0.12)", badge: "bg-cyan-500" },
  { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.12)", badge: "bg-orange-500" },
  { stroke: "#16a34a", fill: "rgba(22, 163, 74, 0.12)", badge: "bg-emerald-500" },
  { stroke: "#db2777", fill: "rgba(219, 39, 119, 0.12)", badge: "bg-pink-500" },
];

export const getZoneColor = (index) => ZONE_COLORS[index % ZONE_COLORS.length];
