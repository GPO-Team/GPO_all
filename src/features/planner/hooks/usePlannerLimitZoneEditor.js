import { INITIAL_ZONE } from "../../../lib/plannerModel";
import {
  createLimitZoneDraft,
  removeLimitZoneState,
  setLimitZoneClosed,
} from "../model/limitZoneEditor";

export const usePlannerLimitZoneEditor = ({
  activeLimitZoneId,
  clearRouteState,
  limitZones,
  nextZoneNumber,
  points,
  setActiveLimitZoneId,
  setActivePointKind,
  setLimitZones,
  setNextZoneNumber,
  setPoints,
  setStatus,
  zoneEntries,
}) => {
  const resetZones = () => {
    setLimitZones([INITIAL_ZONE]);
    setActiveLimitZoneId(INITIAL_ZONE.id);
    setNextZoneNumber(2);
  };

  const createZone = () => {
    const zone = createLimitZoneDraft(nextZoneNumber);
    setLimitZones((previous) => [...previous, zone]);
    setActiveLimitZoneId(zone.id);
    setNextZoneNumber((previous) => previous + 1);
    setActivePointKind("limit");
    setStatus(`Создана ${zone.name}.`);
  };

  const selectZone = (zoneId) => {
    setActiveLimitZoneId(zoneId);
    setActivePointKind("limit");
  };

  const toggleZoneClosed = (zoneId) => {
    const target = zoneEntries.find((zone) => zone.id === zoneId);
    if (!target) return;
    if (!target.closed && target.points.length < 3) {
      setStatus("Чтобы замкнуть зону, нужно минимум три точки.");
      return;
    }
    setLimitZones((previous) =>
      setLimitZoneClosed(previous, zoneId, !target.closed)
    );
    clearRouteState({ dropSolvedRoute: false });
    setStatus(
      target.closed
        ? `${target.name} открыта для редактирования.`
        : `${target.name} замкнута.`
    );
  };

  const clearZone = (zoneId) => {
    setPoints((previous) =>
      previous.filter(
        (point) => point.kind !== "limit" || point.zoneId !== zoneId
      )
    );
    setLimitZones((previous) => setLimitZoneClosed(previous, zoneId, false));
    clearRouteState({ dropSolvedRoute: false });
    setStatus("Точки выбранной зоны очищены.");
  };

  // Any zone can be removed, including the last one; the next limit point
  // placed on the map then creates a fresh zone (see ensureLimitZone).
  const removeZone = (zoneId) => {
    const next = removeLimitZoneState({
      zones: limitZones,
      points,
      zoneId,
      activeZoneId: activeLimitZoneId,
    });
    setLimitZones(next.zones);
    setPoints(next.points);
    setActiveLimitZoneId(next.activeZoneId);
    clearRouteState({ dropSolvedRoute: false });
    setStatus(
      next.zones.length
        ? "Ограничивающая зона удалена."
        : "Ограничивающая зона удалена. Новая зона появится при следующей точке зоны."
    );
  };

  const ensureLimitZone = () => {
    const current = zoneEntries.find((zone) => zone.id === activeLimitZoneId) || zoneEntries[0];
    if (current) return current;
    const zone = createLimitZoneDraft(nextZoneNumber);
    setLimitZones((previous) => [...previous, zone]);
    setActiveLimitZoneId(zone.id);
    setNextZoneNumber((previous) => previous + 1);
    return zone;
  };

  return { clearZone, createZone, ensureLimitZone, removeZone, resetZones, selectZone, toggleZoneClosed };
};
