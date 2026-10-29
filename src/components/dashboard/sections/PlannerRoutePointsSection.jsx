import { DEFAULT_POINT_TASK, POINT_KIND_META, POINT_TASKS } from "../../../lib/zonePlanner";

const zonePanelCardCls =
  "rounded-[18px] bg-white/97 backdrop-blur border border-sky-100 shadow-[0_12px_30px_rgba(14,165,233,0.10)] p-4";
const rowCls =
  "flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-stone-300 bg-white shadow-sm hover:bg-stone-50 hover:border-stone-400 cursor-pointer transition";
const selectCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

export default function PlannerRoutePointsSection({
  showVisit = true,
  showCharge = true,
  chargeEntries,
  expandedPoint,
  hoveredPointIndex,
  onDeletePoint,
  onHoverPoint,
  onToggleExpandedPoint,
  onUpdatePointTask,
  plannedVisitEntries,
  visitEntries,
  editingLocked=false,
}) {
  const plannedVisitLookup = new Map(plannedVisitEntries.map((entry) => [entry.index, entry]));

  return (
    <>
      {showVisit && <details className={`planner-disclosure ${zonePanelCardCls}`}>
        <summary className="disclosure-trigger flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm font-semibold">
          <span>Точки посещения</span>
          <span className="ml-auto text-xs text-stone-500">{visitEntries.length} шт.</span>
          <span className="disclosure-hint text-xs font-normal text-sky-700">Раскрыть</span>
        </summary>
        <div className="mt-3 space-y-2">
          {visitEntries.map((entry) => {
            const expanded = expandedPoint === entry.index;
            const hovered = hoveredPointIndex === entry.index;
            const plannedEntry = plannedVisitLookup.get(entry.index);

            return (
              <div key={entry.index}>
                <div
                  className={`${rowCls} ${hovered ? "border-sky-300 bg-sky-50 shadow-sm" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  aria-label={`${entry.order===null ? "Свободная точка" : `Точка посещения V${entry.order}`}: ${expanded ? "свернуть" : "раскрыть"}`}
                  onClick={() => onToggleExpandedPoint(expanded ? null : entry.index)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggleExpandedPoint(expanded ? null : entry.index);
                    }
                  }}
                  onMouseEnter={() => onHoverPoint(entry.index)}
                  onMouseLeave={() => onHoverPoint(null)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {entry.order===null ? "Без номера" : `V${entry.order}`} ({entry.point.x.toFixed(2)}, {entry.point.y.toFixed(2)})
                    </div>
                    <div className="inline-flex mt-1 px-2 py-0.5 rounded-full border text-[11px] bg-rose-50 border-rose-200 text-rose-700">
                      {POINT_KIND_META[entry.point.kind]?.label || POINT_KIND_META.visit.label}
                    </div>
                    {plannedEntry?.adjusted && (
                      <div className="inline-flex mt-1 ml-2 px-2 py-0.5 rounded-full border text-[11px] bg-amber-50 border-amber-200 text-amber-700">
                        Автосдвиг
                      </div>
                    )}
                  </div>
                  <span className="ml-auto text-sky-700" aria-hidden="true">{expanded ? "⌄" : "›"}</span>
                  <button
                    type="button"
                    aria-label={entry.order===null ? "Удалить свободную точку" : `Удалить точку V${entry.order}`}
                    disabled={editingLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeletePoint(entry.index);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-red-300 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition"
                  >
                    x
                  </button>
                </div>
                {expanded && (
                  <div className="mt-2 ml-2 p-3 rounded-xl border border-stone-200 bg-white space-y-2">
                    <div className="text-sm">
                      x: {entry.point.x.toFixed(4)}, y: {entry.point.y.toFixed(4)}
                    </div>
                    {plannedEntry?.adjusted && (
                      <div className="text-xs text-amber-700">
                        Безопасная точка маршрута: x={plannedEntry.plannedPoint.x.toFixed(4)}, y=
                        {plannedEntry.plannedPoint.y.toFixed(4)}
                      </div>
                    )}
                    <label>
                      <div className="text-xs text-stone-500 mb-1">Операция</div>
                      <select
                        className={selectCls}
                        value={entry.point.task || DEFAULT_POINT_TASK}
                        onChange={(event) => onUpdatePointTask(entry.index, event.target.value)}
                      >
                        {POINT_TASKS.map((task) => (
                          <option key={task} value={task}>
                            {task}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {!visitEntries.length && (
            <div className="text-sm text-stone-500">Добавьте на карте точки, которые нужно посетить.</div>
          )}
        </div>
      </details>}

      {showCharge && <div className={zonePanelCardCls}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold">Станции зарядки</h3>
          <span className="text-xs text-stone-500">{chargeEntries.length} шт.</span>
        </div>
        <div className="space-y-2">
          {chargeEntries.map((entry) => (
            <div
              key={entry.index}
              className={`${rowCls} ${
                hoveredPointIndex === entry.index ? "border-amber-300 bg-amber-50 shadow-sm" : ""
              }`}
              onMouseEnter={() => onHoverPoint(entry.index)}
              onMouseLeave={() => onHoverPoint(null)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  C{entry.order} ({entry.point.x.toFixed(2)}, {entry.point.y.toFixed(2)})
                </div>
                <div className="inline-flex mt-1 px-2 py-0.5 rounded-full border text-[11px] bg-amber-50 border-amber-200 text-amber-700">
                  {POINT_KIND_META.charge.label}
                </div>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDeletePoint(entry.index);
                }}
                className="flex items-center justify-center w-7 h-7 rounded-md border border-red-300 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition"
              >
                x
              </button>
            </div>
          ))}
          {!chargeEntries.length && (
            <div className="text-sm text-stone-500">
              Добавьте станции зарядки, чтобы робот мог выполнять длинные маршруты.
            </div>
          )}
        </div>
      </div>}
    </>
  );
}
