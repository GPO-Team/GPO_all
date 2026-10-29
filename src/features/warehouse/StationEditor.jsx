import { useState } from "react";
import { Button, Field } from "./ui";

export default function StationEditor({ stations, pending, onSave, onClose }) {
  const [draft, setDraft] = useState(() => stations.map((station) => ({ ...station })));
  const [base, setBase] = useState(() => JSON.stringify(stations));
  const conflict = base !== JSON.stringify(stations);
  const reload = () => {
    setDraft(stations.map((station) => ({ ...station })));
    setBase(JSON.stringify(stations));
  };
  const update = (index, key, value) =>
    setDraft((previous) =>
      previous.map((station, i) => (i === index ? { ...station, [key]: value } : station)),
    );
  return (
    <form
      aria-label="Настройки станций"
      onSubmit={(event) => {
        event.preventDefault();
        if (!conflict)
          return onSave(
            draft.map((station) => ({ ...station, x: Number(station.x), y: Number(station.y) })),
          );
      }}
    >
      <fieldset disabled={pending} className="space-y-4">
        {conflict && (
          <div
            role="alert"
            className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"
          >
            <p>
              Настройки станций изменены в другой вкладке. Черновик сохранён; загрузите актуальные
              данные перед сохранением.
            </p>
            <Button className="mt-3" onClick={reload}>
              Загрузить актуальные станции
            </Button>
          </div>
        )}
        {draft.map((station, index) => (
          <div key={station.id} className="space-y-3 rounded-xl bg-stone-50 p-3">
            <h3 className="text-sm font-semibold">
              {station.id === "receiving" ? "Приёмка" : "Отгрузка"}
            </h3>
            <Field
              label={station.id === "receiving" ? "Название приёмки" : "Название выдачи"}
              type="text"
              value={station.name}
              onChange={(v) => update(index, "name", v)}
              required
              maxLength={120}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={station.id === "receiving" ? "Приёмка: X, м" : "Выдача: X, м"}
                value={station.x}
                onChange={(v) => update(index, "x", v)}
                required
              />
              <Field
                label={station.id === "receiving" ? "Приёмка: Y, м" : "Выдача: Y, м"}
                value={station.y}
                onChange={(v) => update(index, "y", v)}
                required
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-stone-500">
          Станции — логические зоны. Эти координаты не задают измеренную позу груза.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button primary type="submit" disabled={conflict}>
            Сохранить станции
          </Button>
          <Button onClick={onClose}>Закрыть настройки</Button>
        </div>
      </fieldset>
    </form>
  );
}
