const stages = new Set(["idle", "opening", "approaching", "descending", "closing", "lifting",
  "transferring", "lowering", "releasing", "retracting", "stowing", "completed", "failed", "cancelled", "driving_to_object", "carrying"]);
const text = value => typeof value === "string" ? value.slice(0, 128) : "";
const numbers = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite) ? [...value] : [];

export const normalizeManipulator = (raw, previous = null) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return previous;
  const position = raw.objectPosition;
  return {
    stage: stages.has(raw.stage) ? raw.stage : "idle",
    error: text(raw.error),
    missionId: text(raw.missionId),
    objectDef: text(raw.objectDef),
    active: raw.active === true,
    joints: numbers(raw.joints, 5),
    fingers: numbers(raw.fingers, 2),
    objectPosition: position && [position.x, position.y, position.z].every(Number.isFinite)
      ? { x: position.x, y: position.y, z: position.z } : null,
  };
};
