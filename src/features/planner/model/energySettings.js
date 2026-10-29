const parseLooseNumber = (rawValue) => {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const MAX_BATTERY_RANGE = 10000;
export const MIN_CRUISE_SPEED = 0.05;
export const MAX_CRUISE_SPEED = 0.8;
export const MAX_PAYLOAD = 500;

const validateDecimalInput = (rawValue, previousInput, maximum) => {
  const text = String(rawValue ?? "").trim();
  if (!/^\d*([.,]\d*)?$/.test(text)) return previousInput;
  const parsed = parseLooseNumber(text);
  if (parsed != null && parsed > maximum) return String(maximum);
  // An overflowing numeric paste must not remain visible in the input.
  if (text && !Number.isFinite(Number(text.replace(",", "."))) && /\d/.test(text)) return String(maximum);
  return text;
};
export const validateBatteryRangeInput = (rawValue, previousInput) =>
  validateDecimalInput(rawValue, previousInput, MAX_BATTERY_RANGE);
export const validateCruiseSpeedInput = (rawValue, previousInput) =>
  validateDecimalInput(rawValue, previousInput, MAX_CRUISE_SPEED);
export const validatePayloadInput = (rawValue, previousInput) =>
  validateDecimalInput(rawValue, previousInput, MAX_PAYLOAD);

export const formatEnergyNumber = (value, digits) =>
  Number(value.toFixed(digits)).toString();

export const normalizeBatteryRange = (rawValue) => {
  const parsed = parseLooseNumber(rawValue);
  return parsed == null ? null : Math.max(1, Math.min(MAX_BATTERY_RANGE, Math.round(parsed)));
};

export const normalizeCruiseSpeed = (rawValue) => {
  const parsed = parseLooseNumber(rawValue);
  return parsed == null
    ? null
    : Math.max(MIN_CRUISE_SPEED, Math.min(MAX_CRUISE_SPEED, Number(parsed.toFixed(3))));
};

export const normalizePayload = (rawValue) => {
  const parsed = parseLooseNumber(rawValue);
  return parsed == null
    ? null
    : Math.max(0, Math.min(MAX_PAYLOAD, Number(parsed.toFixed(2))));
};
