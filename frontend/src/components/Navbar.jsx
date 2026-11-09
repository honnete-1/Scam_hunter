import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { CloseIcon, LogoMark, MenuIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close the mobile menu after moving to another page.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function handleLogout() {
    // Leave first, so pages that need a login (like My Reports) don't redirect to the login page.
    navigate("/");
    await logout();
  }

  const navClass = ({ isActive }) => (isActive ? "nav__link active" : "nav__link");

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="brand">
          <LogoMark />
          Scam Hunter
        </Link>

        <button
          type="button"
          className="icon-btn nav__menu-btn"
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
          <span className="visually-hidden">Menu</span>
        </button>

        <nav id="main-menu" aria-label="Main" className={menuOpen ? "nav__menu is-open" : "nav__menu"}>
          <ul className="nav__links">
            <li><NavLink to="/how-it-works" className={navClass}>How It Works</NavLink></li>
            <li><NavLink to="/check" className={navClass}>Check</NavLink></li>
            <li><NavLink to="/report" className={navClass}>Report</NavLink></li>
            {user && <li><NavLink to="/my-reports" className={navClass}>My Reports</NavLink></li>}
          </ul>

          <div className="nav__actions">
            {user ? (
              <button type="button" className="btn btn--text" onClick={handleLogout}>
                Log out
              </button>
            ) : (
              <NavLink to="/login" className={navClass}>Log in</NavLink>
            )}
            <ThemeToggle />
            <Link to="/check" className="btn btn--check btn--small">Check Now</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
