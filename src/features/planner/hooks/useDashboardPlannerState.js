import { useRef, useState } from "react";
import { INITIAL_ZONE } from "../../../lib/plannerModel";
import { DEFAULT_SURFACE_ZONES } from "../../../lib/zonePlanner";
import { createDashboardAlgorithmParams } from "../model/dashboardAlgorithmParams";
import { createEmptyRouteEnergyStats } from "../model/routeEnergy";
import { MAPPING_SURVEY_MODES } from "../model/runtimeCommands";
import {
  createInitialSurfaceZones,
  DEFAULT_SURFACE_PROFILE_KEY,
} from "../model/surfaceZones";
import { usePlannerEnergySettings } from "./usePlannerEnergySettings";
import { usePlannerSidebarState } from "./usePlannerSidebarState";

export const useDashboardPlannerState = () => {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [routeSeed, setRouteSeed] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [status, setStatus] = useState("");
  const [energyWarning, setEnergyWarning] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeTaskKey, setRouteTaskKey] = useState("tsp");
  const [driveMode, setDriveMode] = useState("optimized");
  const [algorithmKey, setAlgorithmKey] = useState("ga_tabu");
  const [algorithmParams, setAlgorithmParams] = useState(createDashboardAlgorithmParams);
  const [expandedPoint, setExpandedPoint] = useState(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [activePointKind, setActivePointKind] = useState("visit");
  const [pointPlacementRevision, setPointPlacementRevision] = useState(0);
  const activatePointPlacement = (kind) => {
    setActivePointKind(kind);
    setPointPlacementRevision((previous) => previous + 1);
  };
  const [mapExportPromptOpen, setMapExportPromptOpen] = useState(false);
  const [surfaceZones, setSurfaceZones] = useState(createInitialSurfaceZones);
  const [activeSurfaceZoneId, setActiveSurfaceZoneId] = useState(
    () => `surface-zone-${DEFAULT_SURFACE_ZONES.length + 1}`
  );
  const [activeSurfaceProfileKey, setActiveSurfaceProfileKey] = useState(
    DEFAULT_SURFACE_PROFILE_KEY
  );
  const [nextSurfaceZoneNumber, setNextSurfaceZoneNumber] = useState(
    () => DEFAULT_SURFACE_ZONES.length + 2
  );
  const [limitZones, setLimitZones] = useState([INITIAL_ZONE]);
  const [activeLimitZoneId, setActiveLimitZoneId] = useState(INITIAL_ZONE.id);
  const [nextZoneNumber, setNextZoneNumber] = useState(2);
  const [routeEnergyStats, setRouteEnergyStats] = useState(createEmptyRouteEnergyStats);
  const [mappingSurveyMode, setMappingSurveyMode] = useState(MAPPING_SURVEY_MODES[0].key);
  const { plannerUiState, setSidebarCollapsed, setMapLayerVisible } = usePlannerSidebarState();
  const energySettings = usePlannerEnergySettings({
    setEnergyWarning,
    setExpandedPoint,
    setHoveredPointIndex,
    setRouteEnergyStats,
  });

  return {
    canvas: { canvasRef },
    route: {
      points, setPoints, routeSeed, setRouteSeed, optimizedRoute, setOptimizedRoute,
      status, setStatus, energyWarning, setEnergyWarning, isOptimizing, setIsOptimizing,
    },
    algorithm: {
      driveMode, setDriveMode,
      routeTaskKey, setRouteTaskKey, algorithmKey, setAlgorithmKey,
      algorithmParams, setAlgorithmParams,
    },
    interaction: {
      expandedPoint, setExpandedPoint, hoveredPointIndex, setHoveredPointIndex,
      activePointKind, setActivePointKind, mapExportPromptOpen, setMapExportPromptOpen,
      pointPlacementRevision, activatePointPlacement,
    },
    surfaces: {
      surfaceZones, setSurfaceZones, activeSurfaceZoneId, setActiveSurfaceZoneId,
      activeSurfaceProfileKey, setActiveSurfaceProfileKey,
      nextSurfaceZoneNumber, setNextSurfaceZoneNumber,
    },
    limits: {
      limitZones, setLimitZones, activeLimitZoneId, setActiveLimitZoneId,
      nextZoneNumber, setNextZoneNumber,
    },
    energy: { routeEnergyStats, setRouteEnergyStats, ...energySettings },
    mapping: { mappingSurveyMode, setMappingSurveyMode },
    sidebar: { plannerUiState, setSidebarCollapsed, setMapLayerVisible },
  };
};
