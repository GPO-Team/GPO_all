export const DEFAULT_SPEED_MPS = 0.22;
export const DEFAULT_PAYLOAD_KG = 0;

export const SURFACE_PROFILES = {
  neutral: {
    key: "neutral", label: "Нейтральное покрытие", fill: "rgba(148, 163, 184, 0.08)", stroke: "rgba(71, 85, 105, 0.35)",
    energyPerMeter: 1.0, maxSpeedMps: 0.24, nominalSpeedMps: 0.22, speedPenaltyGain: 0.4, payloadPenaltyPerKg: 0.012, turnEnergyPerRad: 0.32, slipRisk: 0.03,
  },
  rough: {
    key: "rough", label: "Шероховатое покрытие", fill: "rgba(245, 158, 11, 0.12)", stroke: "rgba(180, 83, 9, 0.4)",
    energyPerMeter: 1.32, maxSpeedMps: 0.18, nominalSpeedMps: 0.17, speedPenaltyGain: 0.72, payloadPenaltyPerKg: 0.023, turnEnergyPerRad: 0.46, slipRisk: 0.08,
  },
  slippery: {
    key: "slippery", label: "Скользкое покрытие", fill: "rgba(56, 189, 248, 0.12)", stroke: "rgba(2, 132, 199, 0.38)",
    energyPerMeter: 1.12, maxSpeedMps: 0.16, nominalSpeedMps: 0.15, speedPenaltyGain: 0.95, payloadPenaltyPerKg: 0.017, turnEnergyPerRad: 0.74, slipRisk: 0.24,
  },
};

export const SURFACE_PROFILE_OPTIONS = Object.values(SURFACE_PROFILES);

export const SURFACE_ZONE_PRESETS = [
  { id: "surface-rough-west", surfaceKey: "rough", name: "Покрытие 1", points: [{ x: -22, y: -17 }, { x: -6, y: -17 }, { x: -6, y: -4 }, { x: -22, y: -4 }] },
  { id: "surface-rough-center", surfaceKey: "rough", name: "Покрытие 2", points: [{ x: -3.8, y: -17 }, { x: 3.8, y: -17 }, { x: 3.8, y: 17 }, { x: -3.8, y: 17 }] },
  { id: "surface-slippery-east", surfaceKey: "slippery", name: "Покрытие 3", points: [{ x: 8, y: 4.5 }, { x: 22, y: 4.5 }, { x: 22, y: 17 }, { x: 8, y: 17 }] },
];

export const DEFAULT_ENERGY_OPTIONS = { speedMps: DEFAULT_SPEED_MPS, payloadKg: DEFAULT_PAYLOAD_KG };

export const getSurfaceProfileByKey = (key) => SURFACE_PROFILES[key] || SURFACE_PROFILES.neutral;
