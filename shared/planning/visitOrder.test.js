import { expect, it } from "vitest";
import { orderVisits } from "./visitOrder.js";

it("requires a robot anchor for a closed route", () => {
  expect(() =>
    orderVisits({
      points: [{ x: 1, y: 0 }],
      visitOrder: ["free"],
      closed: true,
    }),
  ).toThrow(/положение робота/);
});

it("preserves numbered visits even when reversing them is shorter", () => {
  const points = [
    { x: 8, y: 0 },
    { x: 2, y: 0 },
    { x: 5, y: 0 },
  ];
  const result = orderVisits({
    points,
    visitOrder: ["ordered", "ordered", "ordered"],
    anchor: { x: 0, y: 0 },
  });
  expect(result.order).toEqual([0, 1, 2]);
});
it("inserts free visits while preserving the numbered subsequence", () => {
  const points = [
    { x: 4, y: 0 },
    { x: 9, y: 0 },
    { x: 7, y: 0 },
    { x: 2, y: 0 },
  ];
  const result = orderVisits({
    points,
    visitOrder: ["ordered", "ordered", "free", "free"],
    anchor: { x: 0, y: 0 },
  });
  expect(result.order).toEqual([3, 0, 2, 1]);
  expect(result.optimal).toBe(true);
  expect(result.length).toBe(9);
});
it("uses safe path lengths rather than straight lines", () => {
  const points = [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const result = orderVisits({
    points,
    visitOrder: ["free", "free"],
    anchor: { x: 0, y: 0 },
    distance: (a, b) =>
      a.x === b.x
        ? 0
        : (a.x === 0 && b.x === 1) || (b.x === 0 && a.x === 1)
          ? 20
          : Math.abs(a.x - b.x),
  });
  expect(result.order).toEqual([1, 0]);
});
it("agrees with exhaustive search for mixed points, including return to the robot", () => {
  const points = [
    { x: 4, y: 1 },
    { x: 1, y: 3 },
    { x: -2, y: 0 },
    { x: 3, y: -2 },
    { x: 6, y: 4 },
  ];
  const kinds = ["ordered", "free", "free", "ordered", "free"];
  const anchor = { x: 0, y: 0 };
  const permutations = (xs) =>
    xs.length
      ? xs.flatMap((x, i) =>
          permutations(xs.filter((_v, j) => j !== i)).map((rest) => [
            x,
            ...rest,
          ]),
        )
      : [[]];
  for (const closed of [false, true]) {
    const cost = (order) => {
      const route = [
        anchor,
        ...order.map((i) => points[i]),
        ...(closed ? [anchor] : []),
      ];
      return route
        .slice(1)
        .reduce(
          (sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y),
          0,
        );
    };
    const best = Math.min(
      ...permutations([0, 1, 2, 3, 4])
        .filter((order) => order.indexOf(0) < order.indexOf(3))
        .map(cost),
    );
    const result = orderVisits({ points, visitOrder: kinds, anchor, closed });
    expect(result.length).toBeCloseTo(best, 8);
  }
});
it("scales to 100 visits without changing numbered order or losing free visits", () => {
  const points = Array.from({ length: 100 }, (_, i) => ({
    x: 10 * Math.cos(i),
    y: 10 * Math.sin(i),
  }));
  const visitOrder = points.map((_p, i) => (i % 5 === 0 ? "ordered" : "free"));
  const result = orderVisits({ points, visitOrder, anchor: { x: 0, y: 0 } });
  expect(result.order.filter((i) => visitOrder[i] === "ordered")).toEqual(
    points.map((_p, i) => i).filter((i) => i % 5 === 0),
  );
  expect([...result.order].sort((a, b) => a - b)).toEqual(
    points.map((_p, i) => i),
  );
  expect(result.optimal).toBe(false);
});
