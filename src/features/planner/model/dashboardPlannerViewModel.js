import { getAlgorithmPrecision, getDefaultAlgorithmParams } from "../../../lib/routeAlgorithms";

export const createDashboardPlannerViewModel = ({
  algorithmKey,
  algorithmParams,
  activeSurfaceZoneId,
  surfaceZones,
}) => {
  const selectedAlgorithmParams =
    algorithmParams[algorithmKey] || getDefaultAlgorithmParams(algorithmKey);
  return {
    activeSurfaceZone:
      surfaceZones.find((zone) => zone.id === activeSurfaceZoneId) || surfaceZones[0] || null,
    algorithmPrecision: getAlgorithmPrecision(algorithmKey, selectedAlgorithmParams),
    selectedAlgorithmParams,
  };
};
