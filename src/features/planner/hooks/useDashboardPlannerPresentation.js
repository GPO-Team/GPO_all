import { useMemo } from "react";
import { buildRouteInfluenceRows } from "../model/energyInfluence";

export const useDashboardPlannerPresentation = ({
  routeEnergyStats,
  routeTimingDisplay,
  routeAvoidanceTimeSec,
  routeOffRouteActive,
  telemetry,
}) => {
  const telemetryForSidebar = useMemo(
    () => ({
      ...telemetry,
      navigation: {
        ...telemetry.navigation,
        avoidanceTimeSec: routeAvoidanceTimeSec,
        offRouteActive: routeOffRouteActive,
      },
    }),
    [routeAvoidanceTimeSec, routeOffRouteActive, telemetry]
  );
  const routeInfluenceRows = useMemo(
    () => buildRouteInfluenceRows(routeEnergyStats.influenceRows, {
      plannedTimeSec: routeEnergyStats.estimatedTimeSec,
      actualTimeSec: routeTimingDisplay.actualTimeSec,
      avoidanceTimeSec: routeAvoidanceTimeSec,
    }),
    [routeAvoidanceTimeSec, routeEnergyStats.estimatedTimeSec,
      routeEnergyStats.influenceRows, routeTimingDisplay.actualTimeSec]
  );

  return { routeInfluenceRows, telemetryForSidebar };
};
