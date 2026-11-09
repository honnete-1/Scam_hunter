import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">Page not found</h1>
        <p className="lead">This page doesn't exist.</p>
      </header>
      <Link to="/check" className="btn btn--check">Check Something</Link>
    </div>
  );
}
