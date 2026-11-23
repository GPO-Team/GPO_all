import { Link } from "react-router-dom";

const cardCls =
  "rounded-3xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.08)]";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-stone-100 via-white to-sky-50 text-stone-900">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className={`${cardCls} p-8 sm:p-10`}>
          <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
            BNTS controller UI
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            Планировщик маршрута и отправка в контроллер
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-stone-600 sm:text-base">
            Откройте основное окно планировщика, добавьте точки, зоны и зарядки,
            постройте маршрут и отправьте его через WebSocket-мост.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-950"
            >
              Открыть планировщик
            </Link>
            <Link to="/warehouse" className="inline-flex h-11 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold !text-orange-800 transition hover:bg-orange-100">
              Склад и размещение
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={`${cardCls} p-5`}>
            <div className="text-xs font-semibold text-stone-900">1. Запуск</div>
            <div className="mt-2 text-sm text-stone-600">Откройте планировщик.</div>
          </div>
          <div className={`${cardCls} p-5`}>
            <div className="text-xs font-semibold text-stone-900">2. Планирование</div>
            <div className="mt-2 text-sm text-stone-600">Добавьте точки, зоны и зарядки на карте.</div>
          </div>
          <div className={`${cardCls} p-5`}>
            <div className="text-xs font-semibold text-stone-900">3. Отправка</div>
            <div className="mt-2 text-sm text-stone-600">Постройте маршрут и нажмите “Отправить маршрут”.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
