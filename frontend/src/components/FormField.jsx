// Label, hint and error for one input, so every form shows errors the same way.
export default function FormField({ id, label, optional, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {children}
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">{error}</p>
      )}
    </div>
  );
}

// Props that link an input to its hint and error for screen readers.
export function describedBy(id, { hint, error }) {
  const ids = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids.length ? ids.join(" ") : undefined,
  };
}
