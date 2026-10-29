export default function SidebarCollapseRail({ side, onExpand, label }) {
  const isLeft = side === "left";
  const title = label || (isLeft ? "Открыть левое меню" : "Открыть правое меню");

  return (
    <div
      className="flex h-full w-10 min-w-10 flex-none items-start justify-center pt-3"
    >
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={onExpand}
        className="flex h-10 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 shadow-sm transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800"
      >
        <span className="text-lg leading-none" aria-hidden>
          {isLeft ? ">" : "<"}
        </span>
      </button>
    </div>
  );
}
