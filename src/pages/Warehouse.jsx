import { Link } from "react-router-dom";
import WarehouseWorkspace from "@/features/warehouse/WarehouseWorkspace";

export default function Warehouse() {
  return (
    <div className="min-h-screen bg-stone-100 text-slate-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xl text-orange-700"
              aria-hidden="true"
            >
              ▦
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                BNTS / Warehouse
              </p>
              <h1 className="!text-xl font-bold !leading-tight tracking-tight sm:!text-2xl">
                Склад и размещение
              </h1>
            </div>
          </div>
          <nav aria-label="Основная навигация" className="flex gap-4 text-sm">
            <Link to="/" className="!text-stone-500 hover:!text-slate-900">
              Главная
            </Link>
            <Link to="/dashboard" className="!text-stone-500 hover:!text-slate-900">
              Планировщик →
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
              Адресное хранение
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
              Спланируйте стеллажи, зарегистрируйте груз и зарезервируйте подходящую ячейку.
            </p>
          </div>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800">
            Доступ робота не проверен
          </span>
        </div>
        <WarehouseWorkspace />
      </main>
    </div>
  );
}
