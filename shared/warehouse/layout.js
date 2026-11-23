// Rack coordinates use metres, world X/Y and yaw in radians. Z is the support plane.
const EPSILON = 1e-9;
const HORIZONTAL_CLEARANCE = 0.01;
const UPPER_CLEARANCE = 0.01;

const worldPoint = (rack, x, y) => ({
  x: rack.x + Math.cos(rack.yaw) * x - Math.sin(rack.yaw) * y,
  y: rack.y + Math.sin(rack.yaw) * x + Math.cos(rack.yaw) * y,
});

export const rackCorners = (rack) => {
  const halfWidth = (rack.bays * rack.bayWidth) / 2;
  const halfDepth = rack.depth / 2;
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, y]) => worldPoint(rack, x, y));
};

export const buildSlots = (rack) => {
  const width = rack.bayWidth / rack.placesPerBay;
  const totalWidth = rack.bays * rack.bayWidth;
  const pad = (index) => String(index).padStart(2, "0");
  return rack.levels.flatMap((level, levelIndex) =>
    Array.from({ length: rack.bays }, (_, bayIndex) =>
      Array.from({ length: rack.placesPerBay }, (_, placeIndex) => {
        const bay = bayIndex + 1,
          tier = levelIndex + 1,
          place = placeIndex + 1;
        return {
          id: `${rack.id}:${bay}:${tier}:${place}`,
          rackId: rack.id,
          address: `${rack.code}-${pad(bay)}-${pad(tier)}-${pad(place)}`,
          bay,
          level: tier,
          place,
          width,
          depth: rack.depth,
          supportZ: level.supportZ,
          z: level.supportZ,
          clearHeight: level.clearHeight,
          maxLoadKg: level.maxLoadKg,
          ...worldPoint(
            rack,
            -totalWidth / 2 + bayIndex * rack.bayWidth + (placeIndex + 0.5) * width,
            0,
          ),
          robotAccess: "unverified",
          reservedBy: null,
        };
      }),
    ).flat(),
  );
};

export const placementReasons = (cargo, slot) => {
  const reasons = [];
  if (cargo.width + 2 * HORIZONTAL_CLEARANCE > slot.width + EPSILON)
    reasons.push("Недостаточно ширины с боковыми зазорами 1 см.");
  if (cargo.depth + 2 * HORIZONTAL_CLEARANCE > slot.depth + EPSILON)
    reasons.push("Недостаточно глубины с зазорами 1 см.");
  if (cargo.height + UPPER_CLEARANCE > slot.clearHeight + EPSILON)
    reasons.push("Недостаточно высоты: нужен верхний зазор 1 см.");
  if (cargo.massKg > slot.maxLoadKg + EPSILON)
    reasons.push("Масса превышает допустимую нагрузку ячейки.");
  if (slot.reservedBy) reasons.push("Ячейка зарезервирована другим заданием.");
  return reasons;
};

// Separating-axis test for rotated rectangles; boundary contact is not overlap.
export const racksOverlap = (left, right) => {
  const a = rackCorners(left),
    b = rackCorners(right);
  for (const yaw of [left.yaw, right.yaw]) {
    for (const axis of [
      [Math.cos(yaw), Math.sin(yaw)],
      [-Math.sin(yaw), Math.cos(yaw)],
    ]) {
      const projection = (points) => points.map((point) => point.x * axis[0] + point.y * axis[1]);
      const p = projection(a),
        q = projection(b);
      if (Math.max(...p) <= Math.min(...q) + EPSILON || Math.max(...q) <= Math.min(...p) + EPSILON)
        return false;
    }
  }
  return true;
};
