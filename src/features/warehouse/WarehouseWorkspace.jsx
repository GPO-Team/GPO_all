import { useCallback, useEffect, useRef, useState } from "react";
import { warehouseApi } from "./api";
import { Button, Panel } from "./ui";
import RackEditor from "./RackEditor";
import { newRack, rackDraft } from "./rackModel";
import WarehousePlan from "./WarehousePlan";
import RackElevation from "./RackElevation";
import StationEditor from "./StationEditor";
import CargoPanel from "./CargoPanel";
import LayoutTransfer from "./LayoutTransfer";

export default function WarehouseWorkspace({ api = warehouseApi }) {
  const [snapshot, setSnapshot] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRackId, setSelectedRackId] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedCargoId, setSelectedCargoId] = useState("");
  const [draft, setDraft] = useState(null);
  const [draftBaseRack, setDraftBaseRack] = useState(null);
  const [placement, setPlacement] = useState(false);
  const [stationEditor, setStationEditor] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const busy = useRef(false);
  const taskRequests = useRef(new Map());
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const next = await api("");
      if (alive.current) {
        setSnapshot(next);
        setSuggestions(null);
      }
    } catch (failure) {
      if (alive.current) setError(failure.message || "Не удалось подключиться к складу");
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }, [api]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const mutate = async (path, payload = {}, revision = snapshot?.warehouse.revision) => {
    if (busy.current || !snapshot) return false;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const next = await api(path, { body: { ...payload, expectedRevision: revision } });
      if (alive.current) {
        setSnapshot(next);
        setSuggestions(null);
      }
      return next;
    } catch (failure) {
      let message = failure.message || "Изменения не сохранены";
      if (failure.status === 409) {
        try {
          const next = await api("");
          if (alive.current) {
            setSnapshot(next);
            setSuggestions(null);
          }
          message += ". Данные обновлены; проверьте изменения и повторите.";
        } catch {
          message += ". Не удалось обновить данные; нажмите «Обновить».";
        }
      }
      if (alive.current) setError(message);
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  };

  const suggest = async () => {
    if (busy.current || !selectedCargoId) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await api(`/suggestions?cargoId=${encodeURIComponent(selectedCargoId)}`);
      if (alive.current) setSuggestions({ ...result, cargoId: selectedCargoId });
    } catch (failure) {
      setError(failure.message);
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  };

  const prepare = async (destinationId) => {
    const cargoId = suggestions.cargoId;
    const key = `${cargoId}:${destinationId}`;
    if (!taskRequests.current.has(key)) taskRequests.current.set(key, crypto.randomUUID());
    const requestId = taskRequests.current.get(key);
    const success = await mutate(
      "/tasks",
      { id: requestId, cargoId, destinationId },
      suggestions.revision,
    );
    if (success) {
      taskRequests.current.delete(key);
      const task = success.warehouse.tasks.find((item) => item.id === requestId);
      setNotice(
        task?.status === "cancelled"
          ? "Эта задача уже отменена. Повторный запрос не восстанавливает её. Груз остаётся на приёмке."
          : "Задача подготовлена. Груз остаётся на приёмке. Команда роботу не отправлялась.",
      );
    }
  };

  const warehouse = snapshot?.warehouse;
  const selectedRack =
    warehouse?.racks.find((rack) => rack.id === selectedRackId) || warehouse?.racks[0];
  const selectedSlots = snapshot?.slots.filter((slot) => slot.rackId === selectedRack?.id) || [];
  const selectedSlot = selectedSlots.find((slot) => slot.id === selectedSlotId);
  const activeTasks = warehouse?.tasks.filter((task) => task.status === "prepared") || [];
  const locked = selectedSlots.some((slot) => slot.reservedBy);
  const editedRack = draft?.id ? warehouse?.racks.find((rack) => rack.id === draft.id) : null;
  const draftConflict = Boolean(draft?.id && JSON.stringify(editedRack) !== draftBaseRack);
  const editRack = (rack) => {
    setDraft(rackDraft(rack));
    setDraftBaseRack(JSON.stringify(rack));
    setPlacement(false);
  };
  const saveRack = async (rack) => {
    if (draftConflict) return;
    const next = await mutate(rack.id ? `/racks/${encodeURIComponent(rack.id)}` : "/racks", {
      rack,
    });
    if (!next) return;
    const saved = next.warehouse.racks.find((item) =>
      rack.id ? item.id === rack.id : item.code === rack.code.trim(),
    );
    setDraft(null);
    setDraftBaseRack(null);
    setPlacement(false);
    setSelectedRackId(saved?.id || null);
    setSelectedSlotId(null);
    setNotice("Стеллаж сохранён на сервере.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-500" : pending ? "animate-pulse bg-orange-400" : warehouse ? "bg-emerald-500" : "bg-stone-300"}`}
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {pending
                ? "Синхронизация…"
                : error
                  ? "Проверьте соединение / данные"
                  : warehouse
                    ? "Данные склада подключены"
                    : "Нет соединения"}
            </p>
            <p className="text-xs text-stone-500">
              {warehouse
                ? `Ревизия ${warehouse.revision} · сохранено на сервере`
                : "Ожидание сервиса склада"}
            </p>
          </div>
        </div>
        <Button disabled={pending} onClick={refresh}>
          Обновить
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}
      {!warehouse ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center text-sm text-stone-500">
          {pending
            ? "Загружаем планировку, грузы и задачи…"
            : "Данные недоступны. Убедитесь, что сервис маршрутов запущен, и обновите страницу склада."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Стеллажи", warehouse.racks.length],
              ["Ячейки", snapshot.slots.length],
              ["Грузы на приёмке", warehouse.cargo.length],
              ["Подготовленные задачи", activeTasks.length],
            ].map(([label, count]) => (
              <div key={label} className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
                <p className="text-xs text-stone-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{count}</p>
              </div>
            ))}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(350px,1fr)]">
            <div className="min-w-0 space-y-5">
              <Panel
                title="План склада"
                eyebrow="01 / Планировка"
                action={
                  <Button
                    primary
                    disabled={pending}
                    onClick={() => {
                      setDraft(newRack(warehouse.racks.map((rack) => rack.code)));
                      setDraftBaseRack(null);
                      setPlacement(false);
                    }}
                  >
                    Добавить стеллаж
                  </Button>
                }
              >
                {warehouse.racks.length === 0 && (
                  <div className="mb-5 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-4">
                    <h3 className="text-sm font-semibold text-orange-900">Склад пока пуст</h3>
                    <p className="mt-1 text-xs leading-relaxed text-orange-800">
                      Начните со стеллажа: задайте секции, места и уровни. Затем зарегистрируйте
                      груз и подготовьте размещение.
                    </p>
                  </div>
                )}
                <WarehousePlan
                  racks={warehouse.racks}
                  stations={warehouse.stations}
                  selectedId={selectedRack?.id}
                  onSelect={(id) => {
                    setSelectedRackId(id);
                    setSelectedSlotId(null);
                  }}
                  draft={draft}
                  placement={placement && !pending}
                  onPlace={(x, y) => {
                    setDraft((previous) => ({ ...previous, x: String(x), y: String(y) }));
                    setPlacement(false);
                  }}
                />
                {warehouse.racks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {warehouse.racks.map((rack) => (
                      <Button
                        key={rack.id}
                        disabled={pending}
                        aria-pressed={selectedRack?.id === rack.id}
                        onClick={() => setSelectedRackId(rack.id)}
                        className={
                          selectedRack?.id === rack.id ? "!border-orange-300 !bg-orange-50" : ""
                        }
                      >
                        {rack.code} · {rack.name}
                      </Button>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel
                title={
                  selectedRack ? `${selectedRack.code} · ${selectedRack.name}` : "Ячейки стеллажа"
                }
                eyebrow="02 / Вид спереди"
                action={
                  selectedRack && (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={pending || locked} onClick={() => editRack(selectedRack)}>
                        Редактировать
                      </Button>
                      <Button
                        disabled={pending || locked}
                        onClick={async () => {
                          if (
                            await mutate(`/racks/${encodeURIComponent(selectedRack.id)}/delete`)
                          ) {
                            if (draft?.id === selectedRack.id) setDraft(null);
                            setSelectedSlotId(null);
                          }
                        }}
                      >
                        Удалить стеллаж
                      </Button>
                    </div>
                  )
                }
              >
                <RackElevation
                  rack={selectedRack}
                  slots={selectedSlots}
                  selectedSlotId={selectedSlotId}
                  onSelect={setSelectedSlotId}
                />
                {locked && (
                  <p className="mt-3 text-xs text-orange-700">
                    Редактирование заблокировано: отмените задачи, резервирующие этот стеллаж.
                  </p>
                )}
                {selectedSlot && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                    <strong className="block text-sm text-slate-900">{selectedSlot.address}</strong>
                    Ширина {selectedSlot.width?.toFixed(2)} м · глубина {selectedSlot.depth} м ·
                    просвет {selectedSlot.clearHeight} м · до {selectedSlot.maxLoadKg} кг
                    <br />
                    Опора Z = {selectedSlot.supportZ} м ·{" "}
                    {selectedSlot.reservedBy ? "Зарезервировано" : "Свободно"}
                    <br />
                    Доступ робота не проверен
                  </div>
                )}
              </Panel>
              <Panel title="Задачи размещения" eyebrow="03 / Подготовка">
                <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs leading-relaxed text-orange-900">
                  Подготовка резервирует ячейку. Груз остаётся на приёмке. Задачи не запускают
                  робота и не подтверждают физическое перемещение.
                </div>
                {activeTasks.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    Активных задач пока нет. Подберите ячейку для зарегистрированного груза.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-stone-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <strong className="text-sm">{task.cargoId}</strong>
                            <p className="mt-1 text-sm text-stone-600">
                              Приёмка →{" "}
                              {snapshot.slots.find((slot) => slot.id === task.destinationId)
                                ?.address || task.destinationId}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-orange-700">
                              Подготовлена · ячейка в резерве
                            </p>
                          </div>
                          <Button
                            disabled={pending}
                            onClick={() => mutate(`/tasks/${encodeURIComponent(task.id)}/cancel`)}
                          >
                            Отменить задачу
                          </Button>
                        </div>
                        <p className="mt-2 break-all font-mono text-[10px] text-stone-400">
                          {task.id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {warehouse.tasks.some((task) => task.status === "cancelled") && (
                  <details className="mt-4 text-xs text-stone-500">
                    <summary className="cursor-pointer">
                      Отменённые задачи (
                      {warehouse.tasks.filter((task) => task.status === "cancelled").length})
                    </summary>
                    {warehouse.tasks
                      .filter((task) => task.status === "cancelled")
                      .map((task) => (
                        <p key={task.id} className="mt-2 break-all">
                          {task.cargoId} · отменена · {task.id}
                        </p>
                      ))}
                  </details>
                )}
              </Panel>
            </div>
            <div className="min-w-0 space-y-5">
              {draft && (
                <Panel
                  title={draft.id ? "Редактирование стеллажа" : "Новый стеллаж"}
                  eyebrow="Конструктор"
                >
                  <RackEditor
                    draft={draft}
                    setDraft={setDraft}
                    pending={pending}
                    placement={placement}
                    conflict={draftConflict}
                    canReload={Boolean(editedRack)}
                    onReload={() => editRack(editedRack)}
                    onPlacement={() => setPlacement(!placement)}
                    onSave={saveRack}
                    onClose={() => {
                      setDraft(null);
                      setDraftBaseRack(null);
                      setPlacement(false);
                    }}
                  />
                </Panel>
              )}
              <Panel title="Приёмка грузов" eyebrow="Грузы и подбор">
                <CargoPanel
                  cargo={warehouse.cargo}
                  tasks={warehouse.tasks}
                  selectedId={selectedCargoId}
                  onSelect={(id) => {
                    setSelectedCargoId(id);
                    setSuggestions(null);
                  }}
                  pending={pending}
                  onRegister={async (cargo) => {
                    const success = await mutate("/cargo", { cargo });
                    if (success) {
                      setSelectedCargoId(cargo.id);
                      setNotice(`Груз ${cargo.id} зарегистрирован на приёмке.`);
                    }
                    return success;
                  }}
                  onSuggest={suggest}
                  suggestions={suggestions}
                  onPrepare={prepare}
                />
              </Panel>
              <Panel
                title="Приёмка и отгрузка"
                eyebrow="Логические станции"
                action={
                  !stationEditor && (
                    <Button disabled={pending} onClick={() => setStationEditor(true)}>
                      Настроить
                    </Button>
                  )
                }
              >
                {stationEditor ? (
                  <StationEditor
                    stations={warehouse.stations}
                    pending={pending}
                    onClose={() => setStationEditor(false)}
                    onSave={async (stations) => {
                      if (await mutate("/stations", { stations })) setStationEditor(false);
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {warehouse.stations.map((station) => (
                      <div key={station.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-slate-700">{station.name}</span>
                        <span className="text-xs text-stone-500">
                          X {station.x} · Y {station.y} м
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="Файл планировки" eyebrow="Импорт / экспорт">
                <LayoutTransfer
                  warehouse={warehouse}
                  pending={pending}
                  onError={setError}
                  onImport={(layout) => mutate("/layout", { layout })}
                />
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
