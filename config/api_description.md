Scam Hunter helps people check suspicious **messages**, **links** and **phone numbers** before they
click, reply, share private information or send money. The same API is used by the web app and the
Android/iOS app.

Scam Hunter looks for warning signs. It **never** claims that something is definitely a scam, and
a clear result never means "guaranteed safe".

## Quick start

```bash
curl -X POST http://localhost:8000/api/check/message/ \
  -H "Content-Type: application/json" \
  -d '{"message": "This is MTN Customer Care. Reply with your OTP now."}'
```

No account is needed to check content. An account is only needed to submit a community report.

## How a result is decided

Every check runs through these layers. Each layer that finds something adds **one** warning category.

| Layer | What it does |
|-------|--------------|
| Scam-pattern rules | Behaviour such as urgency, requests for PINs/OTPs or money, false claims of authority |
| Approved records | Links and numbers confirmed as scams by moderators |
| Community similarity | Messages that closely match confirmed scam messages |
| AI second opinion | An open AI model (optional) rates the message; it can add a warning, never remove one |
| Online link checks | Google Safe Browsing, URLhaus and website age (optional) |

| Situation | `status` | `concern_level` |
|-----------|----------|-----------------|
| A required lookup failed | `CHECK_UNAVAILABLE` (HTTP 503) | `null` |
| Matches an approved suspicious record | `SUCCESS` | `HIGH_CONCERN` |
| 3 or more warning categories | `SUCCESS` | `HIGH_CONCERN` |
| 1–2 warning categories | `SUCCESS` | `CAUTION` |
| No warning categories, all lookups completed | `SUCCESS` | `NO_KNOWN_WARNING_SIGNS` |

`CHECK_UNAVAILABLE` is not a concern level: it means the check could not be completed reliably, and it
must never be shown as safe. Every result lists the layers that ran in `checks`, including any that were
not set up or could not run.

## Authentication

Log in with `POST /api/accounts/login/` to get a token, then send it on every request that needs an
account:

```
Authorization: Token <your token>
```

## Errors

| HTTP | When | Body |
|------|------|------|
| 400 | Invalid input on a check (e.g. empty message, bad URL) | `{"status": "INVALID_INPUT", "concern_level": null, "errors": {...}}` |
| 400 | Invalid form data (sign-up, reports) | `{"field": ["message"]}` |
| 401 | Missing or invalid token | `{"detail": "..."}` |
| 403 | Logged in but not allowed (e.g. moderation without staff rights) | `{"detail": "..."}` |
| 409 | A report has already been reviewed | `{"detail": "..."}` |
| 503 | A required reference lookup failed | A normal result with `"status": "CHECK_UNAVAILABLE"` |

## Privacy

- Content sent to the check endpoints is **never stored**.
- Before any text is sent to the AI service, phone numbers, emails and codes are removed.
- Content is stored only when a signed-in user deliberately submits a community report.
- Only reports approved by a moderator affect future results or appear in the public alerts feed.
