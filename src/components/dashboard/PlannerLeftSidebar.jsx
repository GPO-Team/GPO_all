import PlannerMissionStatus from "./sections/PlannerMissionStatus";
import PlannerEnergySection from "./sections/PlannerEnergySection";
import PlannerSurfaceZonesSection from "./sections/PlannerSurfaceZonesSection";
import PlannerRouteControlsSection from "./sections/PlannerRouteControlsSection";
import PlannerImportSection from "./sections/PlannerImportSection";
import PlannerSetupSection from "./sections/PlannerSetupSection";
import PlannerObjectTransferSection from "./sections/PlannerObjectTransferSection";


export default function PlannerLeftSidebar({
  onCollapse,
  onImportFile,
  activePointKind,
  onActivePointKindChange,
  onClearVisitPoints,
  onClearChargePoints,
  onClearLimitPoints,
  routeTaskKey,
  onRouteTaskChange,
  algorithmKey,
  onAlgorithmChange,
  status,
  mission,
  onCancelMission,
  onResumeMission,
  energyWarning,
  routeBlocked,
  algorithmFields,
  selectedAlgorithmParams,
  onAlgorithmParamChange,
  isOptimizing,
  onOptimizeRoute,
  onSendRoute,
  onAddRandomObstacle,
  onStartObjectTransfer,
  onClearAll,
  hasRoute,
  routeLength,
  visitCount,
  chargeCount,
  zoneCount,
  polygonCount,
  adjustedVisitCount,
  activeZoneName,
  batteryRangeInput,
  onBatteryRangeChange,
  onBatteryRangeBlur,
  cruiseSpeedMps,
  cruiseSpeedInput,
  onCruiseSpeedChange,
  onCruiseSpeedBlur,
  payloadKg,
  payloadInput,
  onPayloadChange,
  onPayloadBlur,
  routeEnergyStats,
  routeInfluenceRows,
  routeTiming,
  surfaceZones,
  activeSurfaceZoneId,
  activeSurfaceZone,
  activeSurfaceProfileKey,
  onActiveSurfaceProfileChange,
  onCreateSurfaceZone,
  onSelectSurfaceZone,
  onToggleSurfaceZoneClosed,
  onClearSurfaceZone,
  onRemoveSurfaceZone,
  onClearAllSurfaceZones,
}) {
  return (
    <aside className="flex h-full min-h-0 w-[310px] min-w-[310px] max-w-[310px] flex-none flex-col overflow-hidden border-r border-stone-200 bg-gradient-to-b from-stone-100 via-white to-slate-100 xl:w-[330px] xl:min-w-[330px] xl:max-w-[330px]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2">
        <div className="min-w-0 pt-0.5">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-stone-700">
            Планировщик
          </div>
          <div className="truncate text-base font-bold text-stone-900">Маршрут робота</div>
        </div>
        {onCollapse ? (
          <button
            type="button"
            title="Свернуть левую панель"
            aria-label="Свернуть левую панель"
            onClick={onCollapse}
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-stone-600 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
          >
            <span className="text-lg leading-none" aria-hidden>
              {"<"}
            </span>
          </button>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 space-y-4 [scrollbar-gutter:stable]">
      <PlannerMissionStatus mission={mission} onCancel={onCancelMission} onResume={onResumeMission} />
      <PlannerObjectTransferSection onStartTransfer={onStartObjectTransfer} />
      <PlannerSetupSection
        activePointKind={activePointKind}
        activeZoneName={activeZoneName}
        adjustedVisitCount={adjustedVisitCount}
        algorithmKey={algorithmKey}
        chargeCount={chargeCount}
        onActivePointKindChange={onActivePointKindChange}
        onAlgorithmChange={onAlgorithmChange}
        onClearChargePoints={onClearChargePoints}
        onClearLimitPoints={onClearLimitPoints}
        onClearVisitPoints={onClearVisitPoints}
        onRouteTaskChange={onRouteTaskChange}
        polygonCount={polygonCount}
        routeBlocked={routeBlocked}
        routeTaskKey={routeTaskKey}
        status={status}
        visitCount={visitCount}
        zoneCount={zoneCount}
      />
      <PlannerEnergySection
        batteryRangeInput={batteryRangeInput}
        cruiseSpeedInput={cruiseSpeedInput}
        energyWarning={energyWarning}
        onBatteryRangeBlur={onBatteryRangeBlur}
        onBatteryRangeChange={onBatteryRangeChange}
        onCruiseSpeedBlur={onCruiseSpeedBlur}
        onCruiseSpeedChange={onCruiseSpeedChange}
        onPayloadBlur={onPayloadBlur}
        onPayloadChange={onPayloadChange}
        payloadInput={payloadInput}
        routeEnergyStats={routeEnergyStats}
        routeInfluenceRows={routeInfluenceRows}
        routeTiming={routeTiming}
      />
      <PlannerSurfaceZonesSection
        activeSurfaceProfileKey={activeSurfaceProfileKey}
        activeSurfaceZone={activeSurfaceZone}
        activeSurfaceZoneId={activeSurfaceZoneId}
        cruiseSpeedInput={cruiseSpeedInput}
        cruiseSpeedMps={cruiseSpeedMps}
        onActiveSurfaceProfileChange={onActiveSurfaceProfileChange}
        onClearAllSurfaceZones={onClearAllSurfaceZones}
        onClearSurfaceZone={onClearSurfaceZone}
        onCreateSurfaceZone={onCreateSurfaceZone}
        onRemoveSurfaceZone={onRemoveSurfaceZone}
        onSelectSurfaceZone={onSelectSurfaceZone}
        onToggleSurfaceZoneClosed={onToggleSurfaceZoneClosed}
        payloadInput={payloadInput}
        payloadKg={payloadKg}
        surfaceZones={surfaceZones}
      />
      <PlannerRouteControlsSection
        algorithmFields={algorithmFields}
        hasRoute={hasRoute}
        isOptimizing={isOptimizing}
        onAddRandomObstacle={onAddRandomObstacle}
        onAlgorithmParamChange={onAlgorithmParamChange}
        onClearAll={onClearAll}
        onOptimizeRoute={onOptimizeRoute}
        onSendRoute={onSendRoute}
        routeLength={routeLength}
        selectedAlgorithmParams={selectedAlgorithmParams}
      />
      <PlannerImportSection onImportFile={onImportFile} />
      </div>
    </aside>
  );
}
