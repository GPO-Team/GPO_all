import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlannerSetupSection from "./PlannerSetupSection";

describe("PlannerSetupSection", () => {
  it("preserves overview, point mode and route selectors order", () => {
    const html = renderToStaticMarkup(
      <PlannerSetupSection
        activePointKind="visit"
        activeZoneName="Зона 1"
        adjustedVisitCount={1}
        algorithmKey="ga_tabu"
        chargeCount={2}
        onActivePointKindChange={vi.fn()}
        onAlgorithmChange={vi.fn()}
        onClearChargePoints={vi.fn()}
        onClearLimitPoints={vi.fn()}
        onClearVisitPoints={vi.fn()}
        onRouteTaskChange={vi.fn()}
        polygonCount={1}
        routeBlocked={false}
        routeTaskKey="tsp"
        status="готово"
        visitCount={3}
        zoneCount={4}
      />
    );
    expect(html).not.toContain("Добавить на карту");
    expect(html).toContain("Нажмите на карту, чтобы поставить точку.");
    expect(html).not.toContain("Задача маршрута");
    expect(html).toContain("Справка: Обозначения карты");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Красные точки — посещения");
  });
});
