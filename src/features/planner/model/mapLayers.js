export const MAP_LAYER_OPTIONS = [
  { key: "visits", label: "Точки посещения" },
  { key: "charges", label: "Станции зарядки" },
  { key: "zones", label: "Запретные зоны" },
  { key: "runtimeObstacles", label: "Препятствия Webots" },
  { key: "surfaces", label: "Покрытия" },
  { key: "route", label: "Маршрут" },
  { key: "robot", label: "Робот" },
  { key: "lidar", label: "Карта лидара" },
  { key: "lidarTrace", label: "След лидара" },
  { key: "grid", label: "Сетка" },
  { key: "axes", label: "Оси X/Y" },
  { key: "axisLabels", label: "Разметка осей" },
];

export const createDefaultMapLayers = () => Object.fromEntries(
  MAP_LAYER_OPTIONS.map(({ key }) => [key, true])
);

export const normalizeMapLayers = (raw) => Object.fromEntries(
  MAP_LAYER_OPTIONS.map(({ key }) => [key, typeof raw?.[key] === "boolean" ? raw[key] : key === "lidarTrace" && typeof raw?.lidar === "boolean" ? raw.lidar : true])
);

export const isPointLayerVisible = (point, layers) =>
  layers?.[{ visit: "visits", charge: "charges", limit: "zones" }[point.kind]] !== false;
