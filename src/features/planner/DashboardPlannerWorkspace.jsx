import { useEffect, useState } from "react";
import PlannerCanvas from "../../components/dashboard/PlannerCanvas";
import PlannerLeftSidebar from "../../components/dashboard/PlannerLeftSidebar";
import PlannerRightSidebar from "../../components/dashboard/PlannerRightSidebar";
import SidebarCollapseRail from "../../components/dashboard/SidebarCollapseRail";

export default function DashboardPlannerWorkspace({ canvasProps, leftSidebarProps, plannerUiState, rightSidebarProps, setSidebarCollapsed }) {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const leftOpen = !plannerUiState.leftCollapsed;
  const rightOpen = !plannerUiState.rightCollapsed && !(compact && leftOpen);
  const toggle = (side, open) => {
    if (compact && !open) setSidebarCollapsed(side === "leftCollapsed" ? "rightCollapsed" : "leftCollapsed", true);
    setSidebarCollapsed(side, open);
  };
  return (
    <div className="planner-workspace flex overflow-hidden bg-slate-100 text-slate-900">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div hidden={!leftOpen} id="planner-left-panel" className="workspace-panel workspace-panel-left"><PlannerLeftSidebar {...leftSidebarProps} onCollapse={() => setSidebarCollapsed("leftCollapsed", true)} /></div>
        {!leftOpen && <SidebarCollapseRail side="left" onExpand={() => toggle("leftCollapsed", false)} />}
        <PlannerCanvas {...canvasProps} />
        <div hidden={!rightOpen} id="planner-right-panel" className="workspace-panel workspace-panel-right"><PlannerRightSidebar {...rightSidebarProps} onCollapse={() => setSidebarCollapsed("rightCollapsed", true)} /></div>
        {!rightOpen && <SidebarCollapseRail side="right" onExpand={() => toggle("rightCollapsed", false)} />}
      </div>
    </div>
  );
}
