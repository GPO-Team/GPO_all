export const findPointIndexAtCanvasPosition = (
  points,
  canvasPoint,
  toCanvas,
  hitRadius,
  isVisible = () => true
) => {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (!isVisible(points[index])) continue;
    const rendered = toCanvas(points[index]);
    if (
      Math.hypot(rendered.x - canvasPoint.x, rendered.y - canvasPoint.y) <=
      hitRadius
    ) {
      return index;
    }
  }
  return -1;
};

export const movePlannerPoint = (points, pointIndex, nextPoint) =>
  points.map((point, index) =>
    index === pointIndex ? { ...point, x: nextPoint.x, y: nextPoint.y } : point
  );

export const appendPlannerPoint = (
  points,
  point,
  kind,
  activeLimitZoneId,
  defaultPointTask
) => [
  ...points,
  {
    ...point,
    kind,
    zoneId: kind === "limit" ? activeLimitZoneId : null,
    task: ["visit","free_visit"].includes(kind) ? defaultPointTask : null,
  },
];

export const removePlannerPointsByKind = (points, kind) =>
  kind ? points.filter((point) => kind === "visit" ? !["visit","free_visit"].includes(point.kind) : point.kind !== kind) : [];

const VISIT_KINDS = ["visit", "free_visit"];

// The order mode applies to every visit point, so switching it converts all of them.
export const setVisitPointsKind = (points, kind) =>
  VISIT_KINDS.includes(kind)
    ? points.map((point) => VISIT_KINDS.includes(point.kind) && point.kind !== kind ? { ...point, kind } : point)
    : points;

export const removePlannerPoint = (points, pointIndex) =>
  points.filter((_, index) => index !== pointIndex);

export const updatePlannerPointTask = (points, pointIndex, task) =>
  points.map((point, index) =>
    index === pointIndex ? { ...point, task } : point
  );
