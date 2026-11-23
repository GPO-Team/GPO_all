const bounds = require("../../shared/world-bounds.json");

const warehouseError = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });
const invalid = (message) => {
  throw warehouseError(400, "invalid_warehouse", message);
};
const object = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(`${label}: требуется объект.`);
  return value;
};
const text = (value, label, max = 200) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    invalid(`${label}: непустой текст длиной до ${max} символов.`);
  return value.trim();
};
const identifier = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,63}$/.test(value))
    invalid("ID: от 1 до 63 латинских букв, цифр, _ или -.");
  return value;
};
const number = (value, label, minimum, maximum, inclusive = true) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (inclusive ? value < minimum : value <= minimum) ||
    value > maximum
  )
    invalid(`${label}: число в допустимом диапазоне.`);
  return value;
};
const count = (value, label, maximum) => {
  if (!Number.isInteger(value)) invalid(`${label}: требуется целое число.`);
  return number(value, label, 1, maximum);
};
const coordinate = (value, label, size) => number(value, label, -size / 2, size / 2);
const validateRack = (value) => {
  object(value, "Стеллаж");
  if (!Array.isArray(value.levels) || value.levels.length < 1 || value.levels.length > 12)
    invalid("Требуется от 1 до 12 уровней.");
  const levels = value.levels.map((level) => {
    object(level, "Уровень");
    const result = {
      supportZ: number(level.supportZ, "Высота опоры", 0, 20),
      clearHeight: number(level.clearHeight, "Высота проёма", 0, 20, false),
      maxLoadKg: number(level.maxLoadKg, "Нагрузка", 0, 100000, false),
    };
    if (result.supportZ + result.clearHeight > 20)
      invalid("Высота стеллажа не должна превышать 20 м.");
    return result;
  });
  for (let i = 1; i < levels.length; i++) {
    if (
      levels[i].supportZ <= levels[i - 1].supportZ ||
      levels[i - 1].supportZ + levels[i - 1].clearHeight > levels[i].supportZ + 1e-9
    )
      invalid("Уровни должны идти по возрастанию, без пересечения проёмов.");
  }
  return {
    id: identifier(value.id),
    code: text(value.code, "Код", 32),
    name: text(value.name, "Название"),
    x: coordinate(value.x, "X", bounds.width),
    y: coordinate(value.y, "Y", bounds.height),
    yaw: number(value.yaw, "Поворот", -Math.PI * 2, Math.PI * 2),
    bays: count(value.bays, "Секции", 12),
    placesPerBay: count(value.placesPerBay, "Места в секции", 8),
    bayWidth: number(value.bayWidth, "Ширина секции", 0, bounds.width, false),
    depth: number(value.depth, "Глубина", 0, bounds.height, false),
    levels,
  };
};
const validateRacks = (values, geometry) => {
  if (!Array.isArray(values) || values.length > 20) invalid("Допускается не более 20 стеллажей.");
  const racks = values.map(validateRack);
  if (
    new Set(racks.map((rack) => rack.id)).size !== racks.length ||
    new Set(racks.map((rack) => rack.code)).size !== racks.length
  )
    invalid("ID и коды стеллажей должны быть уникальны.");
  if (
    racks.reduce((total, rack) => total + rack.bays * rack.placesPerBay * rack.levels.length, 0) >
    1000
  )
    invalid("Допускается не более 1000 ячеек.");
  racks.forEach((rack, index) => {
    if (
      geometry
        .rackCorners(rack)
        .some(
          (point) =>
            Math.abs(point.x) > bounds.width / 2 + 1e-9 ||
            Math.abs(point.y) > bounds.height / 2 + 1e-9,
        )
    )
      invalid("Стеллаж выходит за границы склада.");
    if (racks.slice(0, index).some((other) => geometry.racksOverlap(rack, other)))
      invalid("Стеллажи пересекаются.");
  });
  return racks;
};
const validateStations = (values) => {
  if (!Array.isArray(values) || values.length !== 2) invalid("Необходимы зоны приёмки и отгрузки.");
  const stations = values.map((value) => {
    object(value, "Зона");
    if (!["receiving", "shipping"].includes(value.id) || value.kind !== value.id)
      invalid("Некорректный ID или тип зоны.");
    return {
      id: value.id,
      kind: value.kind,
      name: text(value.name, "Название зоны"),
      x: coordinate(value.x, "X зоны", bounds.width),
      y: coordinate(value.y, "Y зоны", bounds.height),
    };
  });
  if (new Set(stations.map((station) => station.id)).size !== 2) invalid("Необходимы обе зоны.");
  return stations;
};
const validateCargo = (value) => {
  object(value, "Груз");
  if (value.locationId !== undefined && value.locationId !== "receiving")
    invalid("Груз регистрируется только в зоне приёмки.");
  return {
    id: identifier(value.id),
    label: text(value.label, "Название груза"),
    width: number(value.width, "Ширина груза", 0, bounds.width, false),
    depth: number(value.depth, "Глубина груза", 0, bounds.height, false),
    height: number(value.height, "Высота груза", 0, 20, false),
    massKg: number(value.massKg, "Масса груза", 0, 100000, false),
    locationId: "receiving",
  };
};
const checkRevision = (expected, revision) => {
  if (!Number.isSafeInteger(expected) || expected < 0)
    invalid("expectedRevision: требуется неотрицательное целое число.");
  if (expected !== revision)
    throw warehouseError(409, "revision_conflict", "Склад изменился. Обновите данные.");
};
module.exports = {
  warehouseError,
  invalid,
  object,
  identifier,
  validateRacks,
  validateStations,
  validateCargo,
  checkRevision,
};
