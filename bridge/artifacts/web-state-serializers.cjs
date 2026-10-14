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
  if (payload?.type === "pick_place") {
    const { validatePickPlace } = require("../protocol/manipulator-validation.cjs");
    const { validateMissionId } = require("../protocol/mission-contract.cjs");
    const command = validatePickPlace(payload);
    const target = command.destination;
    return `id ${commandId}\ntype pick_place\nmission_id ${validateMissionId(payload.missionId)}\nobject_def ${command.objectDef}\ntarget_x ${target.x}\ntarget_y ${target.y}\ntarget_z ${target.z}\n`;
  }
  if (["transfer_object", "recover_transfer", "resume_transfer"].includes(payload?.type)) {
    const {validateMissionId}=require("../protocol/mission-contract.cjs");
    const missionId=validateMissionId(payload.missionId || payload.commandId);
    const objectId=payload.objectId || "demo-box";
    if(objectId!=="demo-box")throw new Error("Only demo-box is supported.");
    const x=normalizeNumber(payload.destination?.x,0);
    const y=normalizeNumber(payload.destination?.y,0);
    const revision=String(payload.sceneRevision || "").trim();
    return `id ${commandId}\ntype ${payload.type}\nmission_id ${missionId}\nobject_id ${objectId}\ndestination_x ${x}\ndestination_y ${y}\nscene_revision ${revision}\n`;
  }
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
  if (payload?.type !== undefined && !["spawn_random_obstacle", "spawn_obstacle"].includes(payload.type)) {
    throw Object.assign(new Error("Unsupported runtime command."), {statusCode:400});
  }
  const obstacle = sanitizeRuntimeObstacle(payload?.obstacle);
  return `id ${commandId}\ntype spawn_obstacle\nx ${obstacle.x}\ny ${obstacle.y}\nsize_x ${obstacle.sizeX}\nsize_y ${obstacle.sizeY}\nheight ${obstacle.height}\n`;
};

module.exports = { createMotionProfileText, createRuntimeCommandText, sanitizeMotionProfile, sanitizeRuntimeObstacle };
