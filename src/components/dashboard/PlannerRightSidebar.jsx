import { useState } from "react";
import PlannerManipulatorSection from "./sections/PlannerManipulatorSection";
import PlannerTelemetrySection from "./sections/PlannerTelemetrySection";
import PlannerMapSection from "./sections/PlannerMapSection";

export default function PlannerRightSidebar({
  onStartPickPlace, onStartObjectTransfer, mission, onCancelMission, onResumeMission,
  editingLocked=false,
  onCollapse, telemetry, telemetryWsUp, routeWsUp, solverApiUp,
  mapLayers, onMapLayerChange,
}) {
  const [tab, setTab] = useState("telemetry");
  return <aside className="planner-sidebar planner-sidebar-right flex h-full min-h-0 flex-none flex-col overflow-hidden">
    <div className="sidebar-heading">
      <div className="min-w-0 pt-0.5">
        <div className="sidebar-eyebrow">СОСТОЯНИЕ РОБОТА</div>
        <div className="sidebar-title">Наблюдение</div>
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
        <PlannerManipulatorSection
          telemetry={telemetry}
          connected={telemetryWsUp}
          mission={mission}
          onStart={onStartPickPlace}
          onStartTransfer={onStartObjectTransfer}
          onCancel={onCancelMission}
          onResume={onResumeMission}
          editingLocked={editingLocked}
        />
      </div>
      <div id="planner-right-map" hidden={tab !== "map"} className="space-y-3">
        <PlannerMapSection mapLayers={mapLayers} onMapLayerChange={onMapLayerChange} />
      </div>
    </div>
  </aside>;
}
