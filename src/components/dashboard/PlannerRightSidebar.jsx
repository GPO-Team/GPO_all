import { useState } from "react";
import PlannerTelemetrySection from "./sections/PlannerTelemetrySection";
import PlannerSimulationSection from "./sections/PlannerSimulationSection";
import PlannerMapSection from "./sections/PlannerMapSection";
import PlannerTaskAlgorithmSection from "./sections/PlannerTaskAlgorithmSection";
import PlannerRouteControlsSection from "./sections/PlannerRouteControlsSection";

export default function PlannerRightSidebar({
  onCollapse, telemetry, telemetryWsUp, routeWsUp, solverApiUp,
  mappingSurveyMode, mappingSurveyModes, onMappingSurveyModeChange,
  mapExportPromptOpen, onStartMappingSurvey, onRequestMapExport,
  onExportMapVariant, onCancelMapExport, mapLayers, onMapLayerChange,
  routeTaskKey, onRouteTaskChange, algorithmKey, onAlgorithmChange,
  algorithmFields, selectedAlgorithmParams, onAlgorithmParamChange, status,
}) {
  const [tab, setTab] = useState("telemetry");
  return <aside className="planner-sidebar planner-sidebar-right flex h-full min-h-0 w-[360px] min-w-[360px] max-w-[360px] flex-none flex-col overflow-hidden border-l border-sky-100 bg-gradient-to-b from-sky-50 via-white to-cyan-50">
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-sky-200 bg-white px-3 py-2">
      <div className="min-w-0 pt-0.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-800">Робот и карта</div>
        <div className="truncate text-base font-bold text-slate-900">Наблюдение и настройки</div>
      </div>
      {onCollapse && <button type="button" title="Свернуть правую панель" aria-label="Свернуть правую панель"
        onClick={onCollapse} className="shrink-0 rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sky-700 shadow-sm hover:bg-sky-50">
        <span className="text-lg leading-none" aria-hidden>{">"}</span>
      </button>}
    </div>
    <nav className="panel-tabs" aria-label="Разделы правой панели">
      {[["telemetry", "Телеметрия"], ["map", "Карта"]].map(([key, label]) =>
        <button type="button" key={key} aria-pressed={tab === key}
          aria-controls={`planner-right-${key}`} onClick={() => setTab(key)}>{label}</button>
      )}
    </nav>
    <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
      <div id="planner-right-telemetry" hidden={tab !== "telemetry"} className="space-y-3">
        <PlannerTelemetrySection telemetry={telemetry} telemetryWsUp={telemetryWsUp} routeWsUp={routeWsUp} solverApiUp={solverApiUp} />
        <PlannerSimulationSection />
      </div>
      <div id="planner-right-map" hidden={tab !== "map"} className="space-y-3">
        <PlannerMapSection telemetry={telemetry} mapLayers={mapLayers} onMapLayerChange={onMapLayerChange}
          mappingSurveyMode={mappingSurveyMode} mappingSurveyModes={mappingSurveyModes}
          onMappingSurveyModeChange={onMappingSurveyModeChange} onStartMappingSurvey={onStartMappingSurvey}
          onRequestMapExport={onRequestMapExport} mapExportPromptOpen={mapExportPromptOpen}
          onExportMapVariant={onExportMapVariant} onCancelMapExport={onCancelMapExport} />
        <PlannerTaskAlgorithmSection routeTaskKey={routeTaskKey} onRouteTaskChange={onRouteTaskChange}
          algorithmKey={algorithmKey} onAlgorithmChange={onAlgorithmChange} />
        <PlannerRouteControlsSection showActions={false} algorithmFields={algorithmFields || []}
          selectedAlgorithmParams={selectedAlgorithmParams || {}} onAlgorithmParamChange={onAlgorithmParamChange} />
      </div>
    </div>
    {status && <p role="status" className="shrink-0 border-t border-sky-100 bg-white px-3 py-2 text-xs text-slate-700">{status}</p>}
  </aside>;
}
