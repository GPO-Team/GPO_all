import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlannerLimitZonesSection from "./PlannerLimitZonesSection";
import PlannerSurfaceZonesSection from "./PlannerSurfaceZonesSection";

describe("zone clearing", () => {
  it.each([{ points: [] }, { points: [{ x: 1, y: 2 }] }])("disables clearing only when a limit zone has no points: %j", ({ points }) => {
    const zone = { id: "zone-1", name: "Зона 1", points, closed: false, color: { badge: "bg-blue-500" } };
    const html = renderToStaticMarkup(<PlannerLimitZonesSection zoneEntries={[zone]} activeZone={zone} activeLimitZoneId={zone.id} />);
    expect(/<button[^>]*disabled[^>]*>Очистить зону<\/button>/.test(html)).toBe(points.length === 0);
  });
  it.each([{ points: [] }, { points: [{ x: 1, y: 2 }] }])("disables clearing only when a surface zone has no points: %j", ({ points }) => {
    const zone = { id: "surface-1", name: "Покрытие 1", surfaceKey: "concrete", points, closed: false };
    const html = renderToStaticMarkup(<PlannerSurfaceZonesSection surfaceZones={[zone]} activeSurfaceZone={zone} activeSurfaceZoneId={zone.id} />);
    expect(/<button[^>]*disabled[^>]*>Очистить зону<\/button>/.test(html)).toBe(points.length === 0);
  });
});
