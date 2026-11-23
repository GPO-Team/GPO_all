const fs = require("fs/promises");
const path = require("path");
const {fingerprint} = require("../protocol/service-contract.cjs");
const {serviceError} = require("../protocol/service-contract.cjs");
const {validateMissionId} = require("../protocol/mission-contract.cjs");
const {validateTransferCommand} = require("../protocol/transfer-validation.cjs");
const {validatePickPlace} = require("../protocol/manipulator-validation.cjs");
const {validatePoints} = require("../protocol/route-validation.cjs");
const {normalizeScene} = require("../protocol/scene-validation.cjs");

const validateSubmit = command => {
  if (!["route", "start_mapping_survey", "pick_place", "transfer_object"].includes(command?.type)) {
    throw serviceError(400, "unsupported_command", "Unsupported simulator command.");
  }
  validateMissionId(command.commandId);
  if (command.type === "transfer_object") validateTransferCommand(command);
  if (command.type === "pick_place") validatePickPlace(command);
  if (command.type === "route") {
    if (validatePoints(command.route).length < 2) throw serviceError(400, "invalid_route", "At least two route points are required.");
    if (command.scene) normalizeScene(command.scene);
  }
};

// The simulator file layout and legacy command vocabulary terminate here.
const observeWebotsMission = async (stateDir, missionId) => {
  const unavailable = { controllerBootId: null, feedback: null };
  if (!stateDir) return unavailable;
  try {
    const filename = path.join(stateDir, "robot_state.json");
    const stat = await fs.stat(filename);
    if (Date.now() - stat.mtimeMs > 5000) return unavailable;
    const state = JSON.parse(await fs.readFile(filename, "utf8"));
    const bootId = state?.objectTransfer?.controllerBootId;
    const controllerBootId = typeof bootId === "string" && /^[A-Za-z0-9_-]{1,63}$/.test(bootId) ? bootId : null;
    const observedAt = new Date(stat.mtimeMs).toISOString();
    if (!missionId) return { controllerBootId, feedback: null };
    if (state?.objectTransfer?.missionId === missionId) {
      return { controllerBootId, feedback: {
        ...state.objectTransfer,
        missionId,
        objectPose: state.objectTransfer.position ?? state.objectTransfer.objectPose ?? null,
        observedAt,
      }};
    }
    const navigation = state?.navigation;
    if (navigation?.missionId !== missionId) return { controllerBootId, feedback: null };
    const arm = state.manipulator?.missionId === missionId ? state.manipulator : null;
    const held = arm?.stage === "holding_for_recovery" &&
      (navigation.status === "manipulator_holding" || arm.loadHeld === true || arm.onPlatform === true);
    const status = held ? "holding_for_recovery" : arm?.cancelPending === true && arm.active === true ? "cancelling" : navigation.status === "mission_cancelled" ? "cancelled" : navigation.status === "route_failed" ? "failed" : navigation.finished === true ? "completed" : navigation.status === "route_loaded" ? "accepted" : "running";
    const reason = typeof arm?.error === "string" && arm.error ? arm.error : navigation.error;
    return { controllerBootId, feedback: { missionId, status, observedAt,
      ...(controllerBootId ? { controllerBootId } : {}),
      ...(arm ? {stage:arm.stage,attached:arm.loadHeld === true,onPlatform:arm.onPlatform === true,errorCode:held ? reason || "unsafe_release" : null} : {}),
      ...(status === "failed" && typeof reason === "string" && reason ? {error:reason.slice(0,128)} : {}),
    }};
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return unavailable;
    throw error;
  }
};

const createWebotsFileAdapter = ({artifactStore, stateDir}) => {
  const observeMission = missionId => observeWebotsMission(stateDir, missionId);
  return {
    validateSubmit,
    async submit(command, controllerBootId) {
      validateSubmit(command);
      const boundCommand = { ...command, controllerBootId };
      if(command.type === "transfer_object") { await artifactStore.writeTransfer(boundCommand); return; }
      if (["start_mapping_survey", "pick_place"].includes(command.type)) {
        await artifactStore.writeRuntimeCommand({...boundCommand,missionId:command.commandId,requestKey:fingerprint({survey:command.commandId}).slice(0,63)});
        return;
      }
      if (command.scene) {
        await artifactStore.writeLimitZones({zones:command.scene.polygons});
        await artifactStore.writeSurfaceZones({zones:command.scene.surfaceZones});
      }
      await artifactStore.writeRoute(boundCommand);
    },
    async cancel({missionId,redeliver=false}) {
      await artifactStore.writeRuntimeCommand({type:"cancel_mission",missionId,...(!redeliver ? {requestKey:missionId} : {})});
    },
    async update(payload) {
      switch (payload?.type) {
        case "recover_transfer":
        case "resume_transfer": await artifactStore.writeRuntimeCommand(payload); break;
        case "limit_zones": await artifactStore.writeLimitZones(payload); break;
        case "surface_zones": await artifactStore.writeSurfaceZones(payload); break;
        case "motion_profile": await artifactStore.writeMotionProfile(payload.motion); break;
        case "spawn_random_obstacle":
        case "update_runtime_obstacle":
        case "delete_runtime_obstacle":
        case "set_manipulator_pose": await artifactStore.writeRuntimeCommand(payload); break;
        default: return false;
      }
      return true;
    },
    observeMission,
    async getFeedback(missionId) {
      return (await observeMission(missionId)).feedback;
    },
  };
};
module.exports = {createWebotsFileAdapter};
