import HelpHint from "../HelpHint";
import {
  SURFACE_PROFILE_OPTIONS,
  describeSurfaceRuntime,
} from "../../../lib/energyModel";

const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-4";
const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";
const subtleButtonCls =
  "rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200 hover:border-stone-400";

const parseLooseInput = (rawValue, fallback) => {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function PlannerSurfaceZonesSection({
  activeSurfaceProfileKey,
  activeSurfaceZone,
  activeSurfaceZoneId,
  cruiseSpeedInput,
  cruiseSpeedMps,
  onActiveSurfaceProfileChange,
  onClearAllSurfaceZones,
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
      <h3 className="text-sm font-semibold mb-3">Покрытия карты</h3>
      <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
        <div className="font-semibold">Редактируемые зоны: {closedSurfaceCount} <HelpHint label="Покрытия карты">
          Раздел «Покрытия» сразу включает точки контура. Выберите тип покрытия и кликайте по карте.
        </HelpHint></div>
      </div>
      <label>
        <div className="text-xs text-stone-600 mb-1">Тип активного покрытия</div>
        <select className={inputCls} value={activeSurfaceProfileKey}
          onChange={(event) => onActiveSurfaceProfileChange?.(event.target.value)}>
          {SURFACE_PROFILE_OPTIONS.map((profile) => (
            <option key={profile.key} value={profile.key}>{profile.label}</option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <button onClick={onCreateSurfaceZone} className={subtleButtonCls}>Новая зона</button>
        <button onClick={() => activeSurfaceZone && onToggleSurfaceZoneClosed?.(activeSurfaceZone.id)}
          className={subtleButtonCls} disabled={!activeSurfaceZone}>
          {activeSurfaceZone?.closed ? "Открыть" : "Замкнуть"}
        </button>
        <button onClick={() => activeSurfaceZone && onClearSurfaceZone?.(activeSurfaceZone.id)}
          className={subtleButtonCls} disabled={!activeSurfaceZone?.points?.length}>Очистить зону</button>
        <button onClick={onClearAllSurfaceZones} className={subtleButtonCls}>Очистить все</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {surfaceZoneList.map((zone) => {
          const profile = SURFACE_PROFILE_OPTIONS.find((item) => item.key === zone.surfaceKey) || SURFACE_PROFILE_OPTIONS[0];
          const active = zone.id === activeSurfaceZoneId;
          return (
            <details key={zone.id} className={`planner-disclosure rounded-xl border px-3 py-2 ${active ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-stone-50"}`}>
              <summary onClick={() => onSelectSurfaceZone?.(zone.id)}
                className="disclosure-trigger flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left transition hover:border-teal-200 hover:bg-teal-50">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border border-stone-400" style={{ background: profile.fill }} />
                  <span className="font-semibold text-stone-800">{zone.name}</span>
                </span>
                <span className="text-stone-500">{zone.points?.length || 0} т.</span>
              </summary>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1 text-stone-600">
                <span>{profile.label}</span>
                <span className={zone.closed ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {zone.closed ? "замкнута" : "черновик"}
                </span>
              </div>
              {active && (
                <button type="button" onClick={() => onRemoveSurfaceZone?.(zone.id)}
                  className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                  Удалить покрытие
                </button>
              )}
            </details>
          );
        })}
      </div>
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
