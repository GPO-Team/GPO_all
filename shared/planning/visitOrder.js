const EPS = 1e-9;
const euclidean = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Numbered visits form a fixed subsequence. Free visits may occupy any gap.
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
  if (
    free.length <= 14 &&
    (ordered.length + 1) * (free.length + 1) * 2 ** free.length <= 400000
  ) {
    const all = (1 << free.length) - 1,
      memo = new Map();
    const solve = (done, mask, last) => {
      if (done === ordered.length && mask === all)
        return { cost: closed ? cost(last, origin) : 0, next: -1 };
      const key = `${done}/${mask}/${last}`;
      if (memo.has(key)) return memo.get(key);
      let best = { cost: Infinity, next: -1, bit: -1 };
      const consider = (next, bit) => {
        const rest = solve(
          done + (bit < 0 ? 1 : 0),
          bit < 0 ? mask : mask | (1 << bit),
          next,
        );
        const candidate = cost(last, next) + rest.cost;
        if (candidate < best.cost - EPS) best = { cost: candidate, next, bit };
      };
      if (done < ordered.length) consider(ordered[done], -1);
      for (let bit = 0; bit < free.length; ++bit)
        if (!(mask & (1 << bit))) consider(free[bit], bit);
      memo.set(key, best);
      return best;
    };
    const first = solve(0, 0, origin),
      order = [];
    let done = 0,
      mask = 0,
      last = origin;
    while (order.length < points.length) {
      const next = solve(done, mask, last);
      if (next.next < 0) break;
      order.push(next.next);
      last = next.next;
      if (next.bit < 0) ++done;
      else mask |= 1 << next.bit;
    }
    return { order, length: first.cost, optimal: true };
  }
  // Bounded insertion plus relocation keeps the fixed subsequence intact.
  let route = [...ordered];
  const seedFree = seedOrder.filter((i) => free.includes(i));
  const pending = [...new Set([...seedFree, ...free])];
  for (const next of pending) {
    let best = Infinity,
      position = route.length;
    for (let i = 0; i <= route.length; ++i) {
      const left = i ? route[i - 1] : origin,
        right = i < route.length ? route[i] : closed ? origin : null;
      const delta =
        cost(left, next) +
        (right === null ? 0 : cost(next, right) - cost(left, right));
      if (delta < best - EPS) {
        best = delta;
        position = i;
      }
    }
    route.splice(position, 0, next);
  }
  for (let pass = 0; pass < 4; ++pass) {
    let improved = false;
    for (const next of free) {
      const current = route.indexOf(next),
        left = current ? route[current - 1] : origin,
        right =
          current + 1 < route.length
            ? route[current + 1]
            : closed
              ? origin
              : null;
      const removed =
        cost(left, next) +
        (right === null ? 0 : cost(next, right) - cost(left, right));
      const rest = route.filter((i) => i !== next);
      let best = removed,
        position = current;
      for (let i = 0; i <= rest.length; ++i) {
        const a = i ? rest[i - 1] : origin,
          b = i < rest.length ? rest[i] : closed ? origin : null;
        const delta =
          cost(a, next) + (b === null ? 0 : cost(next, b) - cost(a, b));
        if (delta < best - EPS) {
          best = delta;
          position = i;
        }
      }
      if (position !== current) {
        rest.splice(position, 0, next);
        route = rest;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return { order: route, length: length(route), optimal: false };
};
