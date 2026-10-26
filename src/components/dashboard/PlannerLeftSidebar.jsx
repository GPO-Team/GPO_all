import PlannerEnergySection from "./sections/PlannerEnergySection";
import PlannerSurfaceZonesSection from "./sections/PlannerSurfaceZonesSection";
import PlannerRouteControlsSection from "./sections/PlannerRouteControlsSection";
import PlannerRoutePointsSection from "./sections/PlannerRoutePointsSection";
import PlannerLimitZonesSection from "./sections/PlannerLimitZonesSection";
import PlannerImportSection from "./sections/PlannerImportSection";
import PlannerSetupSection from "./sections/PlannerSetupSection";
import PlannerObjectTransferSection from "./sections/PlannerObjectTransferSection";
import HelpHint from "./HelpHint";
import PlannerRuntimeObstaclesSection from "./sections/PlannerRuntimeObstaclesSection";


export default function PlannerLeftSidebar({
  onCollapse,
  onImportFile,
  activePointKind,
  onActivePointKindChange,
  visitPointMode = "visit",
  onVisitPointModeChange,
  visitEntries,
  chargeEntries,
  plannedVisitEntries,
  expandedPoint,
  hoveredPointIndex,
  onToggleExpandedPoint,
  onHoverPoint,
  onDeletePoint,
  onUpdatePointTask,
  onClearVisitPoints,
  onClearChargePoints,
  onClearLimitPoints,
  status,
  mission,
  onCancelMission,
  onStartObjectTransfer,
  editingLocked=false,onExportCsv,hasPoints=false,
  energyWarning,
  routeBlocked,
  isOptimizing,
  onOptimizeRoute,
  onSendRoute,
  onAddRandomObstacle,
  runtimeObstacles,
  activeRuntimeObstacleId,
  onSelectRuntimeObstacle,
  onEditRuntimeObstacle,
  onDeleteRuntimeObstacle,
  hasRoute,
  routeLength,
  visitCount,
  chargeCount,
  zoneCount,
  zoneEntries,
  activeLimitZoneId,
  activeZone,
  onCreateZone,
  onSelectZone,
  onToggleZoneClosed,
  onClearZone,
  onRemoveZone,
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
  onSurfaceProfileChange,
  onCreateSurfaceZone,
  onSelectSurfaceZone,
  onToggleSurfaceZoneClosed,
  onClearSurfaceZone,
  onRemoveSurfaceZone,
  onClearAllSurfaceZones,
}) {
  const tab = { visit: "route", free_visit: "route", limit: "objects", surface: "surfaces", charge: "energy" }[activePointKind] || "route";
  const selectTab = (key) => {
    onActivePointKindChange({ route: visitPointMode, objects: "limit", surfaces: "surface", energy: "charge" }[key]);
  };
  return (
    <aside className="planner-sidebar planner-sidebar-left flex h-full min-h-0 w-[416px] min-w-[416px] max-w-[416px] flex-none flex-col overflow-hidden border-r border-stone-200 bg-gradient-to-b from-stone-100 via-white to-slate-100">
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

      <nav className="panel-tabs" aria-label="Разделы планировщика">
        {[["route", "Маршрут"], ["objects", "Зоны"], ["surfaces", "Покрытия"], ["energy", "Энергия"]].map(([key, label]) => {
          const alert = key === "energy" && Boolean(energyWarning);
          return <button type="button" key={key} aria-pressed={tab === key} data-alert={alert || undefined}
            title={alert ? energyWarning : undefined} onClick={() => selectTab(key)}>
            {label}{alert && <span className="panel-tab-alert" role="img" aria-label="не хватает энергии на маршрут">!</span>}
          </button>;
        })}
      </nav>
      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2 space-y-2">
      {tab === "route" && <PlannerSetupSection
        editingLocked={editingLocked}
        isOptimizing={isOptimizing}
        onVisitPointModeChange={onVisitPointModeChange}
        kinds={["visit"]}
        activePointKind={activePointKind}
        activeZoneName={activeZoneName}
        adjustedVisitCount={adjustedVisitCount}
        chargeCount={chargeCount}
        onActivePointKindChange={onActivePointKindChange}
        onClearChargePoints={onClearChargePoints}
        onClearLimitPoints={onClearLimitPoints}
        onClearVisitPoints={onClearVisitPoints}
        polygonCount={polygonCount}
        routeBlocked={routeBlocked}
        status={status}
        visitCount={visitCount}
        zoneCount={zoneCount}
      />}
      {tab === "route" && <PlannerRouteControlsSection showObstacle={false}
        hasRoute={hasRoute}
        isOptimizing={isOptimizing}
        onAddRandomObstacle={onAddRandomObstacle}
        onCancelMission={onCancelMission}
        mission={mission}
        onOptimizeRoute={onOptimizeRoute}
        onSendRoute={onSendRoute}
        routeLength={routeLength}
      />}
      {tab === "route" && <PlannerRoutePointsSection
        editingLocked={editingLocked}
        showVisit
        showCharge={false}
        visitEntries={visitEntries || []}
        chargeEntries={chargeEntries || []}
        plannedVisitEntries={plannedVisitEntries || []}
        expandedPoint={expandedPoint}
        hoveredPointIndex={hoveredPointIndex}
        onDeletePoint={onDeletePoint}
        onHoverPoint={onHoverPoint}
        onToggleExpandedPoint={onToggleExpandedPoint}
        onUpdatePointTask={onUpdatePointTask}
      />}
      {tab === "objects" && <>
        <PlannerSetupSection
          kinds={["limit"]}
          activePointKind={activePointKind}
          activeZoneName={activeZoneName}
          adjustedVisitCount={adjustedVisitCount}
          chargeCount={chargeCount}
          onActivePointKindChange={onActivePointKindChange}
          onClearChargePoints={onClearChargePoints}
          onClearLimitPoints={onClearLimitPoints}
          onClearVisitPoints={onClearVisitPoints}
          polygonCount={polygonCount}
          routeBlocked={routeBlocked}
          status={status}
          visitCount={visitCount}
          zoneCount={zoneCount}
        />
        <PlannerLimitZonesSection
          activeLimitZoneId={activeLimitZoneId}
          activeZone={activeZone}
          activeZoneName={activeZoneName}
          onClearZone={onClearZone}
          onCreateZone={onCreateZone}
          onRemoveZone={onRemoveZone}
          onSelectZone={onSelectZone}
          onToggleZoneClosed={onToggleZoneClosed}
          zoneEntries={zoneEntries || []}
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAddRandomObstacle} disabled={isOptimizing} className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">+ Препятствие в Webots</button>
          <HelpHint label="Случайное препятствие">Запрашивает объёмный объект в Webots. На карте показан его контур в реальном масштабе, в списке — размеры и статус команды. «Команда принята» подтверждает отправку, создание в симуляции зависит от контроллера.</HelpHint>
        </div>
        <PlannerRuntimeObstaclesSection obstacles={runtimeObstacles}
          activeObstacleId={activeRuntimeObstacleId} onSelect={onSelectRuntimeObstacle}
          onApply={onEditRuntimeObstacle} onDelete={onDeleteRuntimeObstacle} />
      </>}
      {tab === "energy" && <>
      <PlannerSetupSection
        kinds={["charge"]}
        activePointKind={activePointKind}
        activeZoneName={activeZoneName}
        adjustedVisitCount={adjustedVisitCount}
        chargeCount={chargeCount}
        onActivePointKindChange={onActivePointKindChange}
        onClearChargePoints={onClearChargePoints}
        onClearLimitPoints={onClearLimitPoints}
        onClearVisitPoints={onClearVisitPoints}
        polygonCount={polygonCount}
        routeBlocked={routeBlocked}
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
      <PlannerRoutePointsSection
        showVisit={false}
        showCharge
        visitEntries={visitEntries || []}
        chargeEntries={chargeEntries || []}
        plannedVisitEntries={plannedVisitEntries || []}
        expandedPoint={expandedPoint}
        hoveredPointIndex={hoveredPointIndex}
        onDeletePoint={onDeletePoint}
        onHoverPoint={onHoverPoint}
        onToggleExpandedPoint={onToggleExpandedPoint}
        onUpdatePointTask={onUpdatePointTask}
      />
      </>}
      {tab === "surfaces" && <>
      <PlannerSetupSection
        kinds={["surface"]}
        surfaceCount={surfaceZones?.length || 0}
        activePointKind={activePointKind}
        onActivePointKindChange={onActivePointKindChange}
        onClearSurfaceZones={onClearAllSurfaceZones}
      />
      <PlannerSurfaceZonesSection
        activeSurfaceZoneId={activeSurfaceZoneId}
        cruiseSpeedInput={cruiseSpeedInput}
        cruiseSpeedMps={cruiseSpeedMps}
        onSurfaceProfileChange={onSurfaceProfileChange}
        onClearSurfaceZone={onClearSurfaceZone}
        onCreateSurfaceZone={onCreateSurfaceZone}
        onRemoveSurfaceZone={onRemoveSurfaceZone}
        onSelectSurfaceZone={onSelectSurfaceZone}
        onToggleSurfaceZoneClosed={onToggleSurfaceZoneClosed}
        payloadInput={payloadInput}
        payloadKg={payloadKg}
        surfaceZones={surfaceZones}
      />
      </>}
      {tab === "route" && <details className="planner-disclosure rounded-xl border border-orange-200 bg-white p-3">
        <summary className="disclosure-trigger text-sm font-semibold">Перенос объекта</summary>
        <div className="mt-3"><PlannerObjectTransferSection onStartTransfer={onStartObjectTransfer} /></div>
      </details>}
      {tab === "route" && <PlannerImportSection onImportFile={onImportFile} onExportCsv={onExportCsv} hasPoints={hasPoints} editingLocked={editingLocked} />}
      </div>
    </aside>
  );
}
