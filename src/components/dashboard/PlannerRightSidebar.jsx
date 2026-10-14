import PlannerConstraintsSection from "./sections/PlannerConstraintsSection";
import PlannerLimitZonesSection from "./sections/PlannerLimitZonesSection";
import PlannerRoutePointsSection from "./sections/PlannerRoutePointsSection";
import PlannerTelemetrySection from "./sections/PlannerTelemetrySection";
import PlannerSimulationSection from "./sections/PlannerSimulationSection";
import PlannerManipulatorSection from "./sections/PlannerManipulatorSection";

export default function PlannerRightSidebar({
  onCollapse,
  activeZone,
  activeZoneName,
  activeLimitZoneId,
  zoneEntries,
  visitEntries,
  chargeEntries,
  plannedVisitEntries,
  expandedPoint,
  hoveredPointIndex,
  visitsInsideLimitCount,
  polygonCount,
  adjustedVisitCount,
  routeBlocked,
  telemetry,
  telemetryWsUp,
  routeWsUp,
  solverApiUp,
  mappingSurveyMode,
  mappingSurveyModes,
  onMappingSurveyModeChange,
  mapExportPromptOpen,
  onStartMappingSurvey,
  onStartPickPlace,
  mission,
  onCancelMission,
  onRequestMapExport,
  onExportMapVariant,
  onCancelMapExport,
  onCreateZone,
  onSelectZone,
  onToggleZoneClosed,
  onClearZone,
  onRemoveZone,
  onToggleExpandedPoint,
  onHoverPoint,
  onDeletePoint,
  onUpdatePointTask,
}) {
  return (
    <aside className="flex h-full min-h-0 w-[330px] min-w-[330px] max-w-[330px] flex-none flex-col overflow-hidden border-l border-sky-100 bg-gradient-to-b from-sky-50 via-white to-cyan-50 xl:w-[350px] xl:min-w-[350px] xl:max-w-[350px]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-sky-200 bg-white px-3 py-2">
        <div className="min-w-0 pt-0.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-800">
            Объекты карты
          </div>
          <div className="truncate text-base font-bold text-slate-900">Зоны и точки</div>
        </div>
        {onCollapse ? (
          <button
            type="button"
            title="Свернуть правую панель"
            aria-label="Свернуть правую панель"
            onClick={onCollapse}
            className="shrink-0 rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
          >
            <span className="text-lg leading-none" aria-hidden>
              {">"}
            </span>
          </button>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 space-y-4 [scrollbar-gutter:stable]">
      <PlannerLimitZonesSection
        activeLimitZoneId={activeLimitZoneId}
        activeZone={activeZone}
        activeZoneName={activeZoneName}
        onClearZone={onClearZone}
        onCreateZone={onCreateZone}
        onRemoveZone={onRemoveZone}
        onSelectZone={onSelectZone}
        onToggleZoneClosed={onToggleZoneClosed}
        zoneEntries={zoneEntries}
      />
      <PlannerRoutePointsSection
        chargeEntries={chargeEntries}
        expandedPoint={expandedPoint}
        hoveredPointIndex={hoveredPointIndex}
        onDeletePoint={onDeletePoint}
        onHoverPoint={onHoverPoint}
        onToggleExpandedPoint={onToggleExpandedPoint}
        onUpdatePointTask={onUpdatePointTask}
        plannedVisitEntries={plannedVisitEntries}
        visitEntries={visitEntries}
      />

      <PlannerConstraintsSection
        adjustedVisitCount={adjustedVisitCount}
        polygonCount={polygonCount}
        routeBlocked={routeBlocked}
        visitsInsideLimitCount={visitsInsideLimitCount}
      />

      <PlannerSimulationSection />
      <PlannerManipulatorSection
        telemetry={telemetry}
        connected={telemetryWsUp && routeWsUp}
        mission={mission}
        onStart={onStartPickPlace}
        onCancel={onCancelMission}
      />
      <PlannerTelemetrySection
        mapExportPromptOpen={mapExportPromptOpen}
        mappingSurveyMode={mappingSurveyMode}
        mappingSurveyModes={mappingSurveyModes}
        onCancelMapExport={onCancelMapExport}
        onExportMapVariant={onExportMapVariant}
        onMappingSurveyModeChange={onMappingSurveyModeChange}
        onRequestMapExport={onRequestMapExport}
        onStartMappingSurvey={onStartMappingSurvey}
        routeWsUp={routeWsUp}
        solverApiUp={solverApiUp}
        telemetry={telemetry}
        telemetryWsUp={telemetryWsUp}
      />
      </div>
    </aside>
  );
}
