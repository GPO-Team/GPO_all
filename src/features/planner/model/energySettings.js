const parseLooseNumber = (rawValue) => {
  const normalized = String(rawValue ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const MAX_BATTERY_RANGE = 10000;

export const validateBatteryRangeInput = (rawValue, previousInput) => {
  const text = String(rawValue ?? "").trim();
  if (!/^\d*([.,]\d*)?$/.test(text)) return previousInput;
  const parsed = parseLooseNumber(text);
  if (parsed != null && parsed > MAX_BATTERY_RANGE) return String(MAX_BATTERY_RANGE);
  // An overflowing numeric paste must not remain visible in the input.
  if (text && !Number.isFinite(Number(text.replace(",", "."))) && /\d/.test(text)) return String(MAX_BATTERY_RANGE);
  return text;
};

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
    : Math.max(0.05, Math.min(0.8, Number(parsed.toFixed(3))));
};

export const normalizePayload = (rawValue) => {
  const parsed = parseLooseNumber(rawValue);
  return parsed == null
    ? null
    : Math.max(0, Math.min(500, Number(parsed.toFixed(2))));
};
