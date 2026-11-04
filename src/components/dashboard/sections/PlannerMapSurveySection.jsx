import HelpHint from "../HelpHint";

const selectCls = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

export default function PlannerMapSurveySection({
  telemetry, mappingSurveyMode, mappingSurveyModes, onMappingSurveyModeChange,
  onStartMappingSurvey, onRequestMapExport, mapExportPromptOpen, onExportMapVariant, onCancelMapExport,
}) {
  const lidarCellCount = telemetry.obstacleMap?.cells?.length || 0;
  const cameraCellCount = (telemetry.cameraMap?.cells?.length || 0) + (telemetry.cameraMap?.freeCells?.length || 0);
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">
        Карта препятствий <HelpHint label="Карта препятствий">
        Постоянная карта строится из лидарных попаданий и рисуется поверх рабочей сетки.
        Карту и текущий след лидара можно показывать независимо друг от друга.
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
              Область обследования
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
  );
}
