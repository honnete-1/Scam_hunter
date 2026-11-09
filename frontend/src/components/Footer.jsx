import { Link } from "react-router";
import { LogoMark } from "./Icons";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link to="/" className="brand">
              <LogoMark />
              Scam Hunter
            </Link>
            <p className="footer__note">
              Scam Hunter looks for warning signs. It cannot prove whether something is a scam, so
              always verify unexpected requests yourself.
            </p>
          </div>
          <ul className="footer__links">
            <li><Link to="/check">Check</Link></li>
            <li><Link to="/how-it-works">How It Works</Link></li>
            <li><Link to="/report">Report</Link></li>
            <li><a href="/admin/">Moderator login</a></li>
          </ul>
        </div>
        <p className="footer__bottom">© {new Date().getFullYear()} Scam Hunter</p>
      </div>
    </footer>
  );
}
