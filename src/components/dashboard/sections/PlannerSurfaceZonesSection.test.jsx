import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlannerSurfaceZonesSection from "./PlannerSurfaceZonesSection";

describe("PlannerSurfaceZonesSection", () => {
  it("renders surface zones and active runtime information", () => {
    const zone = { id: "surface-1", name: "Западный участок", surfaceKey: "rough", closed: true, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] };
    const html = renderToStaticMarkup(
      <PlannerSurfaceZonesSection
        activeSurfaceZoneId={zone.id}
        cruiseSpeedInput="0.4"
        cruiseSpeedMps={0.4}
        onSurfaceProfileChange={vi.fn()}
        onClearAllSurfaceZones={vi.fn()}
        onClearSurfaceZone={vi.fn()}
        onCreateSurfaceZone={vi.fn()}
        onRemoveSurfaceZone={vi.fn()}
        onSelectSurfaceZone={vi.fn()}
        onToggleSurfaceZoneClosed={vi.fn()}
        payloadInput="10"
        payloadKg={10}
        surfaceZones={[zone]}
      />
    );
    expect(html).toContain("Покрытия карты");
    expect(html).toContain("Замкнутых контуров: 1");
    expect(html).toContain("Шероховатое покрытие");
    expect(html).not.toContain("Западный участок");
  });
});
