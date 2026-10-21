import HelpHint from "../HelpHint";

const cardCls =
  "rounded-[18px] bg-white/97 backdrop-blur border border-sky-100 shadow-[0_12px_30px_rgba(14,165,233,0.10)] p-4";
const zoneCardCls =
  "rounded-[16px] border p-3 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]";
const primaryButtonCls =
  "rounded-md border border-sky-300 bg-sky-100 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 shadow-sm transition hover:bg-sky-200";
const neutralButtonCls =
  "rounded-md border border-stone-300 bg-stone-100 px-2.5 py-1.5 text-[11px] font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200";
const dangerButtonCls =
  "rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100";

export default function PlannerLimitZonesSection({
  activeLimitZoneId,
  activeZone,
  activeZoneName,
  onClearZone,
  onCreateZone,
  onRemoveZone,
  onSelectZone,
  onToggleZoneClosed,
  zoneEntries,
}) {
  return (
    <>
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-sky-700">Активная зона <HelpHint label="Как работают зоны">В открытую зону можно добавлять и двигать точки. Замкнутая зона участвует в расчёте безопасного маршрута. Точки внутри замкнутого контура автоматически выносятся в безопасную позицию.</HelpHint></div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{activeZoneName}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{activeZone?.closed ? "Замкнута" : "Открыта"}</div>
            <div className="mt-1">Точек: {activeZone?.points.length || 0}</div>
          </div>
        </div>
      </div>
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Ограничивающие зоны</h3>
            <div className="mt-1 text-xs text-slate-500">Управление контурами и их статусом</div>
          </div>
          <button onClick={onCreateZone} className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-800">Новая зона</button>
        </div>
        <details open className="planner-disclosure">
          <summary className="disclosure-trigger flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-900">
            <span className="min-w-0 flex-1">Зоны</span><span className="shrink-0 text-xs font-normal text-slate-500">{zoneEntries.length} шт.</span><span className="disclosure-hint text-xs font-normal text-sky-700">Раскрыть</span>
          </summary>
        <div className="mt-3 space-y-2">
          {zoneEntries.map((zone) => {
            const active = zone.id === activeLimitZoneId;
            return (
              <div key={zone.id} className={`${zoneCardCls} ${active ? "border-sky-300 bg-sky-50" : "border-sky-100 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <button className="flex-1 min-w-0 rounded-xl border border-sky-100 bg-white px-3 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50" onClick={() => onSelectZone(zone.id)}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-full ${zone.color.badge}`} />
                      <span className="text-sm font-semibold text-slate-900">{zone.name}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${zone.closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {zone.closed ? "Замкнута" : "Открыта"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div>Точек: {zone.points.length}</div><div>{zone.points.length >= 3 ? "Контур готов" : "Нужно 3 точки"}</div>
                    </div>
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <button onClick={() => onToggleZoneClosed(zone.id)} className={primaryButtonCls}>{zone.closed ? "Открыть" : "Замкнуть"}</button>
                  <button onClick={() => onClearZone(zone.id)} disabled={!zone.points.length} className={neutralButtonCls}>Очистить зону</button>
                  <button onClick={() => onRemoveZone(zone.id)} className={dangerButtonCls}>Удалить</button>
                </div>
              </div>
            );
          })}
        </div>
        </details>
      </div>
    </>
  );
}
