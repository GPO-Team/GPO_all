import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export default function WarehouseTaskHistory({ api, status, label, count, fallback, slots }) {
  const [page, setPage] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);

  const legacyTasks = count === undefined ? fallback.filter((task) => task.status === status) : null;
  const total = legacyTasks?.length ?? count;
  if (!total) return null;

  const load = async (before = null) => {
    const id = ++request.current;
    setPending(true);
    setError("");
    try {
      const query = new URLSearchParams({ status });
      if (before !== null) query.set("before", before);
      const next = await api(`/history?${query}`);
      if (request.current === id) {
        setPage((previous) => ({
          tasks: before === null ? next.tasks : previous.tasks.concat(next.tasks),
          nextCursor: next.nextCursor,
        }));
      }
    } catch (failure) {
      if (request.current === id) setError(failure.message || "Не удалось загрузить историю.");
    } finally {
      if (request.current === id) setPending(false);
    }
  };

  return (
    <details className="mt-4 text-xs text-stone-500" onToggle={(event) => {
      if (legacyTasks) return;
      if (event.currentTarget.open) {
        void load();
      } else {
        request.current += 1;
        setPage(null);
        setError("");
        setPending(false);
      }
    }}>
      <summary className="cursor-pointer">{label} ({total})</summary>
      {(legacyTasks ?? page?.tasks ?? []).map((task) => (
        <p key={task.id} className="mt-2 break-all">
          {task.cargoId} · {status === "completed"
            ? slots.find((slot) => slot.id === task.destinationId)?.address || task.destinationId
            : `отменена · ${task.id}`}
        </p>
      ))}
      {pending && <p role="status" className="mt-2">Загрузка истории…</p>}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {(error || page?.nextCursor != null) && (
        <Button className="mt-2" disabled={pending} onClick={() => load(page?.nextCursor ?? null)}>
          {error ? "Повторить загрузку" : "Показать ещё"}
        </Button>
      )}
    </details>
  );
}
