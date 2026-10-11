import { useState } from "react";
import { getObstaclePositionLimits, OBSTACLE_LIMITS } from "../../../features/planner/model/runtimeObstacles";

const statusText = {
  sending: "Отправляем…",
  updating: "Применяем…",
  deleting: "Удаляем…",
  accepted: "Команда принята",
  error: "Ошибка отправки",
};

function ObstacleGeometryForm({ obstacle, onApply, busy }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(
    ["x", "y", "sizeX", "sizeY", "height"].map(key => [key, String(obstacle[key])])));
  const positionLimits = getObstaclePositionLimits({ sizeX: Number(draft.sizeX) || obstacle.sizeX, sizeY: Number(draft.sizeY) || obstacle.sizeY });
  const fields = [
    ["x", "Центр X, м", -positionLimits.x, positionLimits.x],
    ["y", "Центр Y, м", -positionLimits.y, positionLimits.y],
    ["sizeX", "Размер X, м", OBSTACLE_LIMITS.sizeX.min, OBSTACLE_LIMITS.sizeX.max],
    ["sizeY", "Размер Y, м", OBSTACLE_LIMITS.sizeY.min, OBSTACLE_LIMITS.sizeY.max],
    ["height", "Высота, м", OBSTACLE_LIMITS.height.min, OBSTACLE_LIMITS.height.max],
  ];
  return <form className="mt-3" onSubmit={(event) => { event.preventDefault(); onApply?.(obstacle.commandId, draft); }}>
    <div className="grid grid-cols-2 gap-2">
      {fields.map(([key, label, min, max]) => <label key={key} className="min-w-0 text-xs text-stone-700">
        {label}<input type="number" required step="any" min={min} max={max} disabled={busy}
          value={draft[key]} aria-label={label}
          onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))}
          className="mt-1 w-full min-w-0 rounded-lg border border-orange-200 bg-white px-2 py-2 text-sm tabular-nums text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-200" />
      </label>)}
    </div>
    <button type="submit" disabled={busy} className="mt-3 w-full rounded-lg bg-orange-700 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50">Применить изменения</button>
  </form>;
}

export default function PlannerRuntimeObstaclesSection({ obstacles = [], activeObstacleId, onSelect, onApply, onDelete }) {
  return <details className="planner-disclosure rounded-2xl border border-orange-200 bg-white p-3" open>
    <summary className="disclosure-trigger flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-stone-900">
      <span className="min-w-0 flex-1">Препятствия Webots</span>
      <span className="text-xs font-normal text-stone-500">{obstacles.length} шт.</span>
    </summary>
    <div className="mt-3 space-y-2">
      {!obstacles.length && <p className="text-sm text-stone-500">Добавленные препятствия появятся здесь.</p>}
      {obstacles.map((obstacle, index) => {
        const selected = activeObstacleId === obstacle.commandId;
        const busy = ["sending", "updating", "deleting"].includes(obstacle.status);
        const editable = obstacle.confirmed;
        return <div key={obstacle.commandId} className={`rounded-xl border p-3 ${selected ? "border-orange-400 bg-orange-50" : "border-orange-100 bg-orange-50/60"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm text-stone-900">Препятствие {index + 1}</b>
          <span className={`text-xs ${obstacle.status === "error" ? "text-rose-700" : "text-orange-800"}`}>{statusText[obstacle.status]}</span>
        </div>
        <div className="mt-2 space-y-1 text-sm tabular-nums text-stone-600">
          <div>Размер: <b>{obstacle.sizeX.toFixed(3)} × {obstacle.sizeY.toFixed(3)} м</b></div>
          <div>Высота: {obstacle.height.toFixed(3)} м</div>
          <div>Центр: X {obstacle.x.toFixed(2)} · Y {obstacle.y.toFixed(2)} м</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy || !editable} aria-pressed={selected}
            onClick={() => onSelect?.(selected ? null : obstacle.commandId)}
            className="flex-1 rounded-lg border border-orange-300 bg-white px-2 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50">{selected ? "Готово" : "Изменить"}</button>
          <button type="button" disabled={busy} onClick={() => onDelete?.(obstacle.commandId)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">{editable ? "Удалить" : "Убрать запись"}</button>
        </div>
        {selected && <>
          <p className="mt-3 text-xs leading-relaxed text-orange-900">Перетащите контур на карте. За квадрат в углу можно изменить размер. Или задайте значения ниже.</p>
          <ObstacleGeometryForm key={[obstacle.x, obstacle.y, obstacle.sizeX, obstacle.sizeY, obstacle.height].join(":")}
            obstacle={obstacle} onApply={onApply} busy={busy} />
        </>}
        {obstacle.error && <p role="alert" className="mt-2 break-words text-xs text-rose-700">{obstacle.error}</p>}
      </div>;
      })}
    </div>
  </details>;
}
