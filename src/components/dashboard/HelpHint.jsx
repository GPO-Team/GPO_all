import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const getPopoverPosition = (trigger) => {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(340, window.innerWidth - 24);
  const below = window.innerHeight - rect.bottom - 20;
  const above = rect.top - 20;
  const showAbove = below < 180 && above > below;
  return {
    width,
    left: Math.max(12, Math.min(rect.left - 12, window.innerWidth - width - 12)),
    ...(showAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    maxHeight: Math.max(80, showAbove ? above : below),
  };
};

export default function HelpHint({ label, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const reposition = () => setPosition(getPopoverPosition(triggerRef.current));
    const dismiss = (event) => {
      if (!triggerRef.current?.contains(event.target) && !contentRef.current?.contains(event.target)) setOpen(false);
    };
    const keydown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);
  return <span className="help-hint">
    <button ref={triggerRef} type="button" aria-label={`Справка: ${label}`} aria-expanded={open} aria-controls={id}
      onClick={(event) => {
        event.stopPropagation();
        setPosition(getPopoverPosition(event.currentTarget));
        setOpen(!open);
      }} className="help-trigger">?</button>
    {open && position && createPortal(
      <div ref={contentRef} id={id} role="note" aria-label={label} className="help-content" style={position}>
        <div className="help-title">{label}</div>
        {children}
      </div>, document.body
    )}
  </span>;
}
