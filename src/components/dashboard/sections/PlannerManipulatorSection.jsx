import { useState } from "react";

const stages = {
  idle: "Ожидание", opening: "Раскрытие захвата", approaching: "Подход к объекту",
  descending: "Опускание руки", closing: "Захват", lifting: "Подъём",
  transferring: "Перенос", lowering: "Размещение", releasing: "Освобождение",
  retracting: "Отвод руки", completed: "Перенос завершён", failed: "Ошибка", cancelled: "Остановлено",
  stowing: "Рука возвращается в транспортное положение",
  driving_to_object: "База подъезжает к объекту", carrying: "База перевозит груз",
};
const errors = {
  object_missing: "Объект не найден в мире Webots.",
  source_unreachable: "Сам объект находится вне досягаемости руки. Подъезд базы не решает ограничение по высоте или доступу к захвату.",
  source_approach_unreachable: "Положение руки над объектом для подхода и подъёма недостижимо. Измените положение базы относительно объекта.",
  target_unreachable: "Точка назначения недостижима даже после подъезда базы. Проверьте высоту центра объекта и место размещения.",
  delivery_path_blocked: "Нет свободного пути для базы с грузом. Освободите путь или выберите другое место размещения.",
  delivery_timeout: "База не достигла точки за отведённое время. Робот остановлен, захват сохранён.",
  target_approach_unreachable: "Положение руки над точкой назначения недостижимо. Выберите другую точку назначения или положение базы.",
  devices_unavailable: "Моторы или датчики руки недоступны.", stage_timeout: "Рука не достигла положения за отведённое время.",
  empty_grasp: "Пальцы закрылись без объекта.", object_lost: "Объект потерян при переносе.", invalid_sensor: "Нет корректных показаний датчиков.",
  object_moved: "Объект сместился во время подхода. Повторите захват из новой позиции.",
  placement_failed: "Объект сместился после размещения. Перенос не завершён успешно.",
};
const inputClass = "w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm";

export default function PlannerManipulatorSection({ telemetry, connected, mission, onStart, onCancel }) {
  const [objectDef, setObjectDef] = useState("PICK_BOX");
  const [destination, setDestination] = useState({ x: "0.4", y: "0.1", z: "0.04" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const observedArm = telemetry?.manipulator;
  const arm = mission?.missionId && observedArm?.missionId !== mission.missionId ? null : observedArm;
  const busy = Boolean(observedArm?.active || (mission?.status && !["completed", "failed", "cancelled"].includes(mission.status)));
  const reportedError = error || arm?.error || (mission?.status === "failed" ? mission.failureReason : "") || "";
  const objectPosition = connected && observedArm?.objectDef === objectDef && observedArm.objectPosition &&
    ["x", "y", "z"].every(axis => Number.isFinite(observedArm.objectPosition[axis])) ? observedArm.objectPosition : null;
  const submit = async event => {
    event.preventDefault();
    if (sending || busy || !connected) return;
    const target = Object.fromEntries(Object.entries(destination).map(([key, value]) => [key, Number(value)]));
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(objectDef) ||
        Object.values(destination).some(value => !value.trim()) || Object.values(target).some(value => !Number.isFinite(value)) ||
        Math.abs(target.x) > 22 || Math.abs(target.y) > 17 || target.z < 0.015 || target.z > 1) {
      setError("Укажите имя объекта и допустимые координаты в метрах (Z: 0.015–1)."); return;
    }
    setError(""); setSending(true);
    try { await onStart?.({ objectDef, destination: target }); }
    catch (failure) { setError(failure.message); }
    finally { setSending(false); }
  };
  return (
    <section className="rounded-[18px] border border-sky-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Манипулятор</h3>
      <p className="mb-3 text-xs text-stone-600">Автоматическая доставка небольших объектов: база подъезжает, рука захватывает груз, робот перевозит и размещает его. Цель — координаты центра объекта в мире, в метрах.</p>
      <p className="mb-3 text-xs text-stone-600">Введите абсолютные координаты назначения, не смещение объекта. Например, X=1 и Y=1 — точка в метре по каждой оси, а не перемещение на сантиметр.</p>
      {objectPosition && <p className="mb-3 text-xs text-stone-600">Текущее положение {objectDef}: { ["x", "y", "z"].map(axis => `${axis.toUpperCase()}=${objectPosition[axis].toFixed(3)}`).join(", ") } м.</p>}
      <form onSubmit={submit}>
        <fieldset disabled={sending || busy} className="space-y-2">
          <label className="block text-xs">Объект (имя DEF в Webots)
            <input className={inputClass} value={objectDef} onChange={event => { setObjectDef(event.target.value); setError(""); }} required />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {["x", "y", "z"].map(axis => (
              <label key={axis} className="text-xs">{axis.toUpperCase()} (м)
                <input className={inputClass} type="number" step="0.005" value={destination[axis]}
                  onChange={event => { setDestination(previous => ({ ...previous, [axis]: event.target.value })); setError(""); }} required />
              </label>
            ))}
          </div>
          <button type="submit" disabled={!connected || !onStart}
            className="w-full rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {sending ? "Отправка…" : "Взять и перенести"}
          </button>
        </fieldset>
      </form>
      <div className="mt-3 text-xs text-stone-700" role="status">{connected ? stages[arm?.stage] || "Ожидание" : "Нет свежей телеметрии или связи с bridge"}</div>
      {reportedError && <p role="alert" className="mt-2 text-xs text-red-700">{Object.hasOwn(errors, reportedError) ? errors[reportedError] : reportedError}</p>}
      {busy && <button type="button" onClick={onCancel} disabled={!onCancel || sending || mission?.status === "cancelling"}
        className="mt-2 w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-40">{mission?.status === "cancelling" ? "Ожидаем остановки…" : "Остановить миссию"}</button>}
    </section>
  );
}
