import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlannerRouteControlsSection from "./PlannerRouteControlsSection";

describe("PlannerRouteControlsSection", () => {
  it("renders route actions without manual algorithm parameters", () => {
    const html = renderToStaticMarkup(
      <PlannerRouteControlsSection
        hasRoute
        isOptimizing={false}
        onAddRandomObstacle={vi.fn()}
        onOptimizeRoute={vi.fn()}
        onSendRoute={vi.fn()}
        routeLength={12.5}
      />
    );
    expect(html).not.toContain("Параметры алгоритма");
    expect(html.indexOf("Построить маршрут")).toBeLessThan(html.indexOf("Отправить маршрут"));
    expect(html).toContain("12.50 м");
  });

  it.each([
    [{status: "persisted", feedbackFresh: false}, "Остановить маршрут"],
    [{status: "persisted"}, "Ожидаем подтверждения контроллера"],
    [{status: "running", feedbackFresh: true}, "Робот выполняет маршрут"],
    [{status: "cancelled", feedbackFresh: false}, "Можно отправить новый"],
  ])("shows controller confirmation and recovery instructions for %o", (mission, text) => {
    const html = renderToStaticMarkup(<PlannerRouteControlsSection mission={mission} />);
    expect(html).toContain('role="status"');
    const status = html.match(/<p role="status"[^>]*>(.*?)<\/p>/)[1];
    expect(status).toContain(text);
  });
});
