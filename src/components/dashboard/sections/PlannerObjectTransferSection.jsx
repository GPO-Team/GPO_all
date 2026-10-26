import { useState } from "react";

export default function PlannerObjectTransferSection({ onStartTransfer }) {
  const [x, setX] = useState("3");
  const [y, setY] = useState("0");
  const submit = event => {
    event.preventDefault();
    const destination = { x: Number(x), y: Number(y) };
    if (Number.isFinite(destination.x) && Number.isFinite(destination.y))
      onStartTransfer?.(destination);
  };
  return (
    <section className="rounded-xl border border-orange-200 bg-orange-50 p-3">
      <div className="text-sm font-bold text-stone-900">Автоперенос объекта</div>
      <p className="mt-1 text-xs text-stone-600">Робот подъедет к demo-box, захватит его и отвезёт в указанную точку.</p>
      <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={submit}>
        <label className="text-xs text-stone-600">X
          <input className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5" type="number" step="0.1" min="-22" max="22" value={x} onChange={event => setX(event.target.value)} />
        </label>
        <label className="text-xs text-stone-600">Y
          <input className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5" type="number" step="0.1" min="-17" max="17" value={y} onChange={event => setY(event.target.value)} />
        </label>
        <button className="col-span-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700" type="submit">Захватить и перенести</button>
      </form>
    </section>
  );
}
