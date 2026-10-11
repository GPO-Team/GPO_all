import HelpHint from "../HelpHint";
import {
  ROUTE_CLEARANCE_MARGIN,
  SAFE_POINT_MARGIN,
} from "../../../lib/zonePlanner";

const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-3";
const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";
const neutralButtonCls =
  "rounded-xl border border-slate-300 bg-slate-800 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900";

const missionStatusText = (mission) => {
  if (!mission) return null;
  if (mission.connectionError) return `Не удалось получить статус миссии: ${mission.connectionError}`;
  if (mission.status === "cancelling") return "Ожидаем подтверждения остановки от контроллера…";
  if (mission.feedbackFresh === false && !["completed", "cancelled", "failed"].includes(mission.status)) {
    return "Нет подтверждения от контроллера. Если Webots перезапускался, нажмите «Остановить маршрут», дождитесь остановки и отправьте маршрут снова.";
  }
  return {
    prepared: "Подготавливаем маршрут к отправке…",
    persisted: "Маршрут сохранён. Ожидаем подтверждения контроллера…",
    accepted: "Контроллер принял маршрут. Ожидаем начала движения…",
    running: "Робот выполняет маршрут.",
    cancelled: "Маршрут остановлен. Можно отправить новый.",
    completed: "Робот завершил маршрут.",
    failed: "Не удалось выполнить маршрут.",
  }[mission.status] || null;
};

export default function PlannerRouteControlsSection({
  showParameters = true,
  showActions = true,
  showObstacle = true,
  algorithmFields,
  hasRoute,
  isOptimizing,
  onAddRandomObstacle,
  onAlgorithmParamChange,
  onClearAll,
  onClearVisitPoints,
  onCancelMission,
  mission,
  onOptimizeRoute,
  onSendRoute,
  routeLength,
  selectedAlgorithmParams,
}) {
  const missionStatus = missionStatusText(mission);
  return (
    <>
      {showParameters && <details className={cardCls}>
        <summary className="cursor-pointer text-xs font-semibold">Параметры алгоритма</summary>
        <div className="space-y-3">
          {algorithmFields.map((field) => (
            <label key={field.key}>
              <div className="text-xs text-stone-600 mb-1">{field.label}</div>
              <input type="number" min={field.min} max={field.max} step={field.step}
                value={selectedAlgorithmParams[field.key]} className={inputCls}
                onChange={(event) => onAlgorithmParamChange(field, event.target.value)} />
            </label>
          ))}
        </div>
      </details>}
      {showActions && <div className={showParameters ? cardCls : ""}>
        <div className="mb-2 text-xs font-semibold">Управление <HelpHint label="Безопасный маршрут">
          Маршрут строится с зазором {ROUTE_CLEARANCE_MARGIN.toFixed(2)} м от контура,
          а целевые точки держатся минимум на {SAFE_POINT_MARGIN.toFixed(2)} м от запретной зоны.
        </HelpHint></div>
        <div className="grid grid-cols-2 gap-2"><button onClick={onOptimizeRoute} disabled={isOptimizing}
          className={`w-full h-9 rounded-xl text-white text-xs font-semibold transition ${isOptimizing ? "bg-orange-400 cursor-wait" : "bg-orange-600 hover:bg-orange-700"}`}>
          {isOptimizing ? "Строим маршрут..." : "Построить маршрут"}
        </button>
        <button onClick={onSendRoute} disabled={isOptimizing || !hasRoute}
          className={`w-full h-9 rounded-xl text-white text-xs font-semibold transition ${isOptimizing || !hasRoute ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          Отправить маршрут
        </button>
        <button type="button" onClick={onCancelMission} disabled={!mission || ["completed", "cancelled", "failed", "cancelling"].includes(mission.status)}
          className="h-9 w-full rounded-xl bg-rose-600 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
          {mission?.status === "cancelling" ? "Останавливаем…" : "Остановить маршрут"}
        </button>
        <button type="button" onClick={onClearVisitPoints} className="h-9 w-full whitespace-nowrap rounded-xl border border-slate-300 bg-slate-800 px-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-900">Очистить маршрутные точки</button>
        {showObstacle && <button onClick={onAddRandomObstacle} disabled={isOptimizing}
          className={`w-full h-9 rounded-xl text-white text-xs font-semibold transition ${isOptimizing ? "bg-sky-400 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"}`}>
          + Препятствие
        </button>}
        <button onClick={onClearAll} className={`w-full h-9 ${neutralButtonCls}`}>Очистить всё</button></div>
        {missionStatus && <p role="status" className="mt-2 text-xs leading-relaxed text-stone-700">{missionStatus}</p>}
        {hasRoute && <p className="mt-3 text-sm">Длина маршрута: <b>{routeLength.toFixed(2)} м</b></p>}
      </div>}
    </>
  );
}
