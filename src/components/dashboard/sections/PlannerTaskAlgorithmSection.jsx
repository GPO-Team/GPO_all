import { ALGORITHM_OPTIONS, TASK_OPTIONS } from "../../../lib/routeAlgorithms";

const card = "rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)]";
const input = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

export default function PlannerTaskAlgorithmSection({ routeTaskKey, onRouteTaskChange, algorithmKey, onAlgorithmChange }) {
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
  </div>;
}
