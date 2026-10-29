const buttonBase =
  "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
export const buttonClass = `${buttonBase} border-stone-300 bg-white text-slate-700 hover:border-orange-400 hover:bg-orange-50`;
export const primaryClass = `${buttonBase} !border-slate-900 !bg-slate-900 !text-white hover:!bg-slate-700`;

export function Button({ primary, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`${primary ? primaryClass : buttonClass} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, value, onChange, type = "number", ...props }) {
  return (
    <label className="block min-w-0 text-xs font-medium text-stone-600">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-stone-100"
        step={type === "number" ? "any" : undefined}
        {...props}
      />
    </label>
  );
}

export function Panel({ title, eyebrow, children, action, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
              {eyebrow}
            </p>
          )}
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
