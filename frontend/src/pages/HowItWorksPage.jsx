import { Link } from "react-router";
import HowSteps from "../components/HowSteps";

// These sentences describe the backend rules in checking/analysis_result.py. Keep them in sync.
const RESULTS = [
  {
    tone: "high",
    label: "High concern",
    text: "Three or more different warning signs were found, or the link or number matches a record moderators approved as suspicious.",
  },
  {
    tone: "caution",
    label: "Caution",
    text: "One or two warning signs were found. Slow down and verify before acting.",
  },
  {
    tone: "clear",
    label: "No known warning signs",
    text: "No configured warning signs or approved suspicious records were found. This is not a guarantee that it is safe.",
  },
  {
    tone: "unavailable",
    label: "Check could not be completed",
    text: "A required lookup failed, so no concern level is given. It never counts as a clear result.",
  },
];

const MESSAGE_SIGNS = [
  "Urgent language, like \"act now\"",
  "Requests for passwords, PINs or codes",
  "Requests for money or fees",
  "Claims to be a bank or official team",
  "Prize or reward claims",
  "Emotional pressure or threats",
];

const LAYERS = [
  { name: "Scam-pattern rules", text: "Look for behaviour such as urgency, requests for codes or money, and false claims of authority." },
  { name: "Approved records", text: "Links and numbers are compared with scams that moderators have confirmed." },
  { name: "Community reports", text: "Messages are compared with confirmed scam messages, so small changes in wording still match." },
  {
    name: "AI second opinion",
    text: "An open AI model also reviews messages. Phone numbers, emails and codes are removed before the text is sent, and the AI can only add a warning, never remove one.",
  },
  { name: "Online link checks", text: "Links are checked with Google Safe Browsing and the URLhaus malware list, and very new websites are flagged." },
];

const LINK_SIGNS = [
  "An IP address instead of a website name",
  "An @ symbol hiding the real destination",
  "Look-alike characters in the name",
  "Shortened links",
  "Unusually long links or names",
  "Official-sounding words like \"login\" or \"verify\"",
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="container">
        <header className="page-header">
          <h1 className="page-title">How Scam Hunter works</h1>
          <p className="lead">It looks for warning signs. It cannot prove that something is, or isn't, a scam.</p>
        </header>
        <HowSteps />
      </div>

      <section className="section section--tight" aria-labelledby="results-title">
        <div className="container">
          <h2 id="results-title" className="section-title">What the results mean</h2>
          <dl className="meaning-list">
            {RESULTS.map((result) => (
              <div className="meaning" key={result.label}>
                <dt><span className={`status-pill tone-${result.tone}`}>{result.label}</span></dt>
                <dd>{result.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="signs-title">
        <div className="container">
          <h2 id="signs-title" className="section-title">What it looks for</h2>
          <div className="split" style={{ alignItems: "start", gap: 40 }}>
            <div>
              <h3>In messages</h3>
              <ul className="signs">{MESSAGE_SIGNS.map((sign) => <li key={sign}>{sign}</li>)}</ul>
            </div>
            <div>
              <h3>In links</h3>
              <ul className="signs">{LINK_SIGNS.map((sign) => <li key={sign}>{sign}</li>)}</ul>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 24 }}>
            Links and phone numbers are also compared with records approved by moderators.
          </p>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="layers-title">
        <div className="container">
          <h2 id="layers-title" className="section-title">The checks behind every result</h2>
          <dl className="meaning-list">
            {LAYERS.map((layer) => (
              <div className="meaning" key={layer.name}>
                <dt><strong>{layer.name}</strong></dt>
                <dd>{layer.text}</dd>
              </div>
            ))}
          </dl>
          <p className="muted" style={{ marginTop: 24 }}>
            Each check that finds something adds one warning sign. Every result lists the checks that ran,
            and any that could not run.
          </p>
        </div>
      </section>

      <section className="section section--dark" aria-labelledby="privacy-title">
        <div className="container">
          <h2 id="privacy-title" className="story__title">What happens to what you check</h2>
          <p className="story__copy">
            Checks are not saved. Content is stored only when you choose to submit a community report, and a
            report only affects other people's results after a moderator approves it.
          </p>
          <Link to="/check" className="btn btn--check" style={{ marginTop: 12 }}>Check Something</Link>
        </div>
      </section>
    </>
  );
}
