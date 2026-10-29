import { useState } from "react";
import { Button } from "./ui";
import { validateLayout } from "./api";

export default function LayoutTransfer({ warehouse, pending, onImport, onError }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const layout = { schemaVersion: 1, racks: warehouse.racks, stations: warehouse.stations };
  const exportLayout = () => {
    const json = JSON.stringify(layout, null, 2);
    setText(json);
    setOpen(true);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "warehouse-layout.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importLayout = async () => {
    try {
      const imported = validateLayout(text);
      if (await onImport(imported)) setOpen(false);
    } catch (error) {
      onError(error.message);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={exportLayout}>
          Экспорт JSON
        </Button>
        <Button disabled={pending} onClick={() => setOpen(!open)}>
          Импорт JSON
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-stone-500">
        Планировка содержит стеллажи и станции. Грузы и задачи хранятся на сервере и не входят в
        экспорт. Импорт заменяет планировку; при активных резервах он недоступен.
      </p>
      {open && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-stone-600">
            Открыть файл JSON
            <input
              type="file"
              accept=".json,application/json"
              disabled={pending}
              className="mt-1 block w-full text-xs"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) {
                  onError("Файл слишком большой: максимум 1 МБ");
                  return;
                }
                try {
                  setText(await file.text());
                } catch {
                  onError("Не удалось прочитать файл");
                }
              }}
            />
          </label>
          <label className="block text-xs text-stone-600">
            JSON планировки
            <textarea
              aria-label="JSON планировки"
              value={text}
              disabled={pending}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              className="mt-1 w-full rounded-xl border border-stone-300 p-3 font-mono text-xs text-slate-900"
              placeholder={'{"schemaVersion":1,"racks":[],"stations":[]}'}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              primary
              disabled={
                pending ||
                !text.trim() ||
                warehouse.tasks.some((task) => task.status === "prepared")
              }
              onClick={importLayout}
            >
              Заменить планировку
            </Button>
            <Button disabled={pending} onClick={() => setOpen(false)}>
              Закрыть импорт
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
