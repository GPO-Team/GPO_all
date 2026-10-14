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
    task: kind === "visit" ? defaultPointTask : null,
  },
];

export const removePlannerPointsByKind = (points, kind) =>
  kind ? points.filter((point) => point.kind !== kind) : [];

export const removePlannerPoint = (points, pointIndex) =>
  points.filter((_, index) => index !== pointIndex);

export const updatePlannerPointTask = (points, pointIndex, task) =>
  points.map((point, index) =>
    index === pointIndex ? { ...point, task } : point
  );
