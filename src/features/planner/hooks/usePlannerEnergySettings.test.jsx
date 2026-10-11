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

it("validates speed and payload during editing, supports comma decimals, and resolves drafts on blur", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let settings;
  function Harness() {
    const currentSettings = usePlannerEnergySettings({
      setEnergyWarning: vi.fn(), setExpandedPoint: vi.fn(),
      setHoveredPointIndex: vi.fn(), setRouteEnergyStats: vi.fn(),
    });
    React.useEffect(() => { settings = currentSettings; });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<Harness />));
    for (const value of ["1", "0,9", "9".repeat(400)]) {
      await act(async () => settings.handleCruiseSpeedChange(value));
      expect(settings.cruiseSpeedInput).toBe("0.8");
      expect(settings.cruiseSpeedMps).toBe(0.8);
    }
    for (const value of ["", "0", "0,", "0,0", "0,05"]) {
      await act(async () => settings.handleCruiseSpeedChange(value));
      expect(settings.cruiseSpeedInput).toBe(value);
    }
    expect(settings.cruiseSpeedMps).toBe(0.05);
    await act(async () => settings.handleCruiseSpeedChange("0,01"));
    await act(async () => settings.handleCruiseSpeedBlur());
    expect(settings.cruiseSpeedInput).toBe("0.05");
    for (const value of ["-1", "abc", "1e2"]) {
      await act(async () => settings.handleCruiseSpeedChange(value));
      expect(settings.cruiseSpeedInput).toBe("0.05");
    }
    for (const value of ["501", "500,1", "9".repeat(400)]) {
      await act(async () => settings.handlePayloadChange(value));
      expect(settings.payloadInput).toBe("500");
      expect(settings.payloadKg).toBe(500);
    }
    await act(async () => settings.handlePayloadChange("12,5"));
    expect(settings.payloadKg).toBe(12.5);
    for (const value of ["-1", "abc", "1e3"]) {
      await act(async () => settings.handlePayloadChange(value));
      expect(settings.payloadInput).toBe("12,5");
    }
    await act(async () => settings.handlePayloadChange(""));
    await act(async () => settings.handlePayloadBlur());
    expect(settings.payloadInput).toBe("12.5");
  } finally {
    await act(async () => root.unmount());
  }
});
