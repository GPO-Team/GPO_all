import HelpHint from "../HelpHint";
import { MAP_LAYER_OPTIONS } from "../../../features/planner/model/mapLayers";

const selectCls = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

const layerGroups = [
  { label: "Объекты и маршрут", keys: ["visits", "charges", "zones", "surfaces", "route", "robot"] },
  { label: "Датчики", keys: ["lidar", "camera"] },
  { label: "Ориентиры", keys: ["grid", "axes"] },
];
const layerStyles = {
  visits: { color: "#e11d48", path: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" },
  charges: { color: "#b45309", path: "m13 2-8 12h6l-1 8 9-13h-6l1-7Z" },
  zones: { color: "#2563eb", path: "m4 7 8-4 8 4-2 12H6L4 7Z" },
  surfaces: { color: "#0d9488", path: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" },
  route: { color: "#0f766e", path: "M5 5h10a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h10M3 3h4v4H3zM17 17h4v4h-4z" },
  robot: { color: "#16a34a", path: "M5 7h14v12H5zM12 3v4M8 11h.01M16 11h.01M9 15h6M2 10v6m20-6v6" },
  lidar: { color: "#0891b2", path: "M12 12h.01M9 8a5 5 0 0 1 6 0M6 5a9 9 0 0 1 12 0M9 16a5 5 0 0 0 6 0M6 19a9 9 0 0 0 12 0M12 12l7-7" },
  camera: { color: "#7c3aed", path: "M3 7h4l2-3h6l2 3h4v13H3V7Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  grid: { color: "#64748b", path: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" },
  axes: { color: "#475569", path: "M5 3v16h16M2 6l3-3 3 3M18 16l3 3-3 3" },
};

export default function PlannerMapSection({
  telemetry, mapLayers, onMapLayerChange, mappingSurveyMode, mappingSurveyModes,
  onMappingSurveyModeChange, onStartMappingSurvey, onRequestMapExport,
  mapExportPromptOpen, onExportMapVariant, onCancelMapExport,
}) {
  const lidarCellCount = telemetry.obstacleMap?.cells?.length || 0;
  const cameraCellCount = (telemetry.cameraMap?.cells?.length || 0) + (telemetry.cameraMap?.freeCells?.length || 0);
  return <>
    <section className="map-settings">
      <h3 className="map-settings-title">Настройки карты</h3>
      {layerGroups.map((group) => <div className="map-layer-group" key={group.label}>
        <div className="map-layer-group-title">{group.label}</div>
        <div className="map-layer-list">
          {MAP_LAYER_OPTIONS.filter(({ key }) => group.keys.includes(key)).map(({ key, label }) => (
            <label key={key} className="map-layer-row" data-enabled={mapLayers?.[key] !== false} style={{ "--layer-color": layerStyles[key].color }}>
              <span className="map-layer-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={layerStyles[key].path} /></svg></span>
              <span className="map-layer-label">{label}</span>
              <input type="checkbox" role="switch" checked={mapLayers?.[key] !== false}
                onChange={(event) => onMapLayerChange?.(key, event.target.checked)}
                className="map-layer-switch" />
            </label>
          ))}
        </div>
      </div>)}
      <p className="mt-3 text-xs text-slate-500">Скрытые зоны и покрытия продолжают учитываться при расчёте маршрута.</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-teal-600" />След лидара</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-violet-500" />Карта камеры</span>
      </div>
    </section>
      <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">
          Карта препятствий <HelpHint label="Карта препятствий">
          Постоянная карта строится из лидарных попаданий и рисуется поверх рабочей сетки.
          Камерная карта добавляется отдельным фиолетовым слоем по визуальным попаданиям камеры.
        </HelpHint></div>
        <label className="mt-3 block">
          <div className="mb-1 text-xs font-medium text-cyan-900">Режим обследования</div>
          <select
            className={selectCls}
            data-testid="mapping-survey-mode"
            value={mappingSurveyMode}
            onChange={(event) => onMappingSurveyModeChange(event.target.value)}
          >
            {mappingSurveyModes.map((mode) => (
              <option key={mode.key} value={mode.key}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={onStartMappingSurvey}
          className="mt-3 w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          {mappingSurveyMode === "double" ? "Двойной объезд" : "Обследование карты"}
        </button>
        <button
          onClick={onRequestMapExport}
          disabled={!lidarCellCount && !cameraCellCount}
          className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
            lidarCellCount || cameraCellCount
              ? "bg-cyan-700 text-white hover:bg-cyan-800"
              : "cursor-not-allowed bg-cyan-100 text-cyan-400"
          }`}
        >
          Сохранить карту в PNG
        </button>
        {mapExportPromptOpen && (
          <div className="mt-3 rounded-xl border border-cyan-300 bg-white p-3 text-xs text-slate-700 shadow-sm">
            <div className="font-semibold text-slate-900">Какую карту сохранить?</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => onExportMapVariant?.("lidar")}
                disabled={!lidarCellCount}
                className={`rounded-lg px-3 py-2 font-semibold ${
                  lidarCellCount
                    ? "border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                    : "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                }`}
              >
                Лидар
              </button>
              <button
                onClick={() => onExportMapVariant?.("camera")}
                disabled={!cameraCellCount}
                className={`rounded-lg px-3 py-2 font-semibold ${
                  cameraCellCount
                    ? "border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                    : "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                }`}
              >
                Камера
              </button>
            </div>
            <button
              onClick={onCancelMapExport}
              className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-600 hover:bg-stone-100"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
  </>;
}
