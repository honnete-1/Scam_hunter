import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { NETWORK_ERROR, SERVER_ERROR, firstError } from "../api";
import { useAuth } from "../auth";
import FormField, { describedBy } from "./FormField";

const TEXT = {
  login: {
    title: "Log in",
    intro: "Log in to submit community reports and follow their review.",
    button: "Log In",
    busy: "Logging in...",
  },
  signup: {
    title: "Create an account",
    intro: "You need an account to submit reports. Checking content doesn't need one.",
    button: "Create Account",
    busy: "Creating account...",
  },
};

export default function AuthForm({ mode }) {
  const isSignup = mode === "signup";
  const text = TEXT[mode];
  const { user, login, signup } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Where to go afterwards, e.g. back to the report form with the content the user just checked.
  const from = location.state?.from || "/";
  const draft = location.state?.draft;

  if (user) {
    return <Navigate to={from} replace state={draft ? { draft } : undefined} />;
  }

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const newErrors = {};
    if (!form.username.trim()) newErrors.username = "Please enter a username.";
    if (!form.password) newErrors.password = "Please enter a password.";
    setErrors(newErrors);
    setFormError("");
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    const username = form.username.trim();
    const res = isSignup
      ? await signup({ username, email: form.email.trim(), password: form.password })
      : await login(username, form.password);
    setSubmitting(false);

    // On success the user is set in context and the Navigate above takes over.
    if (res.ok) return;
    if (res.kind === "validation") {
      const fieldErrors = {
        username: firstError(res.data?.username),
        email: firstError(res.data?.email),
        password: firstError(res.data?.password),
      };
      setErrors(fieldErrors);
      if (!Object.values(fieldErrors).some(Boolean)) setFormError("Please check the details and try again.");
    } else if (res.kind === "auth") {
      setFormError("That username and password don't match. Please try again.");
    } else {
      setFormError(res.kind === "network" ? NETWORK_ERROR : SERVER_ERROR);
    }
  }

  const passwordHint = isSignup ? "At least 8 characters. Avoid common or all-number passwords." : "";

  return (
    <div className="container">
      <div className="auth">
        <div className="card">
          <h1 className="section-title">{text.title}</h1>
          <p className="muted">{text.intro}</p>

          <form onSubmit={handleSubmit} noValidate>
            {formError && <div className="form-error" role="alert">{formError}</div>}

            <FormField id="auth-username" label="Username" error={errors.username}>
              <input
                {...describedBy("auth-username", { error: errors.username })}
                className="input"
                autoComplete="username"
                value={form.username}
                onChange={update("username")}
              />
            </FormField>

            {isSignup && (
              <FormField id="auth-email" label="Email" optional error={errors.email}>
                <input
                  {...describedBy("auth-email", { error: errors.email })}
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update("email")}
                />
              </FormField>
            )}

            <FormField id="auth-password" label="Password" hint={passwordHint} error={errors.password}>
              <input
                {...describedBy("auth-password", { hint: passwordHint, error: errors.password })}
                className="input"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={form.password}
                onChange={update("password")}
              />
            </FormField>

            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? text.busy : text.button}
            </button>
          </form>
        </div>

        <p className="auth__switch">
          {isSignup ? "Already have an account? " : "New to Scam Hunter? "}
          <Link to={isSignup ? "/login" : "/signup"} state={location.state}>
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
