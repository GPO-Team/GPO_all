const worldBounds = require("../../shared/world-bounds.json");
const { normalizeScene, sceneRevision } = require("./scene-validation.cjs");

const invalid = message => Object.assign(new Error(message), { statusCode: 400 });
const DESTINATION_CLEARANCE = 0.25;

const distanceToSegment = (point, left, right) => {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return Math.hypot(point.x - left.x, point.y - left.y);
  const ratio = Math.max(0, Math.min(1,
    ((point.x - left.x) * dx + (point.y - left.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (left.x + ratio * dx), point.y - (left.y + ratio * dy));
};

const pointNearPolygon = (point, polygon, clearance) => polygon.some((right, index) =>
  distanceToSegment(point, polygon[(index + polygon.length - 1) % polygon.length], right) < clearance
);

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
      destination.x < -halfWidth + DESTINATION_CLEARANCE ||
      destination.x > halfWidth - DESTINATION_CLEARANCE ||
      destination.y < -halfHeight + DESTINATION_CLEARANCE ||
      destination.y > halfHeight - DESTINATION_CLEARANCE) {
    throw invalid("Transfer destination is outside map bounds.");
  }
  const scene = normalizeScene(payload.scene);
  if (payload.sceneRevision !== sceneRevision(scene)) {
    throw invalid("Transfer scene revision does not match its scene snapshot.");
  }
  if (scene.polygons.some(polygon => pointInPolygon(destination, polygon.points))) {
    throw invalid("Transfer destination is inside a restricted zone.");
  }
  if (scene.polygons.some(polygon =>
    pointNearPolygon(destination, polygon.points, DESTINATION_CLEARANCE))) {
    throw invalid("Transfer destination is too close to a restricted zone.");
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
