import HelpHint from "../HelpHint";
import {
  SURFACE_PROFILE_OPTIONS,
  describeSurfaceRuntime,
} from "../../../lib/energyModel";

const cardCls =
  "rounded-[18px] bg-white/97 backdrop-blur border border-sky-100 shadow-[0_12px_30px_rgba(14,165,233,0.10)] p-4";
const primaryButtonCls = "rounded-md border border-sky-300 bg-sky-100 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 shadow-sm transition hover:bg-sky-200";
const neutralButtonCls = "rounded-md border border-stone-300 bg-stone-100 px-2.5 py-1.5 text-[11px] font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200";
const dangerButtonCls = "rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100";

const parseLooseInput = (rawValue, fallback) => {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function PlannerSurfaceZonesSection({
  activeSurfaceZoneId,
  cruiseSpeedInput,
  cruiseSpeedMps,
  onSurfaceProfileChange,
  onClearSurfaceZone,
  onCreateSurfaceZone,
  onRemoveSurfaceZone,
  onSelectSurfaceZone,
  onToggleSurfaceZoneClosed,
  payloadInput,
  payloadKg,
  surfaceZones,
}) {
  const surfaceZoneList = Array.isArray(surfaceZones) ? surfaceZones : [];
  const closedSurfaceCount = surfaceZoneList.filter(
    (zone) => zone?.closed !== false && Array.isArray(zone?.points) && zone.points.length >= 3
  ).length;

  return (
    <div className={cardCls}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Покрытия карты</h3>
          <div className="text-xs text-slate-500">Замкнутых контуров: {closedSurfaceCount} <HelpHint label="Покрытия карты">Выберите зону для добавления точек. Нажмите её название, чтобы изменить тип покрытия. Замкнутые контуры участвуют в расчёте маршрута.</HelpHint></div>
        </div>
        <button type="button" onClick={onCreateSurfaceZone} className="shrink-0 rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-800">Новая зона</button>
      </div>
      <details open className="planner-disclosure">
        <summary className="disclosure-trigger flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-900">
          <span className="min-w-0 flex-1">Покрытия</span><span className="shrink-0 text-xs font-normal text-slate-500">{surfaceZoneList.length} шт.</span><span className="disclosure-hint text-xs font-normal text-sky-700">Раскрыть</span>
        </summary>
      <div className="mt-3 space-y-2">
        {surfaceZoneList.map((zone, index) => {
          const profile = SURFACE_PROFILE_OPTIONS.find((item) => item.key === zone.surfaceKey) || SURFACE_PROFILE_OPTIONS[0];
          const active = zone.id === activeSurfaceZoneId;
          const pointCount = zone.points?.length || 0;
          return (
            <div key={zone.id} className={`rounded-[16px] border p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] ${active ? "border-sky-300 bg-sky-50" : "border-sky-100 bg-white"}`}>
              <div className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-left">
                <label className="relative block cursor-pointer rounded-lg transition hover:bg-sky-50 focus-within:outline focus-within:outline-2 focus-within:outline-sky-500">
                <span className="flex items-start gap-2">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-stone-400" style={{ background: profile.fill }} />
                  <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-900">{index + 1}. {profile.label}</span>
                  <span aria-hidden="true" className="text-lg leading-none text-sky-700">⌄</span>
                </span>
                <span className="mt-1 block text-xs text-sky-700">Изменить тип</span>
                <select aria-label={`Тип покрытия зоны ${index + 1}`} value={zone.surfaceKey}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onFocus={() => onSelectSurfaceZone?.(zone.id)}
                  onChange={(event) => onSurfaceProfileChange?.(zone.id, event.target.value)}>
                  {SURFACE_PROFILE_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
                </label>
                <span className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Точек: {pointCount}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${zone.closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{zone.closed ? "Замкнута" : "Открыта"}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                <button type="button" onClick={() => onToggleSurfaceZoneClosed?.(zone.id)} disabled={!zone.closed && pointCount < 3} className={primaryButtonCls}>{zone.closed ? "Открыть" : "Замкнуть"}</button>
                <button type="button" onClick={() => onClearSurfaceZone?.(zone.id)} disabled={!pointCount} className={neutralButtonCls}>Очистить зону</button>
                <button type="button" onClick={() => onRemoveSurfaceZone?.(zone.id)} className={dangerButtonCls}>Удалить</button>
              </div>
              {!zone.closed && pointCount < 3 && <p className="mt-2 text-xs text-slate-500">Для замыкания нужно минимум 3 точки.</p>}
            </div>
          );
        })}
      </div>
      </details>
      <details className="mt-4 border-t border-stone-200 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-stone-700">Параметры покрытий</summary>
      <div className="mt-3 space-y-2 text-xs">
        {SURFACE_PROFILE_OPTIONS.map((profile) => {
          const runtime = describeSurfaceRuntime(profile, {
            speedMps: parseLooseInput(cruiseSpeedInput, cruiseSpeedMps),
            payloadKg: parseLooseInput(payloadInput, payloadKg),
          });
          return (
            <div key={profile.key} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border border-stone-400" style={{ background: profile.fill }} />
                <span className="font-semibold text-stone-800">{profile.label}</span>
              </div>
              <div className="mt-1 text-stone-600">
                скорость {runtime.requestedSpeedMps.toFixed(2)} м/с (лимит {runtime.surfaceMaxSpeedMps.toFixed(2)}, факт {runtime.effectiveSpeedMps.toFixed(2)})
              </div>
              <div className="text-stone-600">
                расход x{runtime.energyMultiplier.toFixed(2)} (база x{profile.energyPerMeter.toFixed(2)})
              </div>
            </div>
          );
        })}
      </div>
      </details>
    </div>
  );
}
