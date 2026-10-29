import { describe, expect, it } from "vitest";
import { buildSlots, placementReasons, rackCorners, racksOverlap } from "./layout.js";

const rack = {
  id: "rack-1",
  code: "A",
  name: "Стеллаж A",
  x: 2,
  y: 3,
  yaw: 0,
  bays: 2,
  placesPerBay: 2,
  bayWidth: 0.8,
  depth: 0.5,
  levels: [
    { supportZ: 0.1, clearHeight: 0.3, maxLoadKg: 5 },
    { supportZ: 0.5, clearHeight: 0.4, maxLoadKg: 3 },
  ],
};
const box = { width: 0.2, depth: 0.3, height: 0.2, massKg: 2 };

describe("warehouse rack geometry", () => {
  it("builds stable addresses and keeps the support plane separate from cargo centre", () => {
    const slots = buildSlots(rack);
    expect(slots).toHaveLength(8);
    const slot = slots.find((item) => item.bay === 2 && item.level === 2 && item.place === 1);
    expect(slot).toMatchObject({
      id: "rack-1:2:2:1",
      rackId: "rack-1",
      address: "A-02-02-01",
      width: 0.4,
      depth: 0.5,
      supportZ: 0.5,
      z: 0.5,
      robotAccess: "unverified",
      reservedBy: null,
    });
    expect(slot.x).toBeCloseTo(2.2);
    expect(slot.y).toBeCloseTo(3);
    expect(buildSlots({ ...rack, name: "Другое имя" }).map((item) => item.id)).toEqual(
      slots.map((item) => item.id),
    );
  });

  it("rotates cell centres and footprint around the rack centre", () => {
    const turned = { ...rack, yaw: Math.PI / 2 };
    const first = buildSlots(turned)[0];
    expect(first.x).toBeCloseTo(2);
    expect(first.y).toBeCloseTo(2.4);
    const corners = rackCorners(turned);
    expect(
      Math.max(...corners.map((point) => point.x)) - Math.min(...corners.map((point) => point.x)),
    ).toBeCloseTo(0.5);
    expect(
      Math.max(...corners.map((point) => point.y)) - Math.min(...corners.map((point) => point.y)),
    ).toBeCloseTo(1.6);
  });

  it("detects rotated intersections without blocking separated racks", () => {
    expect(racksOverlap(rack, { ...rack, id: "other", x: 2.4, yaw: Math.PI / 4 })).toBe(true);
    expect(racksOverlap(rack, { ...rack, id: "other", x: 5 })).toBe(false);
    expect(racksOverlap(rack, { ...rack, id: "other", x: 3.6 })).toBe(false);
  });
});

describe("preparing cargo placement", () => {
  it("accepts geometric fit while keeping robot access unverified", () => {
    const slot = buildSlots(rack)[0];
    expect(placementReasons(box, slot)).toEqual([]);
    expect(slot.robotAccess).toBe("unverified");
  });

  it("rejects missing horizontal and upper clearances, overload and reservations", () => {
    const slot = { ...buildSlots(rack)[0], reservedBy: "task-1" };
    const reasons = placementReasons({ width: 0.39, depth: 0.49, height: 0.3, massKg: 6 }, slot);
    expect(reasons).toHaveLength(5);
    expect(reasons.join(" ")).toMatch(/ширин/);
    expect(reasons.join(" ")).toMatch(/глубин/);
    expect(reasons.join(" ")).toMatch(/высот/);
    expect(reasons.join(" ")).toMatch(/нагруз|масс/);
    expect(reasons.join(" ")).toMatch(/резерв/);
  });

  it("allows exact specified clearance without silently rotating a box", () => {
    const slot = buildSlots(rack)[0];
    expect(placementReasons({ width: 0.38, depth: 0.48, height: 0.29, massKg: 5 }, slot)).toEqual(
      [],
    );
    expect(placementReasons({ ...box, width: 0.45, depth: 0.2 }, slot)).not.toEqual([]);
  });
});
