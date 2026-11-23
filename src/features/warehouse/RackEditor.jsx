import { useEffect, useRef } from "react";
import { Button, Field } from "./ui";
import { rackPayload } from "./rackModel";

export default function RackEditor({
  draft,
  setDraft,
  pending,
  placement,
  onPlacement,
  onSave,
  onClose,
  conflict,
  canReload,
  onReload,
}) {
  const formRef = useRef(null);
  useEffect(() => {
    if (!placement) formRef.current?.scrollIntoView?.({ block: "start" });
  }, [placement]);
  const change = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const levelChange = (index, key, value) =>
    setDraft((previous) => ({
      ...previous,
      levels: previous.levels.map((level, i) => (i === index ? { ...level, [key]: value } : level)),
    }));
  return (
    <form
      ref={formRef}
      aria-label="Редактор стеллажа"
      onSubmit={(event) => {
        event.preventDefault();
        if (!conflict) return onSave(rackPayload(draft));
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        {conflict && (
          <div
            role="alert"
            className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"
          >
            <p>
              Стеллаж изменён в другой вкладке или удалён. Черновик сохранён здесь; запись поверх
              новых данных заблокирована.
            </p>
            {canReload && (
              <Button className="mt-3" onClick={onReload}>
                Загрузить актуальный стеллаж
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Код стеллажа"
            type="text"
            value={draft.code}
            onChange={(v) => change("code", v)}
            required
            maxLength={24}
          />
          <Field
            label="Название стеллажа"
            type="text"
            value={draft.name}
            onChange={(v) => change("name", v)}
            required
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["x", "X, м"],
            ["y", "Y, м"],
            ["yaw", "Угол, °"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={draft[key]}
              onChange={(v) => change(key, v)}
              required
            />
          ))}
        </div>
        <Button onClick={onPlacement} aria-pressed={placement} className="w-full">
          {placement ? "Отменить выбор на плане" : "Указать центр на плане"}
        </Button>
        {placement && (
          <p role="status" className="text-xs text-orange-700">
            Нажмите на свободное место плана. Изменения сохранятся только после нажатия «Сохранить
            стеллаж».
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            ["bays", "Секции", 1],
            ["placesPerBay", "Мест в секции", 1],
            ["bayWidth", "Ширина секции, м", 0.01],
            ["depth", "Глубина, м", 0.01],
          ].map(([key, label, min]) => (
            <Field
              key={key}
              label={label}
              value={draft[key]}
              min={min}
              step={key === "bays" || key === "placesPerBay" ? "1" : "any"}
              onChange={(v) => change(key, v)}
              required
            />
          ))}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Уровни хранения</h3>
            <span className="text-xs text-stone-500">снизу вверх</span>
          </div>
          <div className="space-y-3">
            {draft.levels.map((level, index) => (
              <div key={index} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-500">Уровень {index + 1}</span>
                  <button
                    type="button"
                    disabled={draft.levels.length === 1}
                    className="text-xs text-stone-500 underline disabled:opacity-30"
                    onClick={() =>
                      setDraft((previous) => ({
                        ...previous,
                        levels: previous.levels.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Удалить уровень
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["supportZ", "опора, м", 0],
                    ["clearHeight", "просвет, м", 0.01],
                    ["maxLoadKg", "на ячейку, кг", 0.01],
                  ].map(([key, label, min]) => (
                    <Field
                      key={key}
                      label={`Уровень ${index + 1}: ${label}`}
                      value={level[key]}
                      min={min}
                      onChange={(v) => levelChange(index, key, v)}
                      required
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button
            className="mt-3 w-full"
            disabled={draft.levels.length >= 12}
            onClick={() =>
              setDraft((previous) => {
                const last = previous.levels.at(-1);
                return {
                  ...previous,
                  levels: [
                    ...previous.levels,
                    {
                      supportZ: String(Number(last.supportZ) + Number(last.clearHeight) + 0.2),
                      clearHeight: "0.7",
                      maxLoadKg: "50",
                    },
                  ],
                };
              })
            }
          >
            Добавить уровень
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-stone-500">
          Размеры — в метрах. Нагрузка задана на одну ячейку. Угол положителен против часовой
          стрелки. Высоты и нагрузка описывают стеллаж; доступ робота требует отдельной проверки.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button primary type="submit" disabled={conflict}>
            Сохранить стеллаж
          </Button>
          <Button onClick={onClose}>Закрыть редактор</Button>
        </div>
      </fieldset>
    </form>
  );
}
