// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PlannerSurfaceZonesSection from "./PlannerSurfaceZonesSection";
import { usePlannerSurfaceZoneEditor } from "../../../features/planner/hooks/usePlannerSurfaceZoneEditor";

it("changes the clicked zone's type without changing its neighbor and exposes independent contour actions", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  function Harness() {
    const [zones, setZones] = useState([
      { id: "a", name: "Западный участок", surfaceKey: "rough", closed: true, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
      { id: "b", name: "Пустое покрытие", surfaceKey: "neutral", closed: false, points: [] },
    ]);
    const [activeId, setActiveId] = useState("b");
    const [profile, setProfile] = useState("neutral");
    const editor = usePlannerSurfaceZoneEditor({
      surfaceZones: zones, setSurfaceZones: setZones, activeSurfaceZoneId: activeId,
      setActiveSurfaceZoneId: setActiveId, activeSurfaceProfileKey: profile,
      setActiveSurfaceProfileKey: setProfile, setActivePointKind: vi.fn(),
      clearRouteState: vi.fn(), setStatus: vi.fn(),
    });
    return <PlannerSurfaceZonesSection surfaceZones={zones} activeSurfaceZoneId={activeId}
      cruiseSpeedInput="0.22" payloadInput="0"
      onSelectSurfaceZone={editor.selectSurfaceZone} onSurfaceProfileChange={editor.updateSurfaceProfile}
      onClearSurfaceZone={editor.clearSurfaceZone} onToggleSurfaceZoneClosed={editor.toggleSurfaceZoneClosed} />;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const zoneSelect = (number) => container.querySelector(`select[aria-label="Тип покрытия зоны ${number}"]`);
  const zoneCard = (number) => zoneSelect(number).closest("label").parentElement.parentElement;
  const zoneTitle = (number) => zoneCard(number).querySelector(".flex-1").textContent;
  try {
    await act(async () => root.render(<Harness />));
    expect(container.querySelector("details").open).toBe(true);
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Новая зона").closest("details")).toBeNull();
    await act(async () => container.querySelector("summary").click());
    expect(container.querySelector("details").open).toBe(false);
    await act(async () => container.querySelector("summary").click());
    expect([...zoneCard(2).querySelectorAll("button")].find((button) => button.textContent === "Очистить зону").disabled).toBe(true);
    const select = zoneSelect(1);
    expect(select.value).toBe("rough");
    await act(async () => { select.value = "slippery"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(zoneTitle(1)).toBe("1. Скользкое покрытие");
    expect(zoneTitle(2)).toBe("2. Нейтральное покрытие");
    expect(container.querySelectorAll("select")).toHaveLength(2);
    await act(async () => zoneSelect(2).dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    const firstCard = zoneCard(1);
    await act(async () => [...firstCard.querySelectorAll("button")].find((button) => button.textContent === "Открыть").click());
    expect(firstCard.textContent).toContain("Открыта");
    await act(async () => [...firstCard.querySelectorAll("button")].find((button) => button.textContent === "Очистить зону").click());
    expect(firstCard.textContent).toContain("Точек: 0");
    expect([...firstCard.querySelectorAll("button")].find((button) => button.textContent === "Очистить зону").disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
  }
});
