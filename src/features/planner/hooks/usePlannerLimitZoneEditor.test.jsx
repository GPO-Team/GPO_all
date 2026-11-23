// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { INITIAL_ZONE } from "../../../lib/plannerModel";
import { usePlannerLimitZoneEditor } from "./usePlannerLimitZoneEditor";

let root, container, api;

function Harness({ initialZones, initialPoints }) {
  const [limitZones, setLimitZones] = useState(initialZones);
  const [points, setPoints] = useState(initialPoints);
  const [activeLimitZoneId, setActiveLimitZoneId] = useState(initialZones[0]?.id || "");
  const [nextZoneNumber, setNextZoneNumber] = useState(initialZones.length + 1);
  const editor = usePlannerLimitZoneEditor({
    activeLimitZoneId, clearRouteState: vi.fn(), limitZones, nextZoneNumber, points,
    setActiveLimitZoneId, setActivePointKind: vi.fn(), setLimitZones, setNextZoneNumber,
    setPoints, setStatus: vi.fn(), zoneEntries: limitZones,
  });
  useEffect(() => {
    api = { ...editor, limitZones, points, activeLimitZoneId, nextZoneNumber };
  });
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => act(async () => root.unmount()));

it("removes the first zone and keeps the others", async () => {
  const zones = [INITIAL_ZONE, { id: "zone-2", name: "Зона 2", closed: false }];
  const points = [{ x: 1, y: 1, kind: "limit", zoneId: INITIAL_ZONE.id }, { x: 2, y: 2, kind: "limit", zoneId: "zone-2" }];
  await act(async () => root.render(<Harness initialZones={zones} initialPoints={points} />));
  await act(async () => api.removeZone(INITIAL_ZONE.id));
  expect(api.limitZones.map((zone) => zone.id)).toEqual(["zone-2"]);
  expect(api.points).toEqual([points[1]]);
  expect(api.activeLimitZoneId).toBe("zone-2");
});

it("removes the only zone completely and recreates one for the next zone point", async () => {
  const points = [{ x: 1, y: 1, kind: "limit", zoneId: INITIAL_ZONE.id }, { x: 3, y: 3, kind: "visit" }];
  await act(async () => root.render(<Harness initialZones={[INITIAL_ZONE]} initialPoints={points} />));
  await act(async () => api.removeZone(INITIAL_ZONE.id));
  expect(api.limitZones).toEqual([]);
  expect(api.points).toEqual([points[1]]);
  expect(api.activeLimitZoneId).toBe("");

  let created;
  await act(async () => {
    created = api.ensureLimitZone();
  });
  expect(created).toMatchObject({ id: "zone-2", name: "Зона 2", closed: false });
  expect(api.limitZones).toEqual([created]);
  expect(api.activeLimitZoneId).toBe("zone-2");
  expect(api.nextZoneNumber).toBe(3);
  expect(api.ensureLimitZone()).toBe(created);
});
