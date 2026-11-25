import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { failureMessage, firstError, getMyRemovalRequests, sendRemovalRequest } from "../api";
import { useAuth } from "../auth";
import FormField, { describedBy } from "../components/FormField";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ".jpg,.jpeg,.png,.pdf";
const STATUS_LABELS = { PENDING: "Waiting for a moderator", ACCEPTED: "Accepted: number removed", DECLINED: "Declined" };

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The owner of a number that was reported by mistake asks a moderator to take it off the scam list.
export default function RemovalRequestPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    if (!user) return;
    getMyRemovalRequests().then((res) => setRequests(res.ok ? res.data : []));
  }, [user]);

  let body;
  if (loading) {
    body = <p className="muted">Loading...</p>;
  } else if (!user) {
    const authState = { from: "/removal-request" };
    body = (
      <div className="card">
        <h2 className="section-title">Log in to send a request</h2>
        <p className="muted">
          Requests are linked to your account so a moderator can contact you and you can follow the answer here.
        </p>
        <div className="button-row">
          <Link to="/login" state={authState} className="btn btn--primary">Log In</Link>
          <Link to="/signup" state={authState} className="btn btn--secondary">Create Account</Link>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <RemovalForm
          initialNumber={location.state?.phoneNumber || ""}
          onSent={(request) => setRequests((current) => [request, ...(current || [])])}
        />
        <MyRequests requests={requests} />
      </>
    );
  }

  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">Number Reported by Mistake?</h1>
        <p className="lead">
          If your number is on the scam list but you are innocent, send proof that the number is yours and that it
          was not used for scams. A moderator checks it, and if it is accepted, the number is removed for everyone.
        </p>
      </header>
      {body}
    </div>
  );
}

function RemovalForm({ initialNumber, onSent }) {
  const { forgetUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [explanation, setExplanation] = useState("");
  const [proof, setProof] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!phoneNumber.trim()) next.phoneNumber = "Please enter the number that was reported.";
    if (!fullName.trim()) next.fullName = "Please enter the name of the number's owner.";
    if (!contact.trim()) next.contact = "Please enter an email or phone number where a moderator can reach you.";
    if (!explanation.trim()) next.explanation = "Please explain why the number was reported by mistake.";
    if (!proof) next.proof = "Please attach your proof.";
    else if (proof.size > MAX_PROOF_BYTES) next.proof = "The file is too large. The limit is 5 MB.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0) return;

    setSending(true);
    const res = await sendRemovalRequest({ phoneNumber, fullName, contact, explanation, proof });
    setSending(false);

    if (res.ok) {
      setSent(res.data);
      onSent(res.data);
    } else if (res.kind === "validation") {
      setErrors({
        phoneNumber: firstError(res.data?.phone_number),
        fullName: firstError(res.data?.full_name),
        contact: firstError(res.data?.contact),
        explanation: firstError(res.data?.explanation),
        proof: firstError(res.data?.proof),
      });
    } else if (res.kind === "auth") {
      forgetUser();
    } else {
      setFormError(failureMessage(res.kind));
    }
  }

  if (sent) {
    return (
      <div className="card" role="status">
        <h2 className="section-title">Request sent</h2>
        <p>
          A moderator will check your proof for <strong>{sent.phone_number}</strong>. The number stays on the list until
          then. You can follow the answer below.
        </p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      {formError && <div className="form-error" role="alert">{formError}</div>}

      <FormField id="removal-number" label="Reported phone number" hint="Any format, e.g. 0788 123 456 or +250788123456." error={errors.phoneNumber}>
        <input
          {...describedBy("removal-number", { hint: true, error: errors.phoneNumber })}
          className="input"
          type="tel"
          autoComplete="tel"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
      </FormField>

      <FormField id="removal-name" label="Full name of the number's owner" error={errors.fullName}>
        <input
          {...describedBy("removal-name", { error: errors.fullName })}
          className="input"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </FormField>

      <FormField id="removal-contact" label="How can a moderator reach you?" hint="An email address or another phone number." error={errors.contact}>
        <input
          {...describedBy("removal-contact", { hint: true, error: errors.contact })}
          className="input"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
        />
      </FormField>

      <FormField id="removal-explanation" label="What happened?" hint="For example: it is my business number and a customer reported it after a misunderstanding." error={errors.explanation}>
        <textarea
          {...describedBy("removal-explanation", { hint: true, error: errors.explanation })}
          className="input"
          rows={4}
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
        />
      </FormField>

      <FormField
        id="removal-proof"
        label="Proof"
        hint="A photo or PDF, e.g. a letter from MTN or Airtel with their stamp showing the number is yours. JPG, PNG or PDF, at most 5 MB. Only moderators can see it."
        error={errors.proof}
      >
        <input
          {...describedBy("removal-proof", { hint: true, error: errors.proof })}
          className="input"
          type="file"
          accept={PROOF_TYPES}
          onChange={(event) => setProof(event.target.files?.[0] || null)}
        />
      </FormField>

      <button type="submit" className="btn btn--primary" disabled={sending}>
        {sending ? "Sending..." : "Send Request"}
      </button>
    </form>
  );
}

function MyRequests({ requests }) {
  if (!requests || requests.length === 0) return null;
  return (
    <section className="page-section">
      <h2 className="section-title">My removal requests</h2>
      <ul className="report-list">
        {requests.map((request) => (
          <li className="report-item" key={request.id}>
            <p className="report-item__content">{request.phone_number}</p>
            <span className="report-status">{STATUS_LABELS[request.status] || request.status}</span>
            <p className="report-item__meta">Sent {formatDate(request.created_at)}</p>
            {request.moderator_note && <p className="small">Moderator: {request.moderator_note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
