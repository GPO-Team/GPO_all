const { serviceError } = require("./service-contract.cjs");
const validDef = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value);
const validatePickPlace = payload => {
  const vision = payload?.source === "vision";
  const warehouse = payload?.source === "warehouse";
  if (vision || warehouse ? payload.objectDef !== undefined :
      payload?.source !== undefined ||
      !validDef(payload?.objectDef)) {
    throw serviceError(400, "invalid_object", "Select vision or provide a valid Webots DEF.");
  }
  const target = payload.destination;
  if (!target || ["x", "y", "z"].some(key => typeof target[key] !== "number" || !Number.isFinite(target[key])) ||
      Math.abs(target.x) > 22 || Math.abs(target.y) > 17 || target.z < 0.015 || target.z > 1) {
    throw serviceError(400, "invalid_target", "Destination must contain finite world coordinates in metres (z: 0.015–1).");
  }
  const source = vision || warehouse ? { source: payload.source } : { objectDef: payload.objectDef };
  const pickup = payload.pickup;
  if ((pickup !== undefined || warehouse) && (!(vision || warehouse) || !validDef(pickup?.objectDef) ||
      !Number.isFinite(pickup.x) || Math.abs(pickup.x) > 22 ||
      !Number.isFinite(pickup.y) || Math.abs(pickup.y) > 17 ||
      ((warehouse || pickup.z !== undefined) && (!Number.isFinite(pickup.z) || pickup.z < .015 || pickup.z > .30)) ||
      (pickup.supportDef !== undefined && (!warehouse || !validDef(pickup.supportDef)))))
    throw serviceError(400, "invalid_pickup", "Vision pickup requires an expected object and finite receiving coordinates.");
  if (target.supportDef !== undefined && (!vision || !pickup || !validDef(target.supportDef)))
    throw serviceError(400, "invalid_target", "A shelf requires a bound warehouse pickup and a valid support DEF.");
  return {
    type: "pick_place", ...source,
    ...(pickup ? { pickup: { objectDef: pickup.objectDef, x: pickup.x, y: pickup.y,
      ...(warehouse ? {z:pickup.z} : {}),
      ...(pickup.supportDef ? {supportDef:pickup.supportDef} : {}),
    } } : {}),
    destination: { x: target.x, y: target.y, z: target.z,
      ...(target.supportDef ? {supportDef:target.supportDef} : {}) },
  };
};
module.exports = { validatePickPlace };
