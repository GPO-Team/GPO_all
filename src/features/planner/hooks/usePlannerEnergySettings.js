import { useEffect, useState } from "react";
import { DEFAULT_BATTERY_RANGE_METERS } from "../../../lib/chargingPlanner";
import { DEFAULT_ENERGY_OPTIONS } from "../../../lib/energyModel";
import {
  formatEnergyNumber,
  normalizeBatteryRange,
  normalizeCruiseSpeed,
  normalizePayload,
  validateBatteryRangeInput,
} from "../model/energySettings";
import { createEmptyRouteEnergyStats } from "../model/routeEnergy";

const STORAGE_KEY = "gpo_dashboard_cruise_speed_mps";

const readStoredCruiseSpeed = () => {
  if (typeof window === "undefined") return DEFAULT_ENERGY_OPTIONS.speedMps;
  try {
    return normalizeCruiseSpeed(window.localStorage.getItem(STORAGE_KEY)) ??
      DEFAULT_ENERGY_OPTIONS.speedMps;
  } catch {
    return DEFAULT_ENERGY_OPTIONS.speedMps;
  }
};

export const usePlannerEnergySettings = ({
  setEnergyWarning,
  setExpandedPoint,
  setHoveredPointIndex,
  setRouteEnergyStats,
}) => {
  const [batteryRangeMeters, setBatteryRangeMeters] = useState(DEFAULT_BATTERY_RANGE_METERS);
  const [cruiseSpeedMps, setCruiseSpeedMps] = useState(readStoredCruiseSpeed);
  const [payloadKg, setPayloadKg] = useState(DEFAULT_ENERGY_OPTIONS.payloadKg);
  const [batteryRangeInput, setBatteryRangeInput] = useState(String(DEFAULT_BATTERY_RANGE_METERS));
  const [cruiseSpeedInput, setCruiseSpeedInput] = useState(() => formatEnergyNumber(readStoredCruiseSpeed(), 3));
  const [payloadInput, setPayloadInput] = useState(formatEnergyNumber(DEFAULT_ENERGY_OPTIONS.payloadKg, 2));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(cruiseSpeedMps));
    } catch {
      // Storage can be disabled in private browser modes.
    }
  }, [cruiseSpeedMps]);

  const invalidateRoute = () => {
    setExpandedPoint(null);
    setHoveredPointIndex(null);
    setRouteEnergyStats(createEmptyRouteEnergyStats());
    setEnergyWarning("");
  };
  const applyValue = (rawValue, currentValue, normalize, setValue) => {
    const nextValue = normalize(rawValue);
    if (nextValue == null || Math.abs(nextValue - currentValue) <= 1e-9) return;
    setValue(nextValue);
    invalidateRoute();
  };
  const handleBatteryRangeChange = (rawValue) => {
    const nextInput = validateBatteryRangeInput(rawValue, batteryRangeInput);
    setBatteryRangeInput(nextInput);
    applyValue(nextInput, batteryRangeMeters, normalizeBatteryRange, setBatteryRangeMeters);
  };
  const handleBatteryRangeBlur = () => {
    const nextValue = normalizeBatteryRange(batteryRangeInput);
    if (nextValue == null) {
      setBatteryRangeInput(String(batteryRangeMeters));
      return;
    }
    applyValue(nextValue, batteryRangeMeters, normalizeBatteryRange, setBatteryRangeMeters);
    setBatteryRangeInput(String(nextValue));
  };
  const handleCruiseSpeedChange = (rawValue) => {
    setCruiseSpeedInput(rawValue);
    applyValue(rawValue, cruiseSpeedMps, normalizeCruiseSpeed, setCruiseSpeedMps);
  };
  const handleCruiseSpeedBlur = () => {
    const nextValue = normalizeCruiseSpeed(cruiseSpeedInput);
    if (nextValue == null) {
      setCruiseSpeedInput(formatEnergyNumber(cruiseSpeedMps, 3));
      return;
    }
    applyValue(nextValue, cruiseSpeedMps, normalizeCruiseSpeed, setCruiseSpeedMps);
    setCruiseSpeedInput(formatEnergyNumber(nextValue, 3));
  };
  const handlePayloadChange = (rawValue) => {
    setPayloadInput(rawValue);
    applyValue(rawValue, payloadKg, normalizePayload, setPayloadKg);
  };
  const handlePayloadBlur = () => {
    const nextValue = normalizePayload(payloadInput);
    if (nextValue == null) {
      setPayloadInput(formatEnergyNumber(payloadKg, 2));
      return;
    }
    applyValue(nextValue, payloadKg, normalizePayload, setPayloadKg);
    setPayloadInput(formatEnergyNumber(nextValue, 2));
  };

  return { batteryRangeInput, batteryRangeMeters, cruiseSpeedInput, cruiseSpeedMps,
    handleBatteryRangeBlur, handleBatteryRangeChange, handleCruiseSpeedBlur,
    handleCruiseSpeedChange, handlePayloadBlur, handlePayloadChange, payloadInput, payloadKg };
};
