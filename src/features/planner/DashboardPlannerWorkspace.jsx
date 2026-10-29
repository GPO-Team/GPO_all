import { useEffect, useState } from "react";
import PlannerCanvas from "../../components/dashboard/PlannerCanvas";
import PlannerLeftSidebar from "../../components/dashboard/PlannerLeftSidebar";
import PlannerRightSidebar from "../../components/dashboard/PlannerRightSidebar";
import SidebarCollapseRail from "../../components/dashboard/SidebarCollapseRail";
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
        {!leftOpen && (
          <SidebarCollapseRail
            side="left"
            onExpand={() => toggle("leftCollapsed", false)}
          />
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2"
            aria-label="Рабочее окно"
          >
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
            <a
              href="/warehouse"
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold !text-orange-800"
            >
              Склад и размещение
            </a>
            {canvasProps.editingLocked && (
              <span role="status" className="ml-auto text-xs text-amber-800">
                Граф заблокирован на время миссии
              </span>
            )}
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
        {!rightOpen && (
          <SidebarCollapseRail
            side="right"
            onExpand={() => toggle("rightCollapsed", false)}
          />
        )}
      </div>
    </div>
  );
}
