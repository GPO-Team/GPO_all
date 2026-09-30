const {
  clamp,
  normalizeNumber,
} = require("../protocol/number-normalization.cjs");
const {
  sanitizeMappingSurveyMode,
} = require("../protocol/mapping-validation.cjs");

const DEFAULT_MOTION_PROFILE = {
  cruiseSpeedMps: 0.22,
  payloadKg: 0,
  batteryRange: 100,
};

const sanitizeMotionProfile = (motion) => {
  const profile = motion || {};
  return {
    cruiseSpeedMps: clamp(normalizeNumber(profile.cruiseSpeedMps, DEFAULT_MOTION_PROFILE.cruiseSpeedMps), 0.05, 0.8),
    payloadKg: clamp(normalizeNumber(profile.payloadKg, DEFAULT_MOTION_PROFILE.payloadKg), 0, 500),
    batteryRange: clamp(normalizeNumber(profile.batteryRange, DEFAULT_MOTION_PROFILE.batteryRange), 1, 100000),
  };
};

const sanitizeRuntimeObstacle = (rawObstacle) => {
  const obstacle = rawObstacle || {};
  return {
    x: clamp(normalizeNumber(obstacle.x, 0), -21.5, 21.5),
    y: clamp(normalizeNumber(obstacle.y, 0), -16.5, 16.5),
    sizeX: clamp(normalizeNumber(obstacle.sizeX, 0.8), 0.2, 3.5),
    sizeY: clamp(normalizeNumber(obstacle.sizeY, 0.8), 0.2, 3.5),
    height: clamp(normalizeNumber(obstacle.height, 0.6), 0.12, 2.8),
  };
};

const createMotionProfileText = (motion) => {
  const profile = sanitizeMotionProfile(motion);
  return `cruise_speed_mps ${profile.cruiseSpeedMps}\npayload_kg ${profile.payloadKg}\nbattery_range ${profile.batteryRange}\n`;
};

const createRuntimeCommandText = (payload) => {
  const commandId = Number(payload?.commandId) > 0 ? Math.trunc(Number(payload.commandId)) : Date.now();
  if (payload?.type === "cancel_mission") {
    const {validateMissionId}=require("../protocol/mission-contract.cjs");
    return `id ${commandId}\ntype cancel_mission\nmission_id ${validateMissionId(payload.missionId)}\n`;
  }
  if (payload?.type === "start_mapping_survey") {
    const {validateMissionId}=require("../protocol/mission-contract.cjs");
    const missionLine = `mission_id ${validateMissionId(payload.missionId)}\n`;
    const field = payload.field || {};
    const motion = sanitizeMotionProfile(payload.motion);
    const minX = normalizeNumber(field.minX, -22);
    const maxX = normalizeNumber(field.maxX, 22);
    const minY = normalizeNumber(field.minY, -17);
    const maxY = normalizeNumber(field.maxY, 17);
    return `id ${commandId}\ntype start_mapping_survey\n${missionLine}clear_map ${payload.clearMap === false ? 0 : 1}\nmode ${sanitizeMappingSurveyMode(payload.mode)}\nsurvey_speed_mps ${motion.cruiseSpeedMps}\nfield_min_x ${Math.min(minX, maxX)}\nfield_max_x ${Math.max(minX, maxX)}\nfield_min_y ${Math.min(minY, maxY)}\nfield_max_y ${Math.max(minY, maxY)}\n`;
  }
  const obstacle = sanitizeRuntimeObstacle(payload?.obstacle);
  return `id ${commandId}\ntype spawn_obstacle\nx ${obstacle.x}\ny ${obstacle.y}\nsize_x ${obstacle.sizeX}\nsize_y ${obstacle.sizeY}\nheight ${obstacle.height}\n`;
};

module.exports = { createMotionProfileText, createRuntimeCommandText, sanitizeMotionProfile, sanitizeRuntimeObstacle };
