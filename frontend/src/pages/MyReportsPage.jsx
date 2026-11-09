import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { NETWORK_ERROR, SERVER_ERROR, getMyReports } from "../api";
import { useAuth } from "../auth";

const TYPE_LABELS = { MESSAGE: "Message", URL: "URL", PHONE: "Phone number" };
const STATUS_LABELS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MyReportsPage() {
  const { user, loading, forgetUser } = useAuth();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getMyReports().then((res) => {
      if (res.ok) setReports(res.data);
      else if (res.kind === "auth") forgetUser();
      else setError(res.kind === "network" ? NETWORK_ERROR : SERVER_ERROR);
    });
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: "/my-reports" }} />;

  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">My Reports</h1>
        <p className="lead">Pending reports don't affect anyone's results until a moderator approves them.</p>
      </header>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!error && reports === null && <p className="muted">Loading...</p>}

      {reports?.length === 0 && (
        <p>
          You haven't submitted any reports yet. <Link to="/report">Submit a report</Link>
        </p>
      )}

      {reports?.length > 0 && (
        <ul className="report-list">
          {reports.map((report) => (
            <li className="report-item" key={report.id}>
              <p className="report-item__content">{report.content}</p>
              <span className="report-status">{STATUS_LABELS[report.status] || report.status}</span>
              <p className="report-item__meta">
                {TYPE_LABELS[report.report_type]} · Submitted {formatDate(report.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
