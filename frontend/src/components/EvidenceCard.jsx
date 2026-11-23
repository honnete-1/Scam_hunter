import { Link } from "react-router";
import { useId, useState } from "react";
import { indicatorLabels, languageName, subjectNames } from "../content";

const LEVELS = {
  HIGH_CONCERN: { label: "High concern", tone: "high" },
  CAUTION: { label: "Caution", tone: "caution" },
  NO_KNOWN_WARNING_SIGNS: { label: "No known warning signs", tone: "clear" },
};

function countText(count) {
  return `${count} warning sign${count === 1 ? "" : "s"} found`;
}

// The backend already sends one indicator per type, but I count types here too so the card matches the rules.
function distinctIndicators(indicators = []) {
  const seen = new Set();
  return indicators.filter((indicator) => {
    if (seen.has(indicator.type)) return false;
    seen.add(indicator.type);
    return true;
  });
}

const VISIBLE_FINDINGS = 3;

export function IndicatorList({ indicators, referenceMatch, subject }) {
  // Show the first few findings and let the user expand the rest, so the card stays short.
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = indicators.length - VISIBLE_FINDINGS;
  const visible = showAll ? indicators : indicators.slice(0, VISIBLE_FINDINGS);

  return (
    <>
      <ul className="findings">
        {referenceMatch && (
          <li className="finding">
            <span className="finding__title">Matches an approved suspicious record</span>
            <p className="finding__detail">
              This {subject} matches a record that moderators reviewed and approved as suspicious.
            </p>
          </li>
        )}
        {visible.map((indicator) => (
          <li className="finding" key={indicator.type}>
            <span className="finding__title">
              {indicatorLabels[indicator.type] || indicator.type.replaceAll("_", " ")}
            </span>
            <p className="finding__detail">{indicator.explanation}</p>
            {indicator.evidence && (
              <p className="finding__evidence">
                Found: <q>{indicator.evidence}</q>
              </p>
            )}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="btn btn--text show-more"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer" : `Show ${hiddenCount} more sign${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}
    </>
  );
}

export function SaferAction({ text }) {
  return (
    <div className="evidence__section">
      <h4>Safer action</h4>
      <div className="safer-action">
        <p>{text}</p>
      </div>
    </div>
  );
}

const CHECK_STATUS_TEXT = { COMPLETED: "Checked", NOT_CONFIGURED: "Not set up", UNAVAILABLE: "Couldn't run" };

// Lists every check behind the result, including the ones that could not run.
export function ChecksPerformed({ checks }) {
  const [open, setOpen] = useState(false);
  if (!checks || checks.length === 0) return null;
  return (
    <div className="evidence__section">
      <button type="button" className="btn btn--text show-more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide how we checked" : `How we checked (${checks.length} checks)`}
      </button>
      {open && (
        <ul className="checks">
          {checks.map((check) => (
            <li className="check-row" key={check.id}>
              <span className="check-row__label">{check.label}</span>
              <span className={`check-row__status check-row__status--${check.finding ? "finding" : check.status.toLowerCase()}`}>
                {check.finding ? "Found a warning" : CHECK_STATUS_TEXT[check.status] || check.status}
              </span>
              {check.detail && <p className="check-row__detail">{check.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The AI model's own scam-likelihood score. It is a second opinion: the concern level comes from all checks.
export function AIScore({ score }) {
  if (score === null || score === undefined) return null;
  const tone = score >= 70 ? "high" : score >= 40 ? "caution" : "clear";
  return (
    <div className={`score tone-${tone}`}>
      <div className="score__top">
        <span className="score__label">AI scam-likelihood score</span>
        <span className="score__value">{score}%</span>
      </div>
      <div
        className="score__bar"
        role="meter"
        aria-label="AI scam-likelihood score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className="score__fill" style={{ width: `${score}%` }} />
      </div>
      <p className="score__note">An AI second opinion. The result above is based on all the checks together.</p>
    </div>
  );
}

function Reputation({ reputation }) {
  if (!reputation || !reputation.approved_reports) return null;
  const count = reputation.approved_reports;
  return (
    <p className="reputation">
      Reported by {count} community member{count === 1 ? "" : "s"}
      {reputation.first_reported ? `, first on ${reputation.first_reported}` : ""}. Each report was checked by a moderator.
    </p>
  );
}

export default function EvidenceCard({ result, checkType, checkedValue, onReport, onCheckAnother, onTryAgain, ref }) {
  const headingId = useId();
  // Results for messages in another language come translated into it; this switches back to English.
  const [inEnglish, setInEnglish] = useState(false);
  const subject = subjectNames[checkType] || "content";
  const indicators = distinctIndicators(result.indicators);

  // I keep unavailable separate because a failed check should never look like a normal (or safe) result.
  if (result.status === "CHECK_UNAVAILABLE") {
    return (
      <section className="evidence tone-unavailable" ref={ref} tabIndex={-1} aria-labelledby={headingId}>
        <div className="evidence__band" aria-hidden="true" />
        <p className="status-pill">Check could not be completed</p>
        <h3 id={headingId} className="evidence__summary">
          The required reference check is currently unavailable.
        </h3>
        <p className="muted">This does not mean the content is safe.</p>
        <AIScore score={result.ai_score} />

        {indicators.length > 0 && (
          <div className="evidence__section">
            <h4>Noticed before the check stopped</h4>
            <IndicatorList indicators={indicators} subject={subject} />
          </div>
        )}

        <SaferAction text={result.safer_action} />
        <ChecksPerformed checks={result.checks} />
        <div className="evidence__actions">
          <button type="button" className="btn btn--primary" onClick={onTryAgain}>Try Again</button>
          <button type="button" className="btn btn--secondary" onClick={onCheckAnother}>Check another</button>
        </div>
      </section>
    );
  }

  const level = LEVELS[result.concern_level];
  const isClear = result.concern_level === "NO_KNOWN_WARNING_SIGNS";
  const english = inEnglish ? result.english : null;
  const saferAction = english ? english.safer_action : result.safer_action;

  let summary = "No configured warning indicators or approved suspicious record matches were found.";
  let detail = "This does not mean it is guaranteed to be safe.";
  if (result.concern_level === "HIGH_CONCERN") {
    summary = "This content contains several concerning signs.";
    detail = indicators.length > 0 ? countText(indicators.length) : "";
    if (result.reference_match && indicators.length === 0) {
      summary = `This ${subject} matches a record moderators approved as suspicious.`;
    }
  } else if (result.concern_level === "CAUTION") {
    summary = countText(indicators.length);
    detail = "";
  }

  return (
    <section className={`evidence tone-${level.tone}`} ref={ref} tabIndex={-1} aria-labelledby={headingId}>
      <div className="evidence__band" aria-hidden="true" />
      <p className="status-pill">
        <span className="visually-hidden">Result: </span>
        {level.label}
      </p>
      <h3 id={headingId} className="evidence__summary">{summary}</h3>
      {detail && <p className="muted">{detail}</p>}
      <Reputation reputation={result.reputation} />
      {result.english && (
        <div className="translated" lang={inEnglish ? "en" : result.language || undefined} aria-live="polite">
          <p className="translated__label">
            {inEnglish ? "In English" : `In ${languageName(result.language)}, the language of the message`}
          </p>
          <p className="translated__headline">{english ? english.headline : result.headline}</p>
          <p>{english ? english.explanation : result.explanation}</p>
          <button type="button" className="link-button" onClick={() => setInEnglish(!inEnglish)}>
            {inEnglish ? `Show in ${languageName(result.language)}` : "Show in English"}
          </button>
        </div>
      )}
      <AIScore score={result.ai_score} />

      {(indicators.length > 0 || result.reference_match) && (
        <div className="evidence__section">
          <h4>Why this result?</h4>
          <IndicatorList indicators={indicators} referenceMatch={result.reference_match} subject={subject} />
        </div>
      )}

      <SaferAction text={saferAction} />
      <ChecksPerformed checks={result.checks} />

      {checkType === "PHONE" && result.reference_match && (
        <p className="small muted removal-hint">
          Is this your number, reported by mistake?{" "}
          <Link to="/removal-request" state={{ phoneNumber: checkedValue }}>Ask a moderator to remove it</Link>
        </p>
      )}

      <div className="evidence__actions">
        {isClear ? (
          <>
            <button type="button" className="btn btn--primary" onClick={onCheckAnother}>Check another</button>
            <button type="button" className="btn btn--secondary" onClick={onReport}>Report this anyway</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary" onClick={onReport}>Report this</button>
            <button type="button" className="btn btn--secondary" onClick={onCheckAnother}>Check another</button>
          </>
        )}
      </div>
    </section>
  );
}
