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
const createWebotsFileAdapter = ({artifactStore, stateDir}) => ({
  validateSubmit,
  async submit(command) {
    validateSubmit(command);
    if(command.type === "transfer_object") { await artifactStore.writeTransfer(command); return; }
    if (["start_mapping_survey", "pick_place"].includes(command.type)) {
      await artifactStore.writeRuntimeCommand({...command,missionId:command.commandId,requestKey:fingerprint({survey:command.commandId}).slice(0,63)});
      return;
    }
    if (command.scene) {
      await artifactStore.writeLimitZones({zones:command.scene.polygons});
      await artifactStore.writeSurfaceZones({zones:command.scene.surfaceZones});
    }
    await artifactStore.writeRoute(command);
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
      case "spawn_random_obstacle": await artifactStore.writeRuntimeCommand(payload); break;
      default: return false;
    }
    return true;
  },
  async getFeedback(missionId) {
    if (!stateDir) return null;
    try {
      const filename = path.join(stateDir,"robot_state.json");
      const stat = await fs.stat(filename);
      if (Date.now() - stat.mtimeMs > 5000) return null;
      const state = JSON.parse(await fs.readFile(filename,"utf8"));
      if(state.objectTransfer?.missionId === missionId) return {...state.objectTransfer,missionId,observedAt:new Date(stat.mtimeMs).toISOString()};
      if (state.navigation?.missionId !== missionId) return null;
      const navigation = state.navigation || {};
      const status = navigation.status === "mission_cancelled" ? "cancelled" : navigation.status === "route_failed" ? "failed" : navigation.finished === true ? "completed" : navigation.status === "route_loaded" ? "accepted" : "running";
      const arm = state.manipulator?.missionId === missionId ? state.manipulator : null;
      const reason = typeof arm?.error === "string" && arm.error ? arm.error : navigation.error;
      return {missionId,status,observedAt:new Date(stat.mtimeMs).toISOString(),
        ...(status === "failed" && typeof reason === "string" && reason ? {error:reason.slice(0,128)} : {})};
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  },
});
module.exports = {createWebotsFileAdapter};
