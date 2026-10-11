import HelpHint from "../HelpHint";
import { POINT_KIND_OPTIONS } from "../../../lib/zonePlanner";

const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-3";
const subtleButtonCls =
  "rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200 hover:border-stone-400";

export default function PlannerSetupSection({
  kinds = ["visit", "charge", "limit", "surface"],
  showOverview = true,
  showClear = true,
  activeZoneName,
  adjustedVisitCount,
  chargeCount,
  onClearChargePoints,
  onClearLimitPoints,
  onClearVisitPoints,
  onClearSurfaceZones,
  polygonCount,
  routeBlocked,
  status,
  visitCount,
  zoneCount,
}) {
  return (
    <>
      {showOverview && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Точки <b>{visitCount}</b> · зарядки <b>{chargeCount}</b> · зоны <b>{zoneCount}</b></span>
        <HelpHint label="Обозначения карты">Красные точки — посещения, жёлтые — зарядки, синие контуры — запретные зоны, зелёный значок — робот. Готовых контуров: {polygonCount}; безопасно смещённых точек: {adjustedVisitCount}. Активная зона: {activeZoneName}.</HelpHint>
      </div>}
      <div className={cardCls}>
        <div className="text-xs font-semibold text-sky-800">
          {POINT_KIND_OPTIONS.filter((option) => kinds.includes(option.key)).map((option) => option.label).join(" · ")}
          <HelpHint label="Добавление точек">Раздел меню сразу включает свой режим точек. Нажмите на карту, чтобы поставить точку; перетащите существующую для изменения позиции. Масштаб — колёсиком, перемещение карты — правой кнопкой или Alt + перетаскиванием.</HelpHint>
        </div>
        <p className="mt-1 text-xs text-stone-600">Нажмите на карту, чтобы поставить точку.</p>
        {showClear && <div className="mt-3 grid gap-2">
          {kinds.includes("visit") && <button onClick={onClearVisitPoints} className={subtleButtonCls}>Очистить маршрутные точки</button>}
          {kinds.includes("charge") && <button onClick={onClearChargePoints} className={subtleButtonCls}>Очистить зарядки</button>}
          {kinds.includes("limit") && <button onClick={onClearLimitPoints} className={subtleButtonCls}>Очистить зоны</button>}
          {kinds.includes("surface") && <button onClick={onClearSurfaceZones} className={subtleButtonCls}>Очистить покрытия</button>}
        </div>}
      </div>
      {status && <div className={`text-xs ${routeBlocked ? "text-rose-700" : "text-emerald-700"}`}>{status}</div>}
    </>
  );
}
