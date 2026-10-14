const zonePanelCardCls =
  "rounded-[18px] bg-white/97 backdrop-blur border border-sky-100 shadow-[0_12px_30px_rgba(14,165,233,0.10)] p-4";
const selectCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

export default function PlannerTelemetrySection({
  mapExportPromptOpen,
  mappingSurveyMode,
  mappingSurveyModes,
  onCancelMapExport,
  onExportMapVariant,
  onMappingSurveyModeChange,
  onRequestMapExport,
  onStartMappingSurvey,
  routeWsUp,
  solverApiUp,
  telemetry,
  telemetryWsUp,
}) {
  const camera = telemetry.perception?.camera;
  const cameraFrame = camera?.frameDataUrl;
  const lidarCellCount = telemetry.obstacleMap?.cells?.length || 0;
  const cameraObstacleCellCount = telemetry.cameraMap?.cells?.length || 0;
  const cameraFreeCellCount = telemetry.cameraMap?.freeCells?.length || 0;
  const cameraCellCount = cameraObstacleCellCount + cameraFreeCellCount;

  return (
    <div className={zonePanelCardCls}>
      <h3 className="text-sm font-semibold mb-2">Телеметрия</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>x: {telemetry.x.toFixed(2)}</div>
        <div>y: {telemetry.y.toFixed(2)}</div>
        <div>z: {telemetry.z.toFixed(2)}</div>
        <div>yaw: {telemetry.yaw.toFixed(2)}</div>
        <div>lidar: {telemetry.perception?.lidar?.enabled ? "on" : "off"}</div>
        <div>camera: {camera?.enabled ? (camera.mode === "virtual_lidar" ? "virtual" : "on") : "off"}</div>
        <div>hits: {telemetry.obstacleTrace?.length || 0}</div>
        <div>cells: {telemetry.obstacleMap?.cellCount || lidarCellCount}</div>
        <div>cam cells: {telemetry.cameraMap?.cellCount || cameraCellCount}</div>
        <div>cam occ: {telemetry.cameraMap?.obstacleCellCount || cameraObstacleCellCount}</div>
        <div>cam free: {telemetry.cameraMap?.freeCellCount || cameraFreeCellCount}</div>
        <div>
          cam dist:{" "}
          {camera?.obstacleVisible && Number.isFinite(camera?.obstacleRange)
            ? `${camera.obstacleRange.toFixed(2)} m`
            : "-"}
        </div>
        <div>cam det: {camera?.detectionCount || 0}</div>
        <div>cell: {(telemetry.obstacleMap?.cellSize || 0.06).toFixed(2)} м</div>
      </div>
      <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
        Время объезда вне маршрута:{" "}
        <span className="font-semibold">
          {Math.round(telemetry.navigation?.avoidanceTimeSec || 0)} сек
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-xs text-slate-200">
          <span className="font-semibold">Камера робота</span>
          <span>
            {camera?.obstacleVisible
              ? `объект ${Math.round((camera.obstacleScore || 0) * 100)}%`
              : `${camera?.width || 0}x${camera?.height || 0}`}
          </span>
        </div>
        <div className="aspect-video bg-slate-900">
          {cameraFrame ? (
            <img src={cameraFrame} alt="Кадр с камеры робота" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">Нет кадра</div>
          )}
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">
          Карта препятствий
        </div>
        <div className="mt-1 text-xs text-cyan-900">
          Лидарная карта собирается для навигации и экспорта PNG.
          Камерная карта добавляется отдельным фиолетовым слоем по визуальным попаданиям камеры.
        </div>
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
      <div className="mt-3 text-xs text-stone-600">
        WS Telemetry:{" "}
        <span className={telemetryWsUp ? "text-emerald-700" : "text-red-600"}>
          {telemetryWsUp ? "connected" : "disconnected"}
        </span>
      </div>
      <div className="text-xs text-stone-600">
        WS Route:{" "}
        <span className={routeWsUp ? "text-emerald-700" : "text-red-600"}>
          {routeWsUp ? "connected" : "disconnected"}
        </span>
      </div>
      <div className="text-xs text-stone-600">
        Native Solver:{" "}
        <span className={solverApiUp ? "text-emerald-700" : "text-red-600"}>
          {solverApiUp ? "connected" : "disconnected"}
        </span>
      </div>
    </div>
  );
}
