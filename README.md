# Scam Hunter

Scam Hunter helps people check suspicious messages, URLs and phone numbers before
they click, reply, share private information or send money. It never says something
is definitely a scam. A check gives one of these concern levels:

- `HIGH_CONCERN`
- `CAUTION`
- `NO_KNOWN_WARNING_SIGNS`

If the reference lookup fails, the result is `CHECK_UNAVAILABLE` instead (never "no warning signs").
Invalid input gets `INVALID_INPUT` and no concern level.

## Backend setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (use source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # moderator account for /admin/
python manage.py runserver
```

- Admin: http://127.0.0.1:8000/admin/
- API docs (Swagger): http://127.0.0.1:8000/api/docs/

Run the tests with `python manage.py test`.

To demo the "check could not be completed" screen, start Django with
`SIMULATE_REFERENCE_OUTAGE=True` set. Every URL and phone lookup then fails on purpose.

## Web app (frontend/)

React + Vite. In development Vite forwards `/api` and `/admin` to Django, so run both:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest tests
```

If Django is not on port 8000, set `BACKEND_URL` first, e.g. `BACKEND_URL=http://127.0.0.1:8765 npm run dev`.

| Path | Page |
|------|------|
| `/` | Home: hero, why it matters, checker, how it works, mobile preview, community |
| `/check` | Message / URL / phone checker (`?type=url` or `?type=phone` opens a tab) |
| `/how-it-works` | Steps, what each result means, privacy |
| `/report` | Community report form (login required) |
| `/my-reports` | The user's own reports and their status |
| `/login`, `/signup` | Authentication |

Moderators keep using Django Admin (`/admin/`, also linked in the footer).

### Assets and data still needed

These have slots in the code but no files yet. The site hides each slot cleanly until the file exists.

| What | Where to put it |
|------|-----------------|
| Photo of a person using a phone (Rwandan everyday context) | `frontend/public/images/rwanda-phone-context.jpg` |
| Product demo video (open app, paste message, check, result) | `frontend/public/media/scam-hunter-demo.mp4` |
| Poster frame for the video | `frontend/public/images/scam-hunter-demo-poster.jpg` |
| Up to 3 verified Rwanda scam statistics with sources | `rwandaStats` in `frontend/src/content.js` |

## Apps

| App | What it does |
|-----|--------------|
| `accounts` | Register, login (token), logout, current user. Uses Django's built-in `User`. |
| `checking` | Check requests, rule engine, reference records and lookup, analysis result, analysis service, check API. |
| `reporting` | Community reports, moderation reviews, the moderation service and report API. |

## How a check works

```
CheckRequest (MessageCheck / URLCheck / PhoneCheck)
    -> validate() and normalize()        invalid input stops here
    -> RuleEngine                         message rules / URL structure rules
    -> ReferenceRepository                MATCH / NO_MATCH / UNAVAILABLE
    -> AnalysisResult                     concern level, explanation, safer action
```

Classification rules (`checking/analysis_result.py`):

| Situation | Result |
|-----------|--------|
| Reference lookup failed | `CHECK_UNAVAILABLE` |
| Approved suspicious reference match | `HIGH_CONCERN` |
| 3+ distinct warning indicators | `HIGH_CONCERN` |
| 1–2 distinct warning indicators | `CAUTION` |
| 0 indicators and lookups completed | `NO_KNOWN_WARNING_SIGNS` |

Checked content is never saved to the database.

## Community reports

```
User submits report -> PENDING -> moderator approves or rejects
                                    APPROVED -> URL / phone reference record created
                                    REJECTED -> nothing else happens
```

Only `approve_report()` in `reporting/services.py` creates reference records, and the
reference lookup also ignores any record linked to a report that is not APPROVED.
Moderators can approve/reject from the admin (actions on the Community Reports list)
or through the API.

## API

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/accounts/register/` | – |
| POST | `/api/accounts/login/` | – (returns a token) |
| POST | `/api/accounts/logout/` | token |
| GET | `/api/accounts/me/` | token |
| POST | `/api/check/message/` `{"message": "..."}` | – |
| POST | `/api/check/url/` `{"url": "..."}` | – |
| POST | `/api/check/phone/` `{"phone_number": "..."}` | – |
| GET/POST | `/api/reports/` `{"report_type": "MESSAGE"/"URL"/"PHONE", "content": "...", "details": "..."}` | token |
| POST | `/api/reports/<id>/approve/` `{"reason": "..."}` | staff |
| POST | `/api/reports/<id>/reject/` `{"reason": "..."}` | staff |

Send the token as `Authorization: Token <key>`.
