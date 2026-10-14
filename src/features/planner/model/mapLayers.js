export const MAP_LAYER_OPTIONS = [
  { key: "visits", label: "Точки посещения" },
  { key: "charges", label: "Станции зарядки" },
  { key: "zones", label: "Запретные зоны" },
  { key: "surfaces", label: "Покрытия" },
  { key: "route", label: "Маршрут" },
  { key: "robot", label: "Робот" },
  { key: "lidar", label: "Карта и след лидара" },
  { key: "camera", label: "Карта камеры" },
  { key: "grid", label: "Сетка" },
  { key: "axes", label: "Оси X/Y" },
];

export const createDefaultMapLayers = () => Object.fromEntries(
  MAP_LAYER_OPTIONS.map(({ key }) => [key, key !== "lidar"])
);

export const normalizeMapLayers = (raw) => Object.fromEntries(
  MAP_LAYER_OPTIONS.map(({ key }) => [key, typeof raw?.[key] === "boolean" ? raw[key] : key !== "lidar"])
);

export const isPointLayerVisible = (point, layers) =>
  layers?.[{ visit: "visits", free_visit: "visits", charge: "charges", limit: "zones" }[point.kind]] !== false;
