const worldBounds = require("../../shared/world-bounds.json");
const { normalizeScene, sceneRevision } = require("./scene-validation.cjs");

const invalid = message => Object.assign(new Error(message), { statusCode: 400 });

const pointOnSegment = (point, left, right) => {
  const cross = (point.y - left.y) * (right.x - left.x) -
    (point.x - left.x) * (right.y - left.y);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (point.x - left.x) * (point.x - right.x) +
    (point.y - left.y) * (point.y - right.y);
  return dot <= 1e-9;
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const left = polygon[index];
    const right = polygon[previous];
    if (pointOnSegment(point, left, right)) return true;
    if ((left.y > point.y) !== (right.y > point.y) &&
        point.x < ((right.x - left.x) * (point.y - left.y)) / (right.y - left.y) + left.x) {
      inside = !inside;
    }
  }
  return inside;
};

const validateTransferCommand = payload => {
  if (!payload || payload.type !== "transfer_object") {
    throw invalid("Object transfer command is required.");
  }
  if (payload.objectId !== "demo-box") {
    throw invalid("Only demo-box is supported.");
  }
  if (typeof payload.destination?.x !== "number" || typeof payload.destination?.y !== "number") {
    throw invalid("Transfer destination requires numeric x and y coordinates.");
  }
  const destination = {
    x: Number(payload.destination?.x),
    y: Number(payload.destination?.y),
  };
  const halfWidth = worldBounds.width / 2;
  const halfHeight = worldBounds.height / 2;
  if (!Number.isFinite(destination.x) || !Number.isFinite(destination.y) ||
      destination.x < -halfWidth || destination.x > halfWidth ||
      destination.y < -halfHeight || destination.y > halfHeight) {
    throw invalid("Transfer destination is outside map bounds.");
  }
  const scene = normalizeScene(payload.scene);
  if (payload.sceneRevision !== sceneRevision(scene)) {
    throw invalid("Transfer scene revision does not match its scene snapshot.");
  }
  if (scene.polygons.some(polygon => pointInPolygon(destination, polygon.points))) {
    throw invalid("Transfer destination is inside a restricted zone.");
  }
  return {
    ...payload,
    objectId: "demo-box",
    destination,
    scene,
    sceneRevision: sceneRevision(scene),
  };
};

module.exports = { validateTransferCommand };
