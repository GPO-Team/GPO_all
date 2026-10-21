import { useEffect, useState } from "react";
import PlannerCanvas from "../../components/dashboard/PlannerCanvas";
import PlannerLeftSidebar from "../../components/dashboard/PlannerLeftSidebar";
import PlannerRightSidebar from "../../components/dashboard/PlannerRightSidebar";
import PlannerSimulationSection from "../../components/dashboard/sections/PlannerSimulationSection";

export default function DashboardPlannerWorkspace({
  canvasProps,
  leftSidebarProps,
  plannerUiState,
  rightSidebarProps,
  setSidebarCollapsed,
}) {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 1199px)").matches,
  );
  const [view, setView] = useState("map");
  const [simulationOpened, setSimulationOpened] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1199px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const leftOpen = !plannerUiState.leftCollapsed;
  const rightOpen = !plannerUiState.rightCollapsed && !(compact && leftOpen);
  const toggle = (side, open) => {
    if (compact && !open)
      setSidebarCollapsed(
        side === "leftCollapsed" ? "rightCollapsed" : "leftCollapsed",
        true,
      );
    setSidebarCollapsed(side, open);
  };
  return (
    <div className="planner-workspace flex overflow-hidden bg-slate-100 text-slate-900">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          hidden={!leftOpen}
          id="planner-left-panel"
          className="workspace-panel workspace-panel-left"
        >
          <PlannerLeftSidebar
            {...leftSidebarProps}
            onCollapse={() => setSidebarCollapsed("leftCollapsed", true)}
          />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav
            className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2"
            aria-label="Рабочее окно"
          >
            {!leftOpen && (
              <button
                type="button"
                onClick={() => toggle("leftCollapsed", false)}
                aria-controls="planner-left-panel"
                aria-expanded={false}
                className="planner-panel-open"
              >
                Планировщик
                <span aria-hidden>{">"}</span>
              </button>
            )}
            <button
              type="button"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Карта и точки
            </button>
            <button
              type="button"
              aria-pressed={view === "simulation"}
              onClick={() => {
                setSimulationOpened(true);
                setView("simulation");
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Симуляция · крупный вид
            </button>
            <div className="ml-auto flex items-center gap-3">
              {canvasProps.editingLocked && !canvasProps.isOptimizing && (
                <span role="status" className="text-xs text-amber-800">
                  Граф заблокирован на время миссии
                </span>
              )}
              {!rightOpen && (
                <button
                  type="button"
                  onClick={() => toggle("rightCollapsed", false)}
                  aria-controls="planner-right-panel"
                  aria-expanded={false}
                  className="planner-panel-open"
                >
                  <span aria-hidden>{"<"}</span>
                  Телеметрия и карта
                </button>
              )}
            </div>
          </nav>
          <div hidden={view !== "map"} className="flex min-h-0 flex-1">
            <PlannerCanvas {...canvasProps} />
          </div>
          {simulationOpened && (
            <div hidden={view !== "simulation"} className="min-h-0 flex-1 p-2">
              <PlannerSimulationSection large />
            </div>
          )}
        </main>
        <div
          hidden={!rightOpen}
          id="planner-right-panel"
          className="workspace-panel workspace-panel-right"
        >
          <PlannerRightSidebar
            {...rightSidebarProps}
            onCollapse={() => setSidebarCollapsed("rightCollapsed", true)}
          />
        </div>
      </div>
    </div>
  );
}
