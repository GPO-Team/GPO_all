const statusText = {
  sending: "Отправляем…",
  accepted: "Команда принята",
  error: "Ошибка отправки",
};

export default function PlannerRuntimeObstaclesSection({ obstacles = [] }) {
  return <details className="planner-disclosure rounded-2xl border border-orange-200 bg-white p-3" open>
    <summary className="disclosure-trigger flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-stone-900">
      <span className="min-w-0 flex-1">Препятствия Webots</span>
      <span className="text-xs font-normal text-stone-500">{obstacles.length} шт.</span>
    </summary>
    <div className="mt-3 space-y-2">
      {!obstacles.length && <p className="text-sm text-stone-500">Добавленные препятствия появятся здесь.</p>}
      {obstacles.map((obstacle, index) => <div key={obstacle.commandId} className="rounded-xl border border-orange-100 bg-orange-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm text-stone-900">Препятствие {index + 1}</b>
          <span className={`text-xs ${obstacle.status === "error" ? "text-rose-700" : "text-orange-800"}`}>{statusText[obstacle.status]}</span>
        </div>
        <div className="mt-2 space-y-1 text-sm tabular-nums text-stone-600">
          <div>Размер: <b>{obstacle.sizeX.toFixed(3)} × {obstacle.sizeY.toFixed(3)} м</b></div>
          <div>Высота: {obstacle.height.toFixed(3)} м</div>
          <div>Центр: X {obstacle.x.toFixed(2)} · Y {obstacle.y.toFixed(2)} м</div>
        </div>
        {obstacle.error && <p role="alert" className="mt-2 break-words text-xs text-rose-700">{obstacle.error}</p>}
      </div>)}
    </div>
  </details>;
}
