const fs = require("fs/promises");
const path = require("path");
const {fingerprint} = require("../protocol/service-contract.cjs");

// The simulator file layout and legacy command vocabulary terminate here.
const createWebotsFileAdapter = ({artifactStore, stateDir}) => ({
  async submit(command) {
    if (command.type === "start_mapping_survey") {
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
      if (state.navigation?.missionId !== missionId) return null;
      const navigation = state.navigation || {};
      const status = navigation.status === "mission_cancelled" ? "cancelled" : navigation.status === "route_failed" ? "failed" : navigation.finished === true ? "completed" : navigation.status === "route_loaded" ? "accepted" : "running";
      return {missionId,status,observedAt:new Date(stat.mtimeMs).toISOString()};
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  },
});
module.exports = {createWebotsFileAdapter};
