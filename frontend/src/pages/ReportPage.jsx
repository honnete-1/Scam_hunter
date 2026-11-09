import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../auth";
import ReportForm from "../components/ReportForm";

const STATUS_LABELS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

function Confirmation({ report }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), []);

  // Moderation hasn't happened yet, so this must not sound like the content was confirmed.
  return (
    <div className="card" role="status">
      <h2 ref={headingRef} tabIndex={-1} className="section-title">Report Submitted</h2>
      <p>Your report has been sent for review.</p>
      <p className="confirmation__status">
        Status: <span className="report-status">{STATUS_LABELS[report.status] || report.status}</span>
      </p>
      <div className="button-row">
        <Link to="/my-reports" className="btn btn--primary">View My Reports</Link>
        <Link to="/check" className="btn btn--secondary">Check something else</Link>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const draft = location.state?.draft;
  const [submitted, setSubmitted] = useState(null);

  let body;
  if (loading) {
    body = <p className="muted">Loading...</p>;
  } else if (!user) {
    // Keep the draft in navigation state so the form is still filled in after logging in.
    const authState = { from: "/report", draft };
    body = (
      <div className="card">
        <h2 className="section-title">Log in to submit a report</h2>
        <p className="muted">
          Reports are linked to your account so moderators can review them. Checking content doesn't need an account.
        </p>
        <div className="button-row">
          <Link to="/login" state={authState} className="btn btn--primary">Log In</Link>
          <Link to="/signup" state={authState} className="btn btn--secondary">Create Account</Link>
        </div>
      </div>
    );
  } else if (submitted) {
    body = <Confirmation report={submitted} />;
  } else {
    body = <ReportForm draft={draft} onSubmitted={setSubmitted} />;
  }

  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">Report Suspicious Content</h1>
        <p className="lead">
          A moderator reviews every report. It only affects other people's results if it is approved.
        </p>
      </header>
      {body}
    </div>
  );
}
