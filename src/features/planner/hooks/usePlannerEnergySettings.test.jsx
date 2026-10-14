// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePlannerEnergySettings } from "./usePlannerEnergySettings";
import { MAX_BATTERY_RANGE } from "../model/energySettings";

it("caps typed and pasted energy immediately while allowing clearing and retyping", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let settings;
  function Harness() {
    const currentSettings = usePlannerEnergySettings({
      setEnergyWarning: vi.fn(), setExpandedPoint: vi.fn(),
      setHoveredPointIndex: vi.fn(), setRouteEnergyStats: vi.fn(),
    });
    React.useEffect(() => { settings = currentSettings; });
    return <input value={currentSettings.batteryRangeInput} readOnly />;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Harness />));
    for (const value of ["10001", "999999999", "9".repeat(400)]) {
      await act(async () => settings.handleBatteryRangeChange(value));
      expect(container.querySelector("input").value).toBe(String(MAX_BATTERY_RANGE));
      expect(settings.batteryRangeMeters).toBe(MAX_BATTERY_RANGE);
    }
    await act(async () => settings.handleBatteryRangeChange(""));
    expect(container.querySelector("input").value).toBe("");
    await act(async () => settings.handleBatteryRangeChange("25"));
    expect(settings.batteryRangeMeters).toBe(25);
    await act(async () => settings.handleBatteryRangeChange("1e999"));
    expect(container.querySelector("input").value).toBe("25");
  } finally {
    await act(async () => root.unmount());
  }
});
