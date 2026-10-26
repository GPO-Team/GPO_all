import { ALGORITHM_OPTIONS, PRECISION_OPTIONS, TASK_OPTIONS } from "../../../lib/routeAlgorithms";

const card = "rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)]";
const input = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

export default function PlannerTaskAlgorithmSection({ routeTaskKey, onRouteTaskChange, algorithmKey, onAlgorithmChange, algorithmPrecision, onAlgorithmPrecisionChange }) {
  const precisionHint = PRECISION_OPTIONS.find((option) => option.key === algorithmPrecision)?.hint;
  return <div className={card}>
    <label className="block text-xs text-stone-600">Задача маршрута
      <select className={`${input} mt-1`} value={routeTaskKey} onChange={(event) => onRouteTaskChange(event.target.value)}>
        {TASK_OPTIONS.map((task) => <option key={task.key} value={task.key}>{task.label}</option>)}
      </select>
    </label>
    <label className="mt-3 block text-xs text-stone-600">Алгоритм
      <select className={`${input} mt-1`} value={algorithmKey} onChange={(event) => onAlgorithmChange(event.target.value)}>
        {ALGORITHM_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>
    <div className="mt-3 text-xs text-stone-600" role="group" aria-label="Точность расчёта">Точность расчёта
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {PRECISION_OPTIONS.map((option) => <button type="button" key={option.key} aria-pressed={algorithmPrecision === option.key}
          title={option.hint} onClick={() => onAlgorithmPrecisionChange?.(option.key)}
          className="rounded-xl border border-stone-300 bg-white px-2 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 aria-pressed:border-sky-300 aria-pressed:bg-sky-50 aria-pressed:text-sky-800">
          {option.label}
        </button>)}
      </div>
      {precisionHint && <div className="mt-1 text-stone-500">{precisionHint}</div>}
    </div>
  </div>;
}
