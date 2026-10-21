import { DEFAULT_SURFACE_ZONES } from "../../../lib/zonePlanner";
import {
  DEFAULT_SURFACE_PROFILE_KEY,
  isSurfaceProfileKey,
  normalizeSurfaceZoneForState,
  normalizeSurfaceZonesForImport,
} from "../../../../shared/planning/graphImport.js";

export { DEFAULT_SURFACE_PROFILE_KEY, isSurfaceProfileKey, normalizeSurfaceZoneForState, normalizeSurfaceZonesForImport };

export const createSurfaceZoneDraft = (
  number,
  surfaceKey = DEFAULT_SURFACE_PROFILE_KEY
) => ({
  id: `surface-zone-${number}`,
  name: `Покрытие ${number}`,
  surfaceKey,
  closed: false,
  points: [],
});

export const createInitialSurfaceZones = () => {
  const presetZones = DEFAULT_SURFACE_ZONES.map((zone, index) =>
    normalizeSurfaceZoneForState({ ...zone, closed: true }, index)
  );
  return [...presetZones, createSurfaceZoneDraft(presetZones.length + 1)];
};

export const deriveNextSurfaceZoneNumber = (zones) => {
  const maxNumber = zones.reduce((best, zone) => {
    const idMatch = String(zone?.id ?? "").match(/surface-zone-(\d+)/i);
    const nameMatch = String(zone?.name ?? "").match(/(\d+)/);
    const candidates = [idMatch?.[1], nameMatch?.[1]]
      .map((value) => Number(value))
      .filter(Number.isFinite);
    return candidates.length ? Math.max(best, ...candidates) : best;
  }, 0);
  return Math.max(1, maxNumber + 1);
};

export const setSurfaceZoneProfile = (zones, zoneId, surfaceKey) =>
  zones.map((zone) =>
    zone.id === zoneId ? { ...zone, surfaceKey } : zone
  );

export const setSurfaceZoneClosed = (zones, zoneId, closed) =>
  zones.map((zone) => (zone.id === zoneId ? { ...zone, closed } : zone));

export const removeSurfaceZoneState = ({
  zones,
  zoneId,
  activeZoneId,
  fallbackSurfaceKey,
}) => {
  const remaining = zones.filter((zone) => zone.id !== zoneId);
  if (!remaining.length) {
    const fallback = createSurfaceZoneDraft(1, fallbackSurfaceKey);
    return {
      zones: [fallback],
      activeZoneId: fallback.id,
      activeSurfaceKey: fallback.surfaceKey,
      nextZoneNumber: 2,
    };
  }
  const activeZone =
    remaining.find((zone) => zone.id === activeZoneId) || remaining[0];
  return {
    zones: remaining,
    activeZoneId: activeZone.id,
    activeSurfaceKey: activeZone.surfaceKey,
    nextZoneNumber: deriveNextSurfaceZoneNumber(remaining),
  };
};

export const buildSurfaceZonePayload = (surfaceZones) => ({
  type: "surface_zones",
  zones: (Array.isArray(surfaceZones) ? surfaceZones : [])
    .filter(
      (zone) =>
        zone?.closed !== false && Array.isArray(zone?.points) && zone.points.length >= 3
    )
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      surfaceKey: isSurfaceProfileKey(zone.surfaceKey)
        ? zone.surfaceKey
        : DEFAULT_SURFACE_PROFILE_KEY,
      points: zone.points.map((point) => ({ x: point.x, y: point.y })),
    })),
});
