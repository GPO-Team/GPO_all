import { createElement, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bot,
  ChevronDown,
  CircleDot,
  Download,
  Gauge,
  Layers3,
  Map,
  MapPin,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Save,
  Settings2,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wifi,
  Zap,
} from "lucide-react";

const routeTabs = [
  { key: "route", label: "Маршрут", icon: Route },
  { key: "algorithm", label: "Алгоритм", icon: SlidersHorizontal },
  { key: "energy", label: "Энергия", icon: BatteryCharging },
  { key: "surfaces", label: "Покрытия", icon: Layers3 },
];

const inspectorTabs = [
  { key: "zones", label: "Зоны", icon: Shield },
  { key: "points", label: "Точки", icon: MapPin },
  { key: "telemetry", label: "Телеметрия", icon: Activity },
  { key: "mapping", label: "Карта", icon: Map },
];

const metrics = [
  { label: "Длина", value: "18.42 м", tone: "text-slate-950" },
  { label: "Время", value: "48.6 c", tone: "text-teal-700" },
  { label: "Энергия", value: "72.4", tone: "text-amber-700" },
  { label: "Риск", value: "4.1%", tone: "text-rose-700" },
];

const points = [
  { id: "V1", type: "visit", title: "Сбор образца", x: "-2.40", y: "1.80", status: "готово" },
  { id: "V2", type: "visit", title: "Осмотр зоны", x: "0.95", y: "1.05", status: "ожидает" },
  { id: "V3", type: "visit", title: "Фотофиксация", x: "2.80", y: "-1.20", status: "ожидает" },
  { id: "C1", type: "charge", title: "Зарядная станция", x: "-3.10", y: "-2.25", status: "доступна" },
];

const zones = [
  { name: "Зона 1", points: 5, status: "Замкнута", color: "bg-sky-600" },
  { name: "Зона 2", points: 3, status: "Открыта", color: "bg-amber-500" },
  { name: "Периметр", points: 8, status: "Замкнута", color: "bg-teal-600" },
];

const surfaces = [
  { name: "Бетон", speed: "0.55 м/с", energy: "x1.00", color: "bg-stone-300" },
  { name: "Плитка", speed: "0.48 м/с", energy: "x1.14", color: "bg-cyan-300" },
  { name: "Порог", speed: "0.22 м/с", energy: "x1.62", color: "bg-amber-300" },
];

function IconButton({ label, children, tone = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border p-0 shadow-sm transition ${tone}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ label, active = true }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
        active
          ? "border-teal-200 bg-teal-50 text-teal-800"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-teal-500" : "bg-rose-500"}`} />
      {label}
    </span>
  );
}

function TabButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
      }`}
    >
      <Icon size={15} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function SectionTitle({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {createElement(Icon, { className: "shrink-0 text-slate-500", size: 17 })}
        <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RouteTab() {
  return (
    <div className="space-y-3">
      <SectionTitle
        icon={MapPin}
        title="Режим добавления"
        action={
          <IconButton label="Добавить точку" tone="border-teal-200 bg-teal-600 text-white hover:bg-teal-700">
            <Plus size={17} />
          </IconButton>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        {[
          ["visit", "Точка", "border-rose-200 bg-rose-50 text-rose-700"],
          ["charge", "Зарядка", "border-amber-200 bg-amber-50 text-amber-700"],
          ["limit", "Зона", "border-sky-200 bg-sky-50 text-sky-700"],
        ].map(([key, label, cls]) => (
          <button
            key={key}
            type="button"
            className={`h-16 rounded-md border px-2 text-sm font-semibold transition hover:brightness-95 ${cls}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-orange-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700">
          <Play size={16} />
          Построить
        </button>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
          <Radio size={16} />
          Отправить
        </button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Маршрут построен с учетом зарядки и безопасного обхода зон.
      </div>

      <div className="space-y-2">
        {points.slice(0, 3).map((point) => (
          <div key={point.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">
                {point.id} - {point.title}
              </div>
              <div className="text-xs text-slate-500">
                x {point.x}, y {point.y}
              </div>
            </div>
            <IconButton label="Удалить точку" tone="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlgorithmTab() {
  return (
    <div className="space-y-4">
      <SectionTitle icon={Settings2} title="Настройки алгоритма" />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Задача</span>
        <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm">
          Коммивояжер
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Алгоритм</span>
        <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm">
          GA + Tabu Search
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </label>
      {[
        ["Популяция", "120"],
        ["Поколения", "260"],
        ["Tabu tenure", "18"],
      ].map(([label, value]) => (
        <label key={label} className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            defaultValue={value}
          />
        </label>
      ))}
    </div>
  );
}

function EnergyTab() {
  return (
    <div className="space-y-4">
      <SectionTitle icon={BatteryCharging} title="Энергия и динамика" />
      {[
        ["Запас хода", "140", "ед."],
        ["Скорость", "0.42", "м/с"],
        ["Груз", "8.5", "кг"],
      ].map(([label, value, unit]) => (
        <label key={label} className="block">
          <span className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
            {label}
            <span>{unit}</span>
          </span>
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            defaultValue={value}
          />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {metrics.slice(1).map((metric) => (
          <div key={metric.label} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{metric.label}</div>
            <div className={`mt-1 text-lg font-bold ${metric.tone}`}>{metric.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SurfacesTab() {
  return (
    <div className="space-y-3">
      <SectionTitle icon={Layers3} title="Покрытия карты" />
      {surfaces.map((surface) => (
        <div key={surface.name} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm border border-slate-300 ${surface.color}`} />
            <span className="text-sm font-semibold text-slate-950">{surface.name}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <span>лимит {surface.speed}</span>
            <span>расход {surface.energy}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeftPanel({ activeTab, onTabChange }) {
  const content = {
    route: <RouteTab />,
    algorithm: <AlgorithmTab />,
    energy: <EnergyTab />,
    surfaces: <SurfacesTab />,
  }[activeTab];

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 2xl:w-[360px]">
      <div className="border-b border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {routeTabs.map((tab) => (
            <TabButton key={tab.key} item={tab} active={activeTab === tab.key} onClick={() => onTabChange(tab.key)} />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{content}</div>
    </aside>
  );
}

function MapPreview() {
  return (
    <main className="min-w-0 flex-1 bg-slate-100 p-3 2xl:p-4">
      <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-950">Рабочая карта маршрута</h1>
            <p className="truncate text-xs text-slate-500">Клик по карте добавляет выбранный тип объекта, перетаскивание меняет координаты</p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Свернуть левую панель">
              <PanelLeftClose size={17} />
            </IconButton>
            <IconButton label="Свернуть правую панель">
              <PanelRightClose size={17} />
            </IconButton>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-900">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.22) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="absolute inset-6 rounded-lg border border-slate-600/80 bg-slate-800/70" />
          <svg className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)]" viewBox="0 0 900 560" role="img" aria-label="Макет карты маршрута">
            <path d="M120 395 L250 320 L370 355 L520 230 L720 205 L795 120" fill="none" stroke="#0f766e" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M185 130 L330 105 L390 220 L248 258 Z" fill="rgba(14,165,233,0.22)" stroke="#0284c7" strokeWidth="4" strokeDasharray="14 12" />
            <path d="M565 340 L710 330 L760 438 L615 470 Z" fill="rgba(245,158,11,0.20)" stroke="#d97706" strokeWidth="4" strokeDasharray="14 12" />
            {[
              [120, 395, "V1", "#e11d48"],
              [370, 355, "V2", "#e11d48"],
              [720, 205, "V3", "#e11d48"],
              [250, 320, "C1", "#f59e0b"],
              [520, 230, "R", "#22c55e"],
            ].map(([x, y, label, color]) => (
              <g key={label}>
                <circle cx={x} cy={y} r="18" fill={color} stroke="#f8fafc" strokeWidth="4" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
                  {label}
                </text>
              </g>
            ))}
            {Array.from({ length: 42 }).map((_, index) => {
              const x = 80 + ((index * 73) % 760);
              const y = 75 + ((index * 47) % 410);
              return <rect key={index} x={x} y={y} width="9" height="9" rx="2" fill="rgba(34,211,238,0.42)" />;
            })}
          </svg>

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <StatusPill label="Маршрут свободен" />
            <StatusPill label="LiDAR active" />
            <StatusPill label="Native Solver" />
          </div>

          <div className="absolute bottom-14 left-4 right-4 grid grid-cols-4 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-md border border-white/10 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="text-xs text-slate-500">{metric.label}</div>
                <div className={`mt-1 text-lg font-bold ${metric.tone}`}>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function InspectorContent({ activeTab }) {
  if (activeTab === "zones") {
    return (
      <div className="space-y-3">
        <SectionTitle
          icon={Shield}
          title="Ограничивающие зоны"
          action={
            <IconButton label="Новая зона" tone="border-sky-200 bg-sky-600 text-white hover:bg-sky-700">
              <Plus size={17} />
            </IconButton>
          }
        />
        {zones.map((zone) => (
          <div key={zone.name} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-3 w-3 rounded-sm ${zone.color}`} />
                <span className="truncate text-sm font-semibold text-slate-950">{zone.name}</span>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{zone.status}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">{zone.points} точек контура</div>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "points") {
    return (
      <div className="space-y-3">
        <SectionTitle icon={CircleDot} title="Список объектов" />
        {points.map((point) => (
          <div key={point.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {point.id} - {point.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  x {point.x}, y {point.y}
                </div>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs ${point.type === "charge" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                {point.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "telemetry") {
    return (
      <div className="space-y-4">
        <SectionTitle icon={Activity} title="Телеметрия робота" />
        <div className="grid grid-cols-2 gap-2">
          {[
            ["x", "-0.42"],
            ["y", "1.18"],
            ["z", "0.04"],
            ["yaw", "1.57"],
            ["hits", "286"],
            ["cells", "143"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <StatusPill label="Telemetry WS connected" />
          <StatusPill label="Route WS connected" />
          <StatusPill label="Solver API connected" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle icon={Map} title="Обследование карты" />
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
        Постоянная карта препятствий строится из лидарных попаданий и отображается поверх сетки.
      </div>
      <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
        <RefreshCw size={16} />
        Запустить обследование
      </button>
      <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50">
        <Download size={16} />
        Сохранить PNG
      </button>
    </div>
  );
}

function RightPanel({ activeTab, onTabChange }) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white 2xl:w-[360px]">
      <div className="border-b border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {inspectorTabs.map((tab) => (
            <TabButton key={tab.key} item={tab} active={activeTab === tab.key} onClick={() => onTabChange(tab.key)} />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <InspectorContent activeTab={activeTab} />
      </div>
    </aside>
  );
}

export default function InterfacePreview() {
  const [routeTab, setRouteTab] = useState("route");
  const [inspectorTab, setInspectorTab] = useState("zones");
  const timestamp = useMemo(
    () => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    []
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
            <Bot size={19} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-950">GPO Robot Planner</div>
            <div className="truncate text-xs text-slate-500">Тестовый макет нового интерфейса, основной проект не затронут</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 xl:flex">
          <StatusPill label="Telemetry" />
          <StatusPill label="Route WS" />
          <StatusPill label="Solver" />
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
            обновлено {timestamp}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <IconButton label="Импорт графа">
            <Upload size={17} />
          </IconButton>
          <IconButton label="Сохранить проект">
            <Save size={17} />
          </IconButton>
          <IconButton label="Пересчитать" tone="border-orange-200 bg-orange-600 text-white hover:bg-orange-700">
            <Zap size={17} />
          </IconButton>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        <LeftPanel activeTab={routeTab} onTabChange={setRouteTab} />
        <MapPreview />
        <RightPanel activeTab={inspectorTab} onTabChange={setInspectorTab} />
      </div>

      <div className="fixed bottom-3 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg">
        <Gauge size={15} className="text-teal-700" />
        <span className="truncate">Готово к отправке: 3 точки, 1 зарядка, 2 активных контура.</span>
        <AlertTriangle size={15} className="text-amber-600" />
        <span className="hidden sm:inline">Проверка коллизий включена.</span>
        <Wifi size={15} className="text-teal-700" />
      </div>
    </div>
  );
}
