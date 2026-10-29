const { normalizeScene } = require("../protocol/scene-validation.cjs");
const { prepareRoute } = require("./route-planning.cjs");
const {
  clampInt,
  normalizeNumber,
} = require("../protocol/number-normalization.cjs");
const {
  resolveAlgorithmKey,
  resolveTaskKey,
  sanitizeNativeParams,
} = require("../protocol/solver-validation.cjs");
const { validatePoints } = require("../protocol/route-validation.cjs");

const createPlanningService = ({ nativeSolver, maxConcurrentRuns = 2 }) => {
  let activeRuns = 0;

  const solve = async (request) => {
    const { unwrapPlanningRequest } =
      await import("../../shared/contracts/index.js");
    const payload =
      request?.type === "planning.request"
        ? unwrapPlanningRequest(request)
        : request;
    const points = validatePoints(payload?.points);
    const scene =
      payload?.scene === undefined ? null : normalizeScene(payload.scene);
    const anchor = payload?.anchor ? validatePoints([payload.anchor])[0] : null;
    const visitOrder = payload?.visitOrder;
    if (
      visitOrder !== undefined &&
      (!Array.isArray(visitOrder) ||
        visitOrder.length !== points.length ||
        visitOrder.some((kind) => !["ordered", "free"].includes(kind)))
    )
      throw Object.assign(
        new Error(
          "Для каждой точки требуется корректный тип порядка: ordered или free.",
        ),
        { statusCode: 400 },
      );
    if (visitOrder && !anchor)
      throw Object.assign(
        new Error(
          "Для смешанного маршрута укажите актуальное положение робота.",
        ),
        { statusCode: 400 },
      );
    const algorithm = resolveAlgorithmKey(payload?.algorithm?.key);
    const params = sanitizeNativeParams(algorithm, payload?.algorithm?.params);
    const task = resolveTaskKey(payload?.task);
    const seed = clampInt(normalizeNumber(payload?.seed, 1337), 1, 2147483647);
    if (activeRuns >= maxConcurrentRuns) {
      const error = new Error("Solver is busy. Try again shortly.");
      error.statusCode = 503;
      throw error;
    }

    activeRuns += 1;
    try {
      let solved;
      if (visitOrder) {
        const { orderVisits } =
          await import("../../shared/planning/visitOrder.js");
        const { createSafePathDistance } =
          await import("../../shared/planning/zonePlannerRouting.js");
        const { explainBlockedPoint, explainRouteFailure } =
          await import("../../shared/planning/routeDiagnostics.js");
        const polygons = scene?.polygons || [];
        let numberedVisit = 0;
        let freeVisit = 0;
        for (const [index, point] of points.entries()) {
          const label = visitOrder[index] === "ordered"
            ? `Точка V${++numberedVisit}`
            : `Свободная точка ${++freeVisit}`;
          const problem = explainBlockedPoint(point, polygons, label);
          if (problem)
            throw Object.assign(new Error(problem), { statusCode: 422 });
        }
        if (anchor) {
          const problem = explainBlockedPoint(anchor, polygons, "Робот");
          if (problem)
            throw Object.assign(new Error(problem), { statusCode: 422 });
        }
        const freeCount = visitOrder.filter((kind) => kind === "free").length;
        let seedOrder = [];
        if (freeCount > 14) {
          const proposal = await nativeSolver.run({
            points,
            algorithmKey: algorithm,
            params,
            taskKey: task,
            seed,
          });
          seedOrder = proposal.order;
        }
        const ordered = orderVisits({
          points,
          visitOrder,
          anchor,
          closed: task === "tsp",
          distance: createSafePathDistance(polygons),
          seedOrder,
        });
        if (
          !Number.isFinite(ordered.length) ||
          ordered.order.length !== points.length
        )
          throw Object.assign(
            new Error(
              explainRouteFailure(
                [...(anchor ? [anchor] : []), ...points],
                polygons,
              ),
            ),
            { statusCode: 422 },
          );
        const route = [
          ...(anchor ? [anchor] : []),
          ...ordered.order.map((i) => points[i]),
        ];
        if (task === "tsp") route.push(anchor || route[0]);
        solved = {
          route,
          order: ordered.order,
          length: ordered.length,
          closed: task === "tsp",
          visitOrdering: { optimal: ordered.optimal },
        };
      } else
        solved = await nativeSolver.run({
          points,
          algorithmKey: algorithm,
          params,
          taskKey: task,
          seed,
        });
      let prepared = {};
      if (scene) {
        let seedRoute = solved.route;
        if (task === "tsp" && anchor && !visitOrder) {
          const { rotateClosedRouteToNearestPoint } =
            await import("../../shared/planning/routeAnchor.js");
          seedRoute = rotateClosedRouteToNearestPoint(seedRoute, anchor);
        }
        prepared = await prepareRoute({ seedRoute, scene });
      }
      return {
        ok: true,
        task,
        algorithm,
        length: solved.length,
        closed: solved.closed,
        order: solved.order,
        route: solved.route,
        ...(solved.visitOrdering
          ? { visitOrdering: solved.visitOrdering }
          : {}),
        ...prepared,
      };
    } finally {
      activeRuns -= 1;
    }
  };

  return { solve };
};

module.exports = { createPlanningService };
