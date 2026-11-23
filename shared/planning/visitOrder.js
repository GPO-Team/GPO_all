const EPS = 1e-9;
const euclidean = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Numbered visits form a fixed prefix. Free visits follow them in the shortest order.
export const orderVisits = ({
  points,
  visitOrder,
  anchor = null,
  closed = false,
  distance = euclidean,
  seedOrder = [],
}) => {
  if (closed && !anchor)
    throw new Error("Для замкнутого маршрута укажите положение робота.");
  if (
    !Array.isArray(visitOrder) ||
    visitOrder.length !== points.length ||
    visitOrder.some((kind) => !["ordered", "free"].includes(kind))
  )
    throw new Error("Для каждой точки требуется порядок ordered или free.");
  const ordered = [],
    free = [];
  visitOrder.forEach((kind, i) =>
    (kind === "ordered" ? ordered : free).push(i),
  );
  const origin = points.length;
  const cache = new Map();
  const cost = (a, b) => {
    if (a === b || (a === origin && !anchor) || (b === origin && !anchor))
      return 0;
    const key = a * (points.length + 1) + b;
    if (!cache.has(key))
      cache.set(
        key,
        distance(
          a === origin ? anchor : points[a],
          b === origin ? anchor : points[b],
        ),
      );
    return cache.get(key);
  };
  const length = (route) => {
    let total = 0,
      last = origin;
    for (const next of route) {
      total += cost(last, next);
      last = next;
    }
    return total + (closed ? cost(last, origin) : 0);
  };
  if (!free.length)
    return { order: ordered, length: length(ordered), optimal: true };
  // Numbered visits have priority: the robot drives V1, V2, ... first, then
  // visits the free points along the shortest tail from the last numbered one.
  const start = ordered.length ? ordered[ordered.length - 1] : origin;
  const finish = closed ? origin : null;
  const edge = (a, b) => (b === null ? 0 : cost(a, b));
  const insertionDelta = (tail, next, i) => {
    const left = i ? tail[i - 1] : start,
      right = i < tail.length ? tail[i] : finish;
    return edge(left, next) + edge(next, right) - edge(left, right);
  };
  if (free.length <= 14 && free.length * 2 ** free.length <= 400000) {
    const all = (1 << free.length) - 1,
      memo = new Map();
    const solve = (mask, last) => {
      if (mask === all) return { cost: edge(last, finish), bit: -1 };
      const key = mask * (points.length + 1) + last;
      if (memo.has(key)) return memo.get(key);
      let best = { cost: Infinity, bit: -1 };
      for (let bit = 0; bit < free.length; ++bit) {
        if (mask & (1 << bit)) continue;
        const candidate =
          cost(last, free[bit]) + solve(mask | (1 << bit), free[bit]).cost;
        if (candidate < best.cost - EPS) best = { cost: candidate, bit };
      }
      memo.set(key, best);
      return best;
    };
    const tail = [];
    let mask = 0,
      last = start;
    while (mask !== all) {
      const { bit } = solve(mask, last);
      if (bit < 0) break;
      tail.push(free[bit]);
      mask |= 1 << bit;
      last = free[bit];
    }
    const order = [...ordered, ...tail];
    return { order, length: length(order), optimal: true };
  }
  // Bounded insertion plus relocation inside the free tail.
  let tail = [];
  const seedFree = seedOrder.filter((i) => free.includes(i));
  for (const next of [...new Set([...seedFree, ...free])]) {
    let best = Infinity,
      position = tail.length;
    for (let i = 0; i <= tail.length; ++i) {
      const delta = insertionDelta(tail, next, i);
      if (delta < best - EPS) {
        best = delta;
        position = i;
      }
    }
    tail.splice(position, 0, next);
  }
  for (let pass = 0; pass < 4; ++pass) {
    let improved = false;
    for (const next of free) {
      const current = tail.indexOf(next);
      const rest = tail.filter((i) => i !== next);
      let best = insertionDelta(rest, next, current),
        position = current;
      for (let i = 0; i <= rest.length; ++i) {
        const delta = insertionDelta(rest, next, i);
        if (delta < best - EPS) {
          best = delta;
          position = i;
        }
      }
      if (position !== current) {
        rest.splice(position, 0, next);
        tail = rest;
        improved = true;
      }
    }
    if (!improved) break;
  }
  const order = [...ordered, ...tail];
  return { order, length: length(order), optimal: false };
};
