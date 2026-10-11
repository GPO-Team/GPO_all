const zonePanelCardCls =
  "rounded-[18px] bg-white/97 backdrop-blur border border-sky-100 shadow-[0_12px_30px_rgba(14,165,233,0.10)] p-4";

export default function PlannerConstraintsSection({
  adjustedVisitCount,
  polygonCount,
  routeBlocked,
  visitsInsideLimitCount,
}) {
  return (
    <details className={zonePanelCardCls}>
      <summary className="cursor-pointer text-sm font-semibold">Контроль ограничений</summary>
      <div className="mt-3 space-y-2 text-sm text-stone-700">
        <div>
          Точек внутри зон: <b>{visitsInsideLimitCount}</b>
        </div>
        <div>
          Контуров, готовых для обхода: <b>{polygonCount}</b>
        </div>
        <div>
          Точек с автосдвигом: <b>{adjustedVisitCount}</b>
        </div>
        <div>
          Маршрут пересекает контур: <b>{routeBlocked ? "да" : "нет"}</b>
        </div>
      </div>
      <div className="mt-3 text-xs text-stone-500 space-y-1">
        <div>В обходе участвуют только замкнутые зоны.</div>
        <div>Любую точку можно перетащить мышкой прямо на карте.</div>
        <div>Если безопасный обход построить нельзя, маршрут не отправляется.</div>
      </div>
    </details>
  );
}
