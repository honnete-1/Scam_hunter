import { useId, useState } from "react";
import { indicatorLabels, subjectNames } from "../content";

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

export default function EvidenceCard({ result, checkType, onReport, onCheckAnother, onTryAgain, ref }) {
  const headingId = useId();
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

        {indicators.length > 0 && (
          <div className="evidence__section">
            <h4>Noticed before the check stopped</h4>
            <IndicatorList indicators={indicators} subject={subject} />
          </div>
        )}

        <SaferAction text={result.safer_action} />
        <div className="evidence__actions">
          <button type="button" className="btn btn--primary" onClick={onTryAgain}>Try Again</button>
          <button type="button" className="btn btn--secondary" onClick={onCheckAnother}>Check another</button>
        </div>
      </section>
    );
  }

  const level = LEVELS[result.concern_level];
  const isClear = result.concern_level === "NO_KNOWN_WARNING_SIGNS";

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

      {(indicators.length > 0 || result.reference_match) && (
        <div className="evidence__section">
          <h4>Why this result?</h4>
          <IndicatorList indicators={indicators} referenceMatch={result.reference_match} subject={subject} />
        </div>
      )}

      <SaferAction text={result.safer_action} />

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
