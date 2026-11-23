// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePlannerUndo } from "./usePlannerUndo";

let root, container, api, clock, locked;

function Harness({ onEmpty, onLocked }) {
  const [points, setPoints] = useState([]);
  const [limitZones, setLimitZones] = useState([{ id: "zone-1" }]);
  const [activeLimitZoneId, setActiveLimitZoneId] = useState("zone-1");
  const [nextZoneNumber, setNextZoneNumber] = useState(2);
  const history = usePlannerUndo({
    points, limitZones, activeLimitZoneId, nextZoneNumber,
    now: () => clock,
    isEditingLocked: () => locked,
    onEmpty, onLocked,
    restore: (snapshot) => {
      setPoints(snapshot.points);
      setLimitZones(snapshot.limitZones);
      setActiveLimitZoneId(snapshot.activeLimitZoneId);
      setNextZoneNumber(snapshot.nextZoneNumber);
    },
  });
  useEffect(() => {
    api = { points, limitZones, activeLimitZoneId, setPoints, setLimitZones, setActiveLimitZoneId, setNextZoneNumber, ...history };
  }, [points, limitZones, activeLimitZoneId, history]);
  return null;
}

const step = async (change, ms = 1000) => {
  clock += ms;
  await act(async () => change());
};
const pressCtrlZ = async (target = window, init = {}) => act(async () => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, bubbles: true, ...init }));
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  clock = 0;
  locked = false;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("undoes point and zone edits step by step with Ctrl+Z", async () => {
  const onEmpty = vi.fn();
  await act(async () => root.render(<Harness onEmpty={onEmpty} />));
  await step(() => api.setPoints([{ x: 1, y: 1, kind: "visit" }]));
  await step(() => api.setPoints((previous) => [...previous, { x: 2, y: 2, kind: "free_visit" }]));
  await step(() => {
    api.setLimitZones([]);
    api.setActiveLimitZoneId("");
  });
  expect(api.limitZones).toEqual([]);

  await pressCtrlZ();
  expect(api.limitZones).toEqual([{ id: "zone-1" }]);
  expect(api.activeLimitZoneId).toBe("zone-1");
  expect(api.points).toHaveLength(2);
  await pressCtrlZ();
  expect(api.points).toEqual([{ x: 1, y: 1, kind: "visit" }]);
  await pressCtrlZ();
  expect(api.points).toEqual([]);
  await pressCtrlZ();
  expect(onEmpty).toHaveBeenCalledTimes(1);
});

it("treats a quick series of moves (dragging) as one step and also accepts the Russian layout", async () => {
  await act(async () => root.render(<Harness />));
  await step(() => api.setPoints([{ x: 0, y: 0 }]));
  for (let x = 1; x <= 5; ++x) await step(() => api.setPoints([{ x, y: 0 }]), x === 1 ? 1000 : 50);
  await pressCtrlZ(window, { key: "я" });
  expect(api.points).toEqual([{ x: 0, y: 0 }]);
});

it("ignores Ctrl+Z inside text fields and refuses to undo while editing is locked", async () => {
  const onLocked = vi.fn();
  await act(async () => root.render(<Harness onLocked={onLocked} />));
  await step(() => api.setPoints([{ x: 1, y: 1 }]));
  const input = document.createElement("input");
  container.append(input);
  await pressCtrlZ(input);
  expect(api.points).toEqual([{ x: 1, y: 1 }]);
  locked = true;
  await pressCtrlZ();
  expect(onLocked).toHaveBeenCalledTimes(1);
  expect(api.points).toEqual([{ x: 1, y: 1 }]);
  locked = false;
  await pressCtrlZ();
  expect(api.points).toEqual([]);
});
