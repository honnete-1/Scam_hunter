import { useState } from "react";
import { NETWORK_ERROR, SERVER_ERROR, firstError, submitReport } from "../api";
import { useAuth } from "../auth";
import FormField, { describedBy } from "./FormField";

const REPORT_TYPES = [
  { value: "MESSAGE", label: "Message", hint: "Paste the message exactly as you received it." },
  { value: "URL", label: "URL", hint: "The full link, for example https://example.com/login." },
  { value: "PHONE", label: "Phone", hint: "The number that contacted you, with country code if you know it." },
];

export default function ReportForm({ draft, onSubmitted }) {
  const { forgetUser } = useAuth();
  const [reportType, setReportType] = useState(draft?.type || "MESSAGE");
  const [content, setContent] = useState(draft?.content || "");
  const [details, setDetails] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const typeHint = REPORT_TYPES.find((option) => option.value === reportType).hint;

  async function handleSubmit(event) {
    event.preventDefault();
    const newErrors = {};
    if (!content.trim()) newErrors.content = "Please enter the content you want to report.";
    // The checkbox makes storing the content a deliberate choice by the user.
    if (!understood) newErrors.understood = "Please confirm that you understand the report will be stored.";
    setErrors(newErrors);
    setFormError("");
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    const res = await submitReport({ reportType, content, details });
    setSubmitting(false);

    if (res.ok) {
      onSubmitted(res.data);
    } else if (res.kind === "validation") {
      setErrors({ content: firstError(res.data?.content), details: firstError(res.data?.details) });
      if (res.data?.report_type) setFormError("Please choose what kind of content you are reporting.");
    } else if (res.kind === "auth") {
      // The saved login is no longer valid, so the page will ask the user to log in again.
      forgetUser();
    } else {
      setFormError(res.kind === "network" ? NETWORK_ERROR : SERVER_ERROR);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      {formError && <div className="form-error" role="alert">{formError}</div>}

      <div className="field">
        <fieldset>
          <legend>Type</legend>
          <div className="segmented">
            {REPORT_TYPES.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="report-type"
                  value={option.value}
                  checked={reportType === option.value}
                  onChange={() => setReportType(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <FormField id="report-content" label="Content" hint={typeHint} error={errors.content}>
        {reportType === "MESSAGE" ? (
          <textarea
            {...describedBy("report-content", { hint: typeHint, error: errors.content })}
            className="input"
            rows={5}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        ) : (
          <input
            {...describedBy("report-content", { hint: typeHint, error: errors.content })}
            className="input"
            type={reportType === "PHONE" ? "tel" : "text"}
            autoComplete="off"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="report-details"
        label="Additional details"
        optional
        hint="For example, where you received it and what it asked you to do."
        error={errors.details}
      >
        <textarea
          {...describedBy("report-details", { hint: true, error: errors.details })}
          className="input"
          rows={3}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </FormField>

      <div className="field">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            aria-invalid={errors.understood ? true : undefined}
            aria-describedby={errors.understood ? "report-understood-error" : undefined}
          />
          <span>I understand this report will be stored and reviewed by a moderator.</span>
        </label>
        {errors.understood && (
          <p className="field-error" id="report-understood-error" role="alert">{errors.understood}</p>
        )}
      </div>

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
