import { useEffect, useState } from "react";
import { Link } from "react-router";
import { NETWORK_ERROR, SERVER_ERROR, getAlerts, getCommunityStats } from "../api";

const TYPE_LABELS = { MESSAGE: "Message", URL: "Link", PHONE: "Phone number" };

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Public feed of scams that moderators have confirmed. Every number shown comes from the database.
export default function AlertsPage() {
  const [alerts, setAlerts] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getAlerts(), getCommunityStats()]).then(([alertsRes, statsRes]) => {
      if (alertsRes.ok && statsRes.ok) {
        setAlerts(alertsRes.data);
        setStats(statsRes.data);
      } else {
        const network = alertsRes.kind === "network" || statsRes.kind === "network";
        setError(network ? NETWORK_ERROR : SERVER_ERROR);
      }
    });
  }, []);

  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">Scam Alerts</h1>
        <p className="lead">Recent scams reported by the community and confirmed by a moderator.</p>
      </header>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!error && !alerts && <p className="muted">Loading...</p>}

      {stats && (
        <div className="stat-row">
          <div className="stat-box">
            <span className="stat-box__value">{stats.approved_reports}</span>
            <span className="stat-box__label">Confirmed reports</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__value">{stats.suspicious_links}</span>
            <span className="stat-box__label">Suspicious links on record</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__value">{stats.suspicious_numbers}</span>
            <span className="stat-box__label">Suspicious numbers on record</span>
          </div>
        </div>
      )}

      {alerts?.length === 0 && (
        <p>No confirmed alerts yet. <Link to="/report">Report something suspicious</Link></p>
      )}

      {alerts?.length > 0 && (
        <ul className="report-list" aria-label="Confirmed scam alerts">
          {alerts.map((alert) => (
            <li className="alert-item" key={alert.id}>
              <p className="report-item__meta">
                {TYPE_LABELS[alert.report_type]} · Confirmed {formatDate(alert.approved_at)}
              </p>
              <p className="alert-item__content">{alert.content}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small" style={{ marginTop: 32 }}>
        Personal numbers and email addresses inside reported messages are hidden.
      </p>
    </div>
  );
}
