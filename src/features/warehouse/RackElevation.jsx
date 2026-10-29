import { useRef } from "react";

export default function RackElevation({ rack, slots, selectedSlotId, onSelect }) {
  const cellRefs = useRef(new Map());
  if (!rack)
    return (
      <p className="py-6 text-center text-sm text-stone-500">
        Выберите стеллаж на плане или создайте первый.
      </p>
    );
  const reserved = slots.filter((slot) => slot.reservedBy).length;
  const rows = rack.levels
    .map((level, index) => ({
      level,
      index,
      cells: slots.filter((slot) => slot.level === index + 1),
    }))
    .reverse();
  const firstCell = rows[0]?.cells[0];
  const tabStop = slots.find((slot) => slot.id === selectedSlotId)?.id || firstCell?.id;
  const navigate = (event, rowIndex, columnIndex) => {
    let row = rowIndex,
      column = columnIndex;
    switch (event.key) {
      case "ArrowLeft":
        column -= 1;
        break;
      case "ArrowRight":
        column += 1;
        break;
      case "ArrowUp":
        row -= 1;
        break;
      case "ArrowDown":
        row += 1;
        break;
      case "Home":
        column = 0;
        if (event.ctrlKey) row = 0;
        break;
      case "End":
        if (event.ctrlKey) row = rows.length - 1;
        column = rows[row].cells.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = rows[row]?.cells[column];
    if (target) cellRefs.current.get(target.id)?.focus();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-stone-100 px-3 py-1.5">{slots.length} ячеек</span>
        <span className="rounded-lg bg-orange-50 px-3 py-1.5 text-orange-800">
          {reserved} зарезервировано
        </span>
        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800">
          {slots.length - reserved} свободно
        </span>
      </div>
      <div className="space-y-3">
        {rows.map(({ level, index, cells }, rowIndex) => (
          <div key={index} className="flex items-stretch gap-3">
            <div className="w-20 shrink-0 pt-2 text-xs text-stone-500">
              <strong className="block text-slate-700">Уровень {index + 1}</strong>
              <span>{level.supportZ} м</span>
              <br />
              <span>до {level.maxLoadKg} кг/место</span>
            </div>
            <div
              className="grid min-w-0 flex-1 gap-1.5 border-b-4 border-slate-400 pb-1.5"
              style={{
                gridTemplateColumns: `repeat(${rack.bays * rack.placesPerBay}, minmax(96px, 1fr))`,
                overflowX: "auto",
              }}
            >
              {cells.map((slot, columnIndex) => (
                <button
                  key={slot.id}
                  ref={(node) => {
                    if (node) cellRefs.current.set(slot.id, node);
                    else cellRefs.current.delete(slot.id);
                  }}
                  type="button"
                  aria-label={`Ячейка ${slot.address}`}
                  aria-describedby={`warehouse-cell-status-${slot.id}`}
                  aria-pressed={selectedSlotId === slot.id}
                  tabIndex={slot.id === tabStop ? 0 : -1}
                  title={slot.address}
                  onFocus={() => onSelect(slot.id)}
                  onClick={() => onSelect(slot.id)}
                  onKeyDown={(event) => navigate(event, rowIndex, columnIndex)}
                  className={`min-h-16 rounded-lg border px-2 py-2 text-left text-[10px] transition ${slot.reservedBy ? "border-orange-200 bg-orange-50 text-orange-800" : "border-stone-200 bg-stone-50 text-stone-600"} ${selectedSlotId === slot.id ? "ring-2 ring-orange-500" : "hover:border-orange-400"}`}
                >
                  <strong className="block break-all text-xs">{slot.address}</strong>
                  <span id={`warehouse-cell-status-${slot.id}`}>
                    {slot.reservedBy ? "Резерв" : "Свободно"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Широкие уровни прокручиваются по горизонтали. Клавиатура: стрелки — соседняя ячейка,
        Home/End — край уровня.
      </p>
      <p className="mt-4 text-xs text-stone-500">
        Ширина места {(rack.bayWidth / rack.placesPerBay).toFixed(2)} м · глубина {rack.depth} м.
        Занятость отражает серверные резервы задач.
      </p>
    </div>
  );
}
