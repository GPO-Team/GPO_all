import { useCallback, useEffect, useRef } from "react";

export const UNDO_HISTORY_LIMIT = 50;
// Changes closer together than this (dragging a point) form one undo step.
export const UNDO_COALESCE_MS = 400;

const isTextInput = (target) => {
  if (!target || typeof target !== "object") return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

export const isUndoShortcut = (event) =>
  (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey &&
  (event.code === "KeyZ" || String(event.key).toLowerCase() === "z");

// Undo history for the map graph: points (visits, chargers, zone vertices) and limit zones.
export const usePlannerUndo = ({
  points,
  limitZones,
  activeLimitZoneId,
  nextZoneNumber,
  restore,
  isEditingLocked = () => false,
  onLocked,
  onEmpty,
  now = Date.now,
}) => {
  const historyRef = useRef([]);
  const lastRef = useRef({ points, limitZones, activeLimitZoneId, nextZoneNumber });
  const lastChangeAtRef = useRef(0);
  const restoringRef = useRef(false);
  // Callbacks change on every render; keep the latest ones so `undo` stays stable.
  const callbacksRef = useRef({ restore, isEditingLocked, onLocked, onEmpty });
  useEffect(() => {
    callbacksRef.current = { restore, isEditingLocked, onLocked, onEmpty };
  });

  useEffect(() => {
    const previous = lastRef.current;
    lastRef.current = { ...previous, points, limitZones, nextZoneNumber };
    if (previous.points === points && previous.limitZones === limitZones && previous.nextZoneNumber === nextZoneNumber) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    const at = now();
    if (at - lastChangeAtRef.current > UNDO_COALESCE_MS) {
      historyRef.current = [...historyRef.current, previous].slice(-UNDO_HISTORY_LIMIT);
    }
    lastChangeAtRef.current = at;
  }, [points, limitZones, nextZoneNumber, now]);

  // Selecting a zone is not an edit, but an undo step should restore the selection.
  useEffect(() => {
    lastRef.current = { ...lastRef.current, activeLimitZoneId };
  }, [activeLimitZoneId]);

  const undo = useCallback(() => {
    const { restore, isEditingLocked, onLocked, onEmpty } = callbacksRef.current;
    if (isEditingLocked()) {
      onLocked?.();
      return false;
    }
    const snapshot = historyRef.current.at(-1);
    if (!snapshot) {
      onEmpty?.();
      return false;
    }
    historyRef.current = historyRef.current.slice(0, -1);
    restoringRef.current = true;
    lastChangeAtRef.current = 0;
    restore(snapshot);
    return true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isUndoShortcut(event) || isTextInput(event.target)) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  return { undo, canUndo: () => historyRef.current.length > 0 };
};
