import { useState } from "react";

const POSES = [
  ["transport", "Транспорт"],
  ["pre_grasp", "Подвести"],
  ["grasp", "Захват"],
  ["lift", "Поднять"],
  ["place", "Поставить"],
  ["platform_pre_grasp", "Над платформой"],
  ["platform_grasp", "Захват с платформы"],
  ["platform_lift", "Подъём с платформы"],
];

export default function PlannerObjectTransferSection({ manipulator, objectTransfer, onSetPose, onStartTransfer, editingLocked = false }) {
  const [x, setX] = useState("3");
  const [y, setY] = useState("0");
  const submit = event => {
    event.preventDefault();
    if (editingLocked) return;
    const destination = { x: Number(x), y: Number(y) };
    if (Number.isFinite(destination.x) && Number.isFinite(destination.y))
      onStartTransfer?.(destination);
  };
  return (
    <section className="rounded-xl border border-orange-200 bg-orange-50 p-3">
      <div className="text-sm font-bold text-stone-900">Автоперенос объекта</div>
      <p className="mt-1 text-xs text-stone-600">Робот положит большую коробку на платформу, отвезёт её и выгрузит в указанной точке.</p>
      <div className="mt-3 rounded-lg border border-orange-200 bg-white p-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-stone-800">Проверка манипулятора</span>
          <span className={manipulator?.available ? "text-emerald-700" : "text-stone-500"}>
            {manipulator?.available ? `${manipulator.pose} · ${manipulator.state}` : "нет телеметрии"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {POSES.map(([pose, label]) => (
            <button
              className="rounded border border-stone-300 bg-stone-50 px-2 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!manipulator?.available || manipulator?.state === "moving" || objectTransfer?.status === "running"}
              key={pose}
              onClick={() => onSetPose?.(pose)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {Array.isArray(manipulator?.joints) ? (
          <div className="mt-2 font-mono text-[10px] text-stone-500">
            Суставы: {manipulator.joints.map(value => Number(value).toFixed(2)).join(" · ")}
          </div>
        ) : null}
      </div>
      <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={submit}>
        <label className="text-xs text-stone-600">X
          <input disabled={editingLocked} className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5" type="number" step="0.1" min="-22" max="22" value={x} onChange={event => setX(event.target.value)} />
        </label>
        <label className="text-xs text-stone-600">Y
          <input disabled={editingLocked} className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5" type="number" step="0.1" min="-17" max="17" value={y} onChange={event => setY(event.target.value)} />
        </label>
        <button disabled={editingLocked} className="col-span-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40" type="submit">Захватить и перенести</button>
      </form>
    </section>
  );
}
