const createRouteService = ({ artifactStore, missionService, adapter }) => {
  const handle = async (payload, context) => {
    if (["route", "start_mapping_survey", "pick_place", "transfer_object"].includes(payload?.type) && missionService) {
      const mission = await missionService.submit(payload, context);
      return {handled:true,missionId:mission.missionId,operationType:mission.operationType,status:mission.status,route:mission.command.route,planning:mission.command.planning,sceneRevision:mission.command.sceneRevision};
    }
    if (payload?.type === "start_mapping_survey") return {handled:false};
    if (missionService) return {handled:await missionService.update(payload,context)};
    if (adapter) return {handled:await adapter.update(payload)};
    if (payload?.type === "route") {
      await artifactStore.writeRoute(payload);
      return { handled: true };
    }
    if (payload?.type === "limit_zones") {
      await artifactStore.writeLimitZones(payload);
      return { handled: true };
    }
    if (payload?.type === "surface_zones") {
      await artifactStore.writeSurfaceZones(payload);
      return { handled: true };
    }
    if (payload?.type === "motion_profile") {
      await artifactStore.writeMotionProfile(payload.motion);
      return { handled: true };
    }
    if (payload?.type === "spawn_random_obstacle") {
      await artifactStore.writeRuntimeCommand(payload);
      return { handled: true };
    }
    return { handled: false };
  };

  return { handle };
};

module.exports = { createRouteService };
