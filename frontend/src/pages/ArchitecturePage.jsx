import { Link } from "react-router";
import { evaluationResults } from "../content";

function Node({ title, subtitle, external }) {
  return (
    <li className={external ? "arch-node arch-node--external" : "arch-node"}>
      <span className="arch-node__title">{title}</span>
      {subtitle && <span className="arch-node__subtitle">{subtitle}</span>}
    </li>
  );
}

function Lane({ label, children }) {
  return (
    <section className="arch-lane" aria-label={label}>
      <h3 className="arch-lane__label">{label}</h3>
      {children}
    </section>
  );
}

function Connector({ text }) {
  return (
    <div className="arch-connector" aria-hidden="true">
      <span className="arch-connector__arrow">↓</span>
      {text && <span className="arch-connector__text">{text}</span>}
    </div>
  );
}

const PIPELINE = [
  ["Validate & normalize", "Bad input stops here"],
  ["Scam-pattern rules", "6 behaviour categories"],
  ["Approved records", "Links and numbers"],
  ["Community similarity", "Confirmed reports"],
  ["AI second opinion", "Redacted text only"],
  ["Online link checks", "Reputation and website age"],
  ["AnalysisResult", "Level, reasons, safer action"],
];

const DECISIONS = [
  ["A required lookup failed", "Check could not be completed"],
  ["Matches an approved suspicious record", "High concern"],
  ["3 or more different warning categories", "High concern"],
  ["1 or 2 warning categories", "Caution"],
  ["No warning categories, all lookups done", "No known warning signs"],
];

const percent = (value) => `${value.toFixed(1)}%`;

export default function ArchitecturePage() {
  return (
    <div className="container page-body">
      <header className="page-header">
        <h1 className="page-title">System architecture</h1>
        <p className="lead">
          How Scam Hunter checks a message, link or phone number, from the app to the final result.
        </p>
      </header>

      <div className="arch" role="group" aria-label="Scam Hunter architecture diagram">
        <Lane label="Clients">
          <ul className="arch-nodes">
            <Node title="Web app" subtitle="React + Vite" />
            <Node title="Mobile app" subtitle="React Native + Expo" />
          </ul>
        </Lane>

        <Connector text="HTTPS · JSON · token login" />

        <Lane label="Django REST API">
          <ul className="arch-nodes">
            <Node title="Check API" subtitle="/api/check/message · url · phone" />
            <Node title="Reports API" subtitle="/api/reports · alerts · stats" />
            <Node title="Accounts API" subtitle="Sign up · log in · log out" />
            <Node title="Django Admin" subtitle="Moderators review reports" />
          </ul>
        </Lane>

        <Connector text="Every check goes through one service" />

        <Lane label="Checking pipeline">
          <ol className="arch-pipeline">
            {PIPELINE.map(([title, subtitle], index) => (
              <li className="arch-step" key={title}>
                <span className="arch-step__number">{index + 1}</span>
                <span className="arch-node__title">{title}</span>
                <span className="arch-node__subtitle">{subtitle}</span>
              </li>
            ))}
          </ol>
        </Lane>

        <Connector text="Reads data and asks outside services" />

        <div className="arch-split">
          <Lane label="Our data (SQLite)">
            <ul className="arch-nodes">
              <Node title="Users" subtitle="Django accounts" />
              <Node title="Community reports" subtitle="Pending · approved · rejected" />
              <Node title="Reference records" subtitle="Approved links and numbers" />
            </ul>
          </Lane>
          <Lane label="Outside services (optional)">
            <ul className="arch-nodes">
              <Node external title="Groq AI" subtitle="openai/gpt-oss-20b" />
              <Node external title="Google Safe Browsing" subtitle="Phishing and malware" />
              <Node external title="URLhaus" subtitle="Malware websites" />
              <Node external title="RDAP" subtitle="Website age" />
            </ul>
          </Lane>
        </div>

        <Connector text="Approved reports feed future checks" />

        <Lane label="Community moderation loop">
          <ol className="arch-pipeline arch-pipeline--loop">
            <li className="arch-step"><span className="arch-node__title">Report submitted</span><span className="arch-node__subtitle">Status: Pending</span></li>
            <li className="arch-step"><span className="arch-node__title">Moderator reviews</span><span className="arch-node__subtitle">In Django Admin</span></li>
            <li className="arch-step"><span className="arch-node__title">Approved</span><span className="arch-node__subtitle">Rejected reports stop here</span></li>
            <li className="arch-step"><span className="arch-node__title">Reference record</span><span className="arch-node__subtitle">Used by every later check</span></li>
          </ol>
        </Lane>
      </div>

      <p className="muted small arch-legend">
        Dashed boxes are optional outside services. If one is not set up or fails, the result says so and never counts it as safe.
      </p>

      <section className="section section--tight" aria-labelledby="decision-title">
        <h2 id="decision-title" className="section-title">How the result is decided</h2>
        <table className="data-table">
          <thead>
            <tr><th scope="col">Situation</th><th scope="col">Result</th></tr>
          </thead>
          <tbody>
            {DECISIONS.map(([situation, result]) => (
              <tr key={situation}><td>{situation}</td><td><strong>{result}</strong></td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Each layer that finds something adds one warning category. The AI can add a warning but can never remove one.
        </p>
      </section>

      <section className="section section--tight" aria-labelledby="performance-title">
        <h2 id="performance-title" className="section-title">Detection performance</h2>
        <p className="muted">
          Measured on {evaluationResults.measuredOn} with <code>python manage.py evaluate_detector</code>. A message counts
          as detected when it gets Caution or High Concern.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Evaluation set</th>
                <th scope="col">Rules only: detected</th>
                <th scope="col">Rules only: false alarms</th>
                <th scope="col">Rules + AI: detected</th>
                <th scope="col">Rules + AI: false alarms</th>
              </tr>
            </thead>
            <tbody>
              {evaluationResults.sets.map((row) => (
                <tr key={row.name}>
                  <th scope="row">
                    {row.name}
                    <span className="data-table__note">{row.size}</span>
                  </th>
                  <td>{percent(row.rules.detected)}</td>
                  <td>{percent(row.rules.falseAlarms)}</td>
                  <td><strong>{percent(row.withAI.detected)}</strong></td>
                  <td>{percent(row.withAI.falseAlarms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          The main and holdout sets were used while improving the rules. The challenge set was written afterwards and
          never used for tuning, so it is the fairest measure of new scam wording.
        </p>
      </section>

      <Link to="/how-it-works" className="link-arrow">What each result means →</Link>
    </div>
  );
}
