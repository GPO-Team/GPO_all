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
      surfaceZones={[]} zoneEntries={[]} activeZoneName="Зона 1"
      routeEnergyStats={{ routeEnergy: 0, limitingMaxSpeedMps: 0, averageSlipRisk: 0 }} />;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Harness />));
    expect(container.textContent).not.toContain("Перенос объекта");
    expect(container.textContent).toContain("Без номера · короткий путь");
    expect(container.textContent).toContain("Сохранить граф в CSV");
    expect(container.textContent).not.toContain("Добавить на карту");
    for (const [label, kind] of [["Зоны", "limit"], ["Покрытия", "surface"], ["Энергия", "charge"], ["Маршрут", "visit"]]) {
      const button = [...container.querySelectorAll("nav button")].find((item) => item.textContent === label);
      await act(async () => button.click());
      expect(changed).toHaveBeenLastCalledWith(kind);
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
  } finally {
    await act(async () => root.unmount());
  }
});
