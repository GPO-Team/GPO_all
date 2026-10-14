import HelpHint from "../HelpHint";
import { MAX_BATTERY_RANGE } from "../../../features/planner/model/energySettings";
const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-4";
const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";

const formatSeconds = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 сек";
  const totalSeconds = Math.max(1, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours} ч ${minutes} мин${remainingSeconds ? ` ${remainingSeconds} сек` : ""}`;
  }
  if (minutes > 0) {
    return `${minutes} мин${remainingSeconds ? ` ${remainingSeconds} сек` : ""}`;
  }
  return `${remainingSeconds} сек`;
};

export default function PlannerEnergySection({
  batteryRangeInput,
  cruiseSpeedInput,
  energyWarning,
  onBatteryRangeBlur,
  onBatteryRangeChange,
  onCruiseSpeedBlur,
  onCruiseSpeedChange,
  onPayloadBlur,
  onPayloadChange,
  payloadInput,
  routeEnergyStats,
  routeInfluenceRows,
  routeTiming,
}) {
  const actualRouteTimeText =
    routeTiming?.status === "running"
      ? `идет ${formatSeconds(routeTiming.actualTimeSec)}`
      : routeTiming?.status === "finished"
        ? formatSeconds(routeTiming.actualTimeSec)
        : "пока нет";

  return (
    <div className={cardCls}>
      <h3 className="text-sm font-semibold mb-3">Энергия и динамика <HelpHint label="Энергия и динамика">Карта покрытий влияет на расход, допустимую скорость и риски в поворотах. Укажите запас хода, скорость и массу груза перед построением маршрута.</HelpHint></h3>
      <label>
        <div className="text-xs text-stone-600 mb-1">Запас хода (энерго-ед.)</div>
        <input type="text" inputMode="numeric" value={batteryRangeInput} className={inputCls}
          onChange={(event) => onBatteryRangeChange(event.target.value)} onBlur={onBatteryRangeBlur} />
        <div className="mt-1 text-xs text-stone-500">Максимум: {MAX_BATTERY_RANGE} энерго-ед.</div>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-1">
          <div className="text-xs text-stone-600 mb-1">Скорость, м/с</div>
          <input type="text" inputMode="decimal" value={cruiseSpeedInput} className={inputCls}
            onChange={(event) => onCruiseSpeedChange(event.target.value)} onBlur={onCruiseSpeedBlur} />
        </label>
        <label className="col-span-1">
          <div className="text-xs text-stone-600 mb-1">Масса груза, кг</div>
          <input type="text" inputMode="decimal" value={payloadInput} className={inputCls}
            onChange={(event) => onPayloadChange(event.target.value)} onBlur={onPayloadBlur} />
        </label>
      </div>
      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 space-y-1">
        <div>Энергия маршрута: <span className="font-semibold">{routeEnergyStats.routeEnergy.toFixed(1)}</span></div>
        <div>Длина маршрута: <span className="font-semibold">{(routeEnergyStats.distanceMeters || 0).toFixed(1)} м</span></div>
        <div>Плановое время: <span className="font-semibold">{formatSeconds(routeEnergyStats.estimatedTimeSec)}</span></div>
        <div>Фактическое время: <span className="font-semibold">{actualRouteTimeText}</span></div>
        <div>Лимит по покрытию: <span className="font-semibold">{routeEnergyStats.limitingMaxSpeedMps.toFixed(2)} м/с</span></div>
        <div>Риск проскальзывания: <span className="font-semibold">{(routeEnergyStats.averageSlipRisk * 100).toFixed(1)}%</span></div>
      </div>
      {Array.isArray(routeInfluenceRows) && routeInfluenceRows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white text-xs">
          <div className="grid grid-cols-[1.15fr_0.85fr_1fr] bg-stone-100 px-3 py-2 font-semibold text-stone-700">
            <div>Критерий</div><div>Значение</div><div>Влияние</div>
          </div>
          {routeInfluenceRows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1.15fr_0.85fr_1fr] border-t border-stone-100 px-3 py-2 text-stone-700">
              <div className="font-medium text-stone-800">{row.label}</div><div>{row.value}</div><div>{row.impact}</div>
            </div>
          ))}
        </div>
      )}
      {energyWarning && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{energyWarning}</div>
      )}
    </div>
  );
}
