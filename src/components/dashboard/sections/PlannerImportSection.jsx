import HelpHint from "../HelpHint";
import { useRef } from "react";

const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-4";

export default function PlannerImportSection({ onImportFile,onExportCsv,hasPoints=false,editingLocked=false }) {
  const fileInputRef = useRef(null);
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await onImportFile?.(file);
    } catch (error) {
      console.error("Graph import failed", error);
      window.alert("Не удалось импортировать граф: проверьте JSON, Excel или CSV-файл.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className={cardCls}>
      <h3 className="text-sm font-semibold mb-3">Импорт графа <HelpHint label="Импорт графа">
        Загрузите JSON, Excel или CSV с точками, зарядками и ограничивающими зонами.
      </HelpHint></h3>
      <button disabled={editingLocked} onClick={() => fileInputRef.current?.click()}
        className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200">
        Загрузить граф
      </button>
      <button type="button" disabled={!hasPoints || !onExportCsv} onClick={onExportCsv} className="mt-2 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 disabled:opacity-40">Сохранить граф в CSV</button>
      <input ref={fileInputRef} type="file"
        accept=".json,.xlsx,.xls,.csv,application/json"
        onChange={handleFileChange} disabled={editingLocked} className="hidden" />
    </div>
  );
}
