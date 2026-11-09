import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { checkContent } from "../api";
import EvidenceCard from "./EvidenceCard";

// Change the form based on what the user wants to check.
const CHECK_TYPES = {
  MESSAGE: {
    tab: "Message",
    title: "Check a Message",
    hint: "Paste the message below.",
    label: "Message to check",
    placeholder: "Paste the suspicious message here",
    button: "Check Message",
    emptyError: "Please enter a message before checking.",
  },
  URL: {
    tab: "URL",
    title: "Check a URL",
    hint: "Enter the suspicious link.",
    label: "Link to check",
    placeholder: "https://example.com",
    button: "Check URL",
    emptyError: "Please enter a URL before checking.",
    inputMode: "url",
  },
  PHONE: {
    tab: "Phone Number",
    title: "Check a Phone Number",
    hint: "Include the country code if you know it.",
    label: "Phone number to check",
    placeholder: "+250 7XX XXX XXX",
    button: "Check Number",
    emptyError: "Please enter a phone number before checking.",
    inputMode: "tel",
  },
};

const TYPE_ORDER = ["MESSAGE", "URL", "PHONE"];

export default function CheckPanel({ initialType = "MESSAGE", titleTag: Title = "h3" }) {
  const [type, setType] = useState(CHECK_TYPES[initialType] ? initialType : "MESSAGE");
  // Each tab keeps its own text, so switching tabs doesn't lose what was typed.
  const [values, setValues] = useState({ MESSAGE: "", URL: "", PHONE: "" });
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [checkedValue, setCheckedValue] = useState("");

  const id = useId();
  const inputRef = useRef(null);
  const resultRef = useRef(null);
  const tabRefs = useRef({});
  const navigate = useNavigate();

  const config = CHECK_TYPES[type];
  const value = values[type];

  // Move focus to the result so keyboard and screen reader users land on it.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function selectType(next) {
    setType(next);
    setFieldError("");
    setError("");
    setResult(null);
  }

  function handleTabKeys(event) {
    const index = TYPE_ORDER.indexOf(type);
    let next = null;
    if (event.key === "ArrowRight") next = TYPE_ORDER[(index + 1) % TYPE_ORDER.length];
    if (event.key === "ArrowLeft") next = TYPE_ORDER[(index + TYPE_ORDER.length - 1) % TYPE_ORDER.length];
    if (event.key === "Home") next = TYPE_ORDER[0];
    if (event.key === "End") next = TYPE_ORDER[TYPE_ORDER.length - 1];
    if (!next) return;
    event.preventDefault();
    selectType(next);
    tabRefs.current[next]?.focus();
  }

  async function runCheck() {
    setFieldError("");
    setError("");
    setResult(null);

    // Quick check before calling the server. The server still validates everything itself.
    if (!value.trim()) {
      setFieldError(config.emptyError);
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    const response = await checkContent(type, value);
    setLoading(false);

    if (response.result) {
      setResult(response.result);
      setCheckedValue(value.trim());
    } else if (response.fieldError) {
      setFieldError(response.fieldError);
      inputRef.current?.focus();
    } else {
      setError(response.error);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runCheck();
  }

  function checkAnother() {
    setValues((current) => ({ ...current, [type]: "" }));
    setResult(null);
    inputRef.current?.focus();
  }

  function reportThis() {
    // Normal checks stay temporary. The content is stored only if the user submits the report form.
    navigate("/report", { state: { draft: { type, content: checkedValue } } });
  }

  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const inputProps = {
    id: inputId,
    ref: inputRef,
    className: "input",
    value,
    placeholder: config.placeholder,
    onChange: (event) => setValues((current) => ({ ...current, [type]: event.target.value })),
    "aria-invalid": fieldError ? true : undefined,
    "aria-describedby": fieldError ? `${hintId} ${errorId}` : hintId,
  };

  return (
    <div className="checker">
      <div role="tablist" aria-label="What do you want to check?" className="tabs">
        {TYPE_ORDER.map((option) => (
          <button
            key={option}
            ref={(element) => (tabRefs.current[option] = element)}
            type="button"
            role="tab"
            id={`${id}-tab-${option}`}
            aria-selected={option === type}
            aria-controls={`${id}-panel`}
            tabIndex={option === type ? 0 : -1}
            className="tab"
            disabled={loading}
            onClick={() => selectType(option)}
            onKeyDown={handleTabKeys}
          >
            {CHECK_TYPES[option].tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${type}`} className="checker__body">
        <form onSubmit={handleSubmit} noValidate>
          <Title className="checker__title">{config.title}</Title>
          <p className="checker__hint" id={hintId}>{config.hint}</p>

          <div className="field">
            <label htmlFor={inputId} className="visually-hidden">{config.label}</label>
            {type === "MESSAGE" ? (
              <textarea {...inputProps} rows={5} />
            ) : (
              <input
                {...inputProps}
                type={type === "PHONE" ? "tel" : "text"}
                inputMode={config.inputMode}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
            {fieldError && (
              <p className="field-error" id={errorId} role="alert">{fieldError}</p>
            )}
          </div>

          <div className="checker__footer">
            <button type="submit" className="btn btn--check" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Checking...
                </>
              ) : (
                config.button
              )}
            </button>
            <p className="checker__status" aria-live="polite">
              {loading ? "Reviewing the submitted content." : ""}
            </p>
          </div>
        </form>

        {error && (
          <div className="inline-error" role="alert">
            <p><strong>The check didn't run.</strong> {error}</p>
            <p className="small muted">This does not mean the content is safe.</p>
          </div>
        )}
      </div>

      {result && (
        <EvidenceCard
          ref={resultRef}
          result={result}
          checkType={type}
          onReport={reportThis}
          onCheckAnother={checkAnother}
          onTryAgain={runCheck}
        />
      )}
    </div>
  );
}
