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
import WarehouseTaskHistory from "./WarehouseTaskHistory";

const taskLabels = {
  prepared: "Подготовлена",
  launching: "Отправка ожидает подтверждения",
  executing: "Робот выполняет задачу",
  attention: "Требуется вмешательство",
};
const deliveryErrors = {
  vision_no_cargo: "Камера не обнаружила коробку.",
  vision_ambiguous: "Камера видит несколько коробок.",
  vision_unavailable: "Не удалось получить данные камеры.",
  vision_wrong_cargo: "Камера распознала другую коробку.",
  cargo_outside_receiving: "Коробка вне зоны приёмки.",
  cargo_outside_slot: "Коробка вне указанной ячейки.",
  invalid_shelf_support: "Опора в Webots не совпадает с ячейкой или отсутствует.",
  unsupported_destination: "Высота или опора ячейки недоступна роботу.",
  delivery_path_blocked: "Робот не может безопасно проехать или разместить груз.",
  delivery_unconfirmed: "Положение груза после выгрузки не подтверждено.",
  controller_restarted: "Контроллер перезапустился во время миссии.",
  holding_for_recovery: "Робот удерживает груз. Проверьте манипулятор.",
  unsafe_release: "Робот остановился и удерживает груз. Безопасная выгрузка пока недоступна.",
  cancelled: "Миссия остановлена.",
};

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

  const watchMission = snapshot && (snapshot.slots.some((slot) => slot.occupiedBy) ||
    snapshot.warehouse.tasks.some((task) => ["launching", "executing"].includes(task.status) ||
      task.missionStatus === "holding_for_recovery"));
  useEffect(() => {
    if (!watchMission) return;
    let stopped = false;
    let reading = false;
    const timer = setInterval(async () => {
      if (busy.current || reading) return;
      reading = true;
      try {
        const next = await api("");
        if (!stopped) setSnapshot((current) =>
          next.warehouse.revision > current.warehouse.revision ||
          (next.warehouse.revision === current.warehouse.revision &&
            next.verificationSession !== current.verificationSession) ? next : current);
      } catch {
        // Keep the last confirmed state and allow the next poll to recover.
      } finally {
        reading = false;
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [api, watchMission]);

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
      if (failure.status === 409 || path.endsWith("/start")) {
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

  const prepareTaskFor = async (cargoId, destinationId, revision) => {
    const key = `${cargoId}:${destinationId}`;
    if (!taskRequests.current.has(key)) taskRequests.current.set(key, crypto.randomUUID());
    const requestId = taskRequests.current.get(key);
    const success = await mutate(
      "/tasks",
      { id: requestId, cargoId, destinationId },
      revision,
    );
    if (success) {
      taskRequests.current.delete(key);
      const task = success.task || success.warehouse.tasks.find((item) => item.id === requestId);
      const notices = {
        cancelled: "Эта задача уже отменена. Повторный запрос не восстанавливает её. Груз остаётся на приёмке.",
        completed: "Груз уже доставлен в ячейку.",
        prepared: destinationId === "shipping" ? "Выдача подготовлена. Ячейка зарезервирована."
          : "Задача подготовлена. Груз остаётся на приёмке. Команда роботу не отправлялась.",
      };
      setNotice(notices[task?.status] || "Задача уже зарегистрирована. Состояние видно в списке задач.");
    }
  };

  const prepare = (destinationId) => prepareTaskFor(suggestions.cargoId, destinationId, suggestions.revision);
  const warehouse = snapshot?.warehouse;
  const selectedRack =
    warehouse?.racks.find((rack) => rack.id === selectedRackId) || warehouse?.racks[0];
  const selectedSlots = snapshot?.slots.filter((slot) => slot.rackId === selectedRack?.id) || [];
  const selectedSlot = selectedSlots.find((slot) => slot.id === selectedSlotId);
  const activeTasks = warehouse?.tasks.filter((task) => Object.hasOwn(taskLabels, task.status)) || [];
  const archiveCounts = snapshot?.archiveCounts;
  const unverifiedSlots = snapshot?.slots.filter((slot) => slot.needsVerification) || [];
  const verifyCargo = (slot, location) =>
    mutate(`/cargo/${encodeURIComponent(slot.occupiedBy)}/verify`, {
      location, controllerSession: snapshot.verificationSession,
    });
  const receivingCount = warehouse?.cargo.filter((cargo) => cargo.locationId === "receiving").length;
  const locked = selectedSlots.some((slot) => slot.reservedBy || slot.occupiedBy);
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
              ["Грузы на приёмке", receivingCount],
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
                    Редактирование заблокировано, пока у стеллажа есть резервы или размещённый груз.
                  </p>
                )}
                {selectedSlot && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                    <strong className="block text-sm text-slate-900">{selectedSlot.address}</strong>
                    Ширина {selectedSlot.width?.toFixed(2)} м · глубина {selectedSlot.depth} м ·
                    просвет {selectedSlot.clearHeight} м · до {selectedSlot.maxLoadKg} кг
                    <br />
                    Опора Z = {selectedSlot.supportZ} м ·{" "}
                    {selectedSlot.needsVerification ? "Место заблокировано до сверки" :
                      selectedSlot.occupiedBy ? `Груз ${selectedSlot.occupiedBy}` :
                        selectedSlot.reservedBy ? "Зарезервировано" : "Свободно"}
                    <br />
                    Доступ робота не проверен
                    {selectedSlot.occupiedBy && !selectedSlot.reservedBy && !selectedSlot.needsVerification && (
                      <Button
                        className="mt-2"
                        disabled={pending}
                        onClick={() => prepareTaskFor(selectedSlot.occupiedBy, "shipping", warehouse.revision)}
                      >
                        Подготовить выдачу
                      </Button>
                    )}
                  </div>
                )}
              </Panel>
              <Panel title="Задачи размещения">
                {unverifiedSlots.length > 0 && (
                  <section className="mb-4 space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <h3 className="text-sm font-semibold">Сверьте грузы со сценой Webots</h3>
                    <p className="text-xs">Проверьте фактическое положение каждой коробки. До сверки ячейки заблокированы.</p>
                    {unverifiedSlots.map((slot) => (
                      <div key={slot.id} className="space-y-2 text-sm">
                        <p>{slot.occupiedBy} · {slot.address}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={pending || !snapshot.verificationSession} onClick={() => verifyCargo(slot, "slot")}>
                            Груз в этой ячейке
                          </Button>
                          <Button disabled={pending || !snapshot.verificationSession} onClick={() => verifyCargo(slot, "receiving")}>
                            Груз на приёмке
                          </Button>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
                <p className="mb-4 text-xs text-stone-600">
                  Для приёмки расположите коробку в поле зрения камеры в пределах 25 см от точки приёмки.
                  Для выдачи выберите занятую ячейку.
                </p>
                {activeTasks.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    Активных задач пока нет. Подберите ячейку для зарегистрированного груза.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeTasks.map((task) => {
                      const outgoing = task.destinationId === "shipping";
                      const slot = snapshot.slots.find((item) => item.id === (outgoing ? task.sourceId : task.destinationId));
                      const cargo = warehouse.cargo.find((item) => item.id === task.cargoId);
                      const supported = cargo?.objectDef && slot &&
                        (slot.supportZ === 0 || (slot.supportZ >= .06 && slot.supportZ <= .18 && slot.supportDef)) &&
                        cargo.width <= .05 && cargo.depth <= .05 && cargo.height >= .03 &&
                        cargo.height <= .12 && Math.hypot(.05, .05) < Math.min(slot.width, slot.depth);
                      const anotherMission = activeTasks.some((item) => item.id !== task.id && item.missionId);
                      const canStop = task.status === "executing" || task.missionStatus === "holding_for_recovery";
                      const canReturn = task.status === "attention" &&
                        ["failed", "cancelled", "completed"].includes(task.missionStatus);
                      const taskPath = `/tasks/${encodeURIComponent(task.id)}`;
                      return (
                        <div key={task.id} className="rounded-xl border border-stone-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <strong className="text-sm">{task.cargoId}</strong>
                              <p className="mt-1 text-sm text-stone-600">
                                {outgoing ? `${slot?.address || task.sourceId} → Отгрузка`
                                  : `Приёмка → ${slot?.address || task.destinationId}`}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-orange-700">
                                {taskLabels[task.status]} · ячейка в резерве
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {supported && ["prepared", "launching"].includes(task.status) && (
                                <Button primary disabled={pending || anotherMission || unverifiedSlots.length > 0} onClick={() => mutate(`${taskPath}/start`)}>
                                  {task.status === "launching" ? "Повторить отправку" : "Запустить робота"}
                                </Button>
                              )}
                              {task.status === "prepared" && (
                                <Button disabled={pending} onClick={() => mutate(`${taskPath}/cancel`)}>
                                  Отменить задачу
                                </Button>
                              )}
                              {canStop && (
                                <Button disabled={pending || task.missionStatus === "cancelling"} onClick={() => mutate(`${taskPath}/stop`)}>
                                  {task.missionStatus === "cancelling" ? "Остановка запрошена" : "Остановить робота"}
                                </Button>
                              )}
                              {canReturn && (
                                <Button disabled={pending} onClick={() => mutate(`${taskPath}/cancel`, {confirmReturned: true})}>
                                  {outgoing ? "Подтвердить возврат груза в ячейку" : "Подтвердить возврат груза на приёмку"}
                                </Button>
                              )}
                            </div>
                          </div>
                          {task.status === "prepared" && !supported && (
                            <p className="mt-2 text-xs text-stone-500">Для запуска нужны DEF, коробка до 5 × 5 см высотой 3–12 см и доступная ячейка. Для полки укажите DEF опоры Webots.</p>
                          )}
                          {task.failureReason && (
                            <p className="mt-2 text-xs text-red-700">{deliveryErrors[task.failureReason] || task.failureReason}</p>
                          )}
                          {task.missionId && <p className="mt-2 break-all text-xs text-stone-500">Миссия {task.missionId}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <WarehouseTaskHistory
                  api={api} status="completed" label="Доставленные грузы"
                  count={archiveCounts?.completed} fallback={warehouse.tasks} slots={snapshot.slots}
                />
                <WarehouseTaskHistory
                  api={api} status="cancelled" label="Отменённые задачи"
                  count={archiveCounts?.cancelled} fallback={warehouse.tasks} slots={snapshot.slots}
                />
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
