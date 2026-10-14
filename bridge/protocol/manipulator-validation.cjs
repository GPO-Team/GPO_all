const { serviceError } = require("./service-contract.cjs");
const validatePickPlace = payload => {
  if (typeof payload?.objectDef !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(payload.objectDef)) {
    throw serviceError(400, "invalid_object", "Object DEF must be a valid Webots identifier.");
  }
  const target = payload.destination;
  if (!target || ["x", "y", "z"].some(key => typeof target[key] !== "number" || !Number.isFinite(target[key])) ||
      Math.abs(target.x) > 22 || Math.abs(target.y) > 17 || target.z < 0.015 || target.z > 1) {
    throw serviceError(400, "invalid_target", "Destination must contain finite world coordinates in metres (z: 0.015–1).");
  }
  return { type: "pick_place", objectDef: payload.objectDef, destination: { x: target.x, y: target.y, z: target.z } };
};
module.exports = { validatePickPlace };
