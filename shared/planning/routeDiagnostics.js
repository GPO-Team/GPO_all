import {
  findBlockingPolygon,
  isInsideTraversableMap,
  ROUTE_CLEARANCE_MARGIN,
  routeCrossesAnyLimitPolygon,
} from "./zonePlannerPolygons.js";
import { buildObstacleAwareRoute } from "./zonePlannerRouting.js";
const location = (point) => `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;

export const explainBlockedPoint = (
  point,
  polygons,
  label = "Точка посещения",
) => {
  if (!isInsideTraversableMap(point))
    return `${label} ${location(point)} слишком близко к границе рабочей карты. Переместите её внутрь карты с запасом для габаритов робота.`;
  const zone = findBlockingPolygon(point, polygons, ROUTE_CLEARANCE_MARGIN);
  if (zone)
    return `${label} ${location(point)} находится внутри запретной зоны «${zone.name || zone.id || "без названия"}» или ближе ${ROUTE_CLEARANCE_MARGIN.toFixed(2)} м к её границе. Робот не помещается с безопасным зазором. Переместите точку или измените границы зоны.`;
  return null;
};
export const explainRouteFailure = (points, polygons) => {
  for (const point of points) {
    const problem = explainBlockedPoint(point, polygons);
    if (problem) return problem;
  }
  for (let i = 1; i < points.length; ++i) {
    if (buildObstacleAwareRoute([points[i - 1], points[i]], polygons)) continue;
    const zones = polygons
      .filter((zone) =>
        routeCrossesAnyLimitPolygon([points[i - 1], points[i]], [zone]),
      )
      .map((zone) => `«${zone.name || zone.id || "без названия"}»`)
      .join(", ");
    return `Нет доступного пути от ${location(points[i - 1])} до ${location(points[i])}${zones ? ` из-за зон ${zones}` : " при текущих ограничениях"}. Проход перекрыт или уже безопасного зазора ${ROUTE_CLEARANCE_MARGIN.toFixed(2)} м. Расширьте проход, измените зоны либо положение точки.`;
  }
  return "Не удалось провести маршрут с безопасным зазором для робота. Проверьте границы карты, запретные зоны и ширину проходов.";
};
