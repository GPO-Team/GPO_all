import { useState } from "react";
import { Button, Field } from "./ui";

export default function CargoPanel({
  cargo,
  tasks,
  selectedId,
  onSelect,
  pending,
  onRegister,
  onSuggest,
  suggestions,
  onPrepare,
}) {
  const [draft, setDraft] = useState({
    id: "",
    label: "",
    width: "0.3",
    depth: "0.3",
    height: "0.3",
    massKg: "5",
  });
  const change = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const activeCargo = new Set(
    tasks.filter((task) => task.status === "prepared").map((task) => task.cargoId),
  );
  const selected = cargo.find((item) => item.id === selectedId);
  return (
    <div className="space-y-5">
      <form
        aria-label="Регистрация груза"
        onSubmit={async (event) => {
          event.preventDefault();
          const success = await onRegister({
            ...draft,
            width: Number(draft.width),
            depth: Number(draft.depth),
            height: Number(draft.height),
            massKg: Number(draft.massKg),
          });
          if (success) setDraft((previous) => ({ ...previous, id: "", label: "" }));
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="ID груза"
              type="text"
              value={draft.id}
              onChange={(v) => change("id", v)}
              required
              maxLength={63}
              pattern="[A-Za-z0-9_-]{1,63}"
              title="От 1 до 63 латинских букв, цифр, знаков _ и -"
            />
            <Field
              label="Название груза"
              type="text"
              value={draft.label}
              onChange={(v) => change("label", v)}
              required
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["width", "Ширина, м"],
              ["depth", "Глубина груза, м"],
              ["height", "Высота, м"],
              ["massKg", "Масса, кг"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={draft[key]}
                min="0.001"
                onChange={(v) => change(key, v)}
                required
              />
            ))}
          </div>
          <Button primary type="submit">
            Зарегистрировать на приёмке
          </Button>
        </fieldset>
      </form>
      {cargo.length === 0 ? (
        <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
          Грузов пока нет. Зарегистрируйте коробку, чтобы подобрать свободную ячейку.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-stone-600">
            Груз на приёмке
            <select
              aria-label="Груз на приёмке"
              value={selectedId || ""}
              disabled={pending}
              onChange={(event) => onSelect(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Выберите груз</option>
              {cargo.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.label}
                  {activeCargo.has(item.id) ? " · резерв" : ""}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="text-xs text-stone-500">
              {selected.width} × {selected.depth} × {selected.height} м · {selected.massKg} кг ·
              Приёмка{activeCargo.has(selected.id) ? " · задача уже подготовлена" : ""}
            </p>
          )}
          <Button
            disabled={pending || !selected || activeCargo.has(selected.id)}
            onClick={onSuggest}
          >
            Подобрать ячейки
          </Button>
        </div>
      )}
      {suggestions && (
        <div className="border-t border-stone-200 pt-5">
          <h3 className="text-sm font-semibold">Подбор для {suggestions.cargoId}</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Проверяются габариты, зазоры и нагрузка. Без поворота коробки. Доступ робота не
            проверен.
          </p>
          {suggestions.suggestions.length === 0 && (
            <p className="mt-3 text-sm text-stone-500">Ячеек пока нет. Добавьте стеллаж.</p>
          )}
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {suggestions.suggestions.map((suggestion) => (
              <div
                key={suggestion.slotId}
                className={`rounded-xl border p-3 ${suggestion.eligible ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200 bg-stone-50"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-slate-800">{suggestion.address}</strong>
                  <span
                    className={`text-xs ${suggestion.eligible ? "text-emerald-700" : "text-stone-500"}`}
                  >
                    {suggestion.eligible ? "Подходит по размерам" : "Не подходит"}
                  </span>
                </div>
                {suggestion.reasons.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-stone-600">
                    {suggestion.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                )}
                {suggestion.eligible && (
                  <Button
                    className="mt-3 w-full"
                    disabled={pending || activeCargo.has(suggestions.cargoId)}
                    onClick={() => onPrepare(suggestion.slotId)}
                  >
                    Подготовить размещение
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
