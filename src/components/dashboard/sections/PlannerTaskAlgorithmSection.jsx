import { ALGORITHM_OPTIONS, PRECISION_OPTIONS, TASK_OPTIONS } from "../../../lib/routeAlgorithms";

const input = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500";

const LOCK_MESSAGES = {
  optimizing: "Идёт расчёт маршрута. Задачу, алгоритм и точность можно изменить после его завершения.",
  mission: "Робот выполняет миссию. Задачу, алгоритм и точность можно изменить после её завершения или отмены.",
};

export default function PlannerTaskAlgorithmSection({ locked = false, lockReason = null, routeTaskKey, onRouteTaskChange, algorithmKey, onAlgorithmChange, algorithmPrecision, onAlgorithmPrecisionChange }) {
  const precisionHint = PRECISION_OPTIONS.find((option) => option.key === algorithmPrecision)?.hint;
  return <section className="map-settings">
    <h3 className="map-settings-title">Задача маршрута</h3>
    {locked && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {LOCK_MESSAGES[lockReason] || LOCK_MESSAGES.mission}
    </div>}
    <div className={locked ? "cursor-not-allowed opacity-60" : undefined} aria-disabled={locked || undefined}>
    <label className="block text-xs text-stone-600">Тип задачи
      <select disabled={locked} className={`${input} mt-1`} value={routeTaskKey} onChange={(event) => onRouteTaskChange(event.target.value)}>
        {TASK_OPTIONS.map((task) => <option key={task.key} value={task.key}>{task.label}</option>)}
      </select>
    </label>
    <label className="mt-3 block text-xs text-stone-600">Алгоритм
      <select disabled={locked} className={`${input} mt-1`} value={algorithmKey} onChange={(event) => onAlgorithmChange(event.target.value)}>
        {ALGORITHM_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
    <div className="mt-3 text-xs text-stone-600" role="group" aria-label="Точность расчёта">Точность расчёта
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {PRECISION_OPTIONS.map((option) => <button type="button" key={option.key} disabled={locked} aria-pressed={algorithmPrecision === option.key}
          onClick={() => onAlgorithmPrecisionChange?.(option.key)}
          className="rounded-xl border border-stone-300 bg-white px-2 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed aria-pressed:border-sky-300 aria-pressed:bg-sky-50 aria-pressed:text-sky-800">
          {option.label}
        </button>)}
      </div>
      {precisionHint && <p className="mt-2 rounded-xl bg-stone-50 px-3 py-2 leading-relaxed text-stone-600" aria-live="polite">{precisionHint}</p>}
    </div>
    </div>
  </section>;
}
