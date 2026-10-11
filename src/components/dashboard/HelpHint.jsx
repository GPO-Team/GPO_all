import { useId, useState } from "react";

export default function HelpHint({ label, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="help-hint">
    <button type="button" aria-label={`Справка: ${label}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="help-trigger">?</button>
    {open && <span id={id} className="help-content">{children}</span>}
  </span>;
}
