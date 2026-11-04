export {
  DEFAULT_ENERGY_OPTIONS,
  SURFACE_PROFILES,
  SURFACE_PROFILE_OPTIONS,
  SURFACE_ZONE_PRESETS,
  getSurfaceProfileByKey,
} from "../features/planner/model/energyProfiles";

export { resolveSurfaceAtPoint } from "../features/planner/model/energySurfaceZones";
export { describeSurfaceRuntime, estimateRouteEnergy } from "../features/planner/model/energyEstimator";
