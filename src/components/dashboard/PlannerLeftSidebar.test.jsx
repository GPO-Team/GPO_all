// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PlannerLeftSidebar from "./PlannerLeftSidebar";

it("activates point placement directly from each menu section and preserves transfer controls", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const changed = vi.fn();
  function Harness() {
    const [kind, setKind] = useState("visit");
    return <PlannerLeftSidebar activePointKind={kind} onActivePointKindChange={(next) => { changed(next); setKind(next); }}
      algorithmFields={[]} selectedAlgorithmParams={{}} routeLength={0}
      surfaceZones={[]} zoneEntries={[]} activeZoneName="Зона 1" visitCount={4} chargeCount={2} zoneCount={1}
      routeEnergyStats={{ routeEnergy: 0, limitingMaxSpeedMps: 0, averageSlipRisk: 0 }} />;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Harness />));
    expect(container.textContent).toContain("Перенос объекта");
    const pointsHeading = [...container.querySelectorAll("summary")].find((item) => item.textContent.includes("Точки посещения"));
    const transferHeading = [...container.querySelectorAll("summary")].find((item) => item.textContent.includes("Перенос объекта"));
    const importHeading = [...container.querySelectorAll("h3")].find((item) => item.textContent.includes("Импорт графа"));
    expect(pointsHeading.compareDocumentPosition(transferHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(transferHeading.compareDocumentPosition(importHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain("Точки посещения: 4");
    expect(container.textContent).not.toContain("Зарядки: 2");
    expect(container.textContent).not.toContain("Зоны: 1");
    expect(container.textContent).not.toContain("Добавить на карту");
    for (const [label, kind] of [["Зоны", "limit"], ["Покрытия", "surface"], ["Энергия", "charge"], ["Маршрут", "visit"]]) {
      const button = [...container.querySelectorAll("nav button")].find((item) => item.textContent === label);
      await act(async () => button.click());
      expect(changed).toHaveBeenLastCalledWith(kind);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      if (kind === "limit") expect(container.textContent).toContain("Зоны: 1");
      if (kind === "charge") expect(container.textContent).toContain("Зарядки: 2");
      if (kind === "surface") expect(container.textContent).toContain("Покрытия: 0");
    }
  } finally {
    await act(async () => root.unmount());
  }
});
