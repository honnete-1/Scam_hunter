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

- **API documentation:** http://127.0.0.1:8000/ (ReDoc reference) and http://127.0.0.1:8000/api/docs/ (interactive Swagger UI)
- OpenAPI schema: http://127.0.0.1:8000/api/schema/
- Admin (moderators): http://127.0.0.1:8000/admin/

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

## Mobile app (mobile/)

React Native with Expo. It calls the same API as the web app and has no detection logic of its own.
See [mobile/README.md](mobile/README.md) for setup, including which backend address to use on an
emulator or a real phone (`localhost` on a phone is the phone itself).

Backend settings that only matter for the mobile app:

- `DJANGO_ALLOWED_HOSTS`: extra hosts, e.g. your computer's LAN IP when testing on a phone with Expo Go.
  `10.0.2.2` (the Android emulator) is allowed automatically in DEBUG.
- `DJANGO_CORS_ALLOWED_ORIGINS`: only for running the mobile app in a web browser, e.g. `http://localhost:8081`.
  Native apps don't use CORS.

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

## AI and online checks

Besides the rules, every check can use extra layers. Each one that finds something adds **one**
warning category, so the concern thresholds stay the same (1–2 categories → Caution, 3+ → High Concern).

| Layer | What it does | Needs |
|-------|--------------|-------|
| Approved records | Links inside messages are also matched against approved URL records | – |
| Community reports | A message very similar to an approved scam message counts as `similar_to_reported`; phone results show how many approved reports name the number | – |
| AI second opinion | An open model (`openai/gpt-oss-20b` on Groq's free tier by default) rates messages; at 70%+ confidence it adds `ai_assessment` | `SCAM_HUNTER_AI_API_KEY` |
| Google Safe Browsing | Links listed as phishing or malware add `known_malicious_link` | `GOOGLE_SAFE_BROWSING_API_KEY` |
| URLhaus | Websites hosting known malware links add `known_malicious_link` | `URLHAUS_AUTH_KEY` |
| Website age (RDAP) | Websites registered less than 30 days ago add `new_domain` | – |

Setup: copy `.env.example` to `.env` next to `manage.py` and add the keys you have, then restart Django.
`.env` is git-ignored, so never commit it. Missing keys are fine: those checks show as "Not set up".

Rules that keep these layers safe:

- **The AI can only add a warning, never remove one.** A scam message that tries to trick the AI cannot hide what the rules found.
- **Privacy:** phone numbers, emails and codes are removed from the text before it is sent to the AI service.
  Results list every check under "How we checked", including any that could not run.
- **Only the reference lookup is required.** If an optional online check fails, the result still appears and says
  "Some online checks could not run". The AI and other online services can never turn a result into "safe".
- Online checks are switched off automatically while tests run.

Message results also include `ai_score`: the AI model's own scam-likelihood estimate (0–100), or `null`
when the AI did not run. The web and mobile apps show it as "AI scam-likelihood score". It is a second
opinion only: the concern level still comes from the rules above, and no number is ever made up.

The web app's **Architecture** page (`/architecture`) shows the system diagram and the measured detection rates.

Measure the effect of the AI on the evaluation sets (uses your free quota slowly, about 30 messages a minute):

```bash
python manage.py evaluate_detector --online
```

Public community API: `GET /api/reports/alerts/` (recent approved reports, with personal details hidden) and
`GET /api/reports/stats/` (real counts), shown on the web app's **Scam Alerts** page.

Real-time SMS and call protection (Android, like a caller-ID app) is planned next: see
[docs/realtime-protection.md](docs/realtime-protection.md).

## Message detector and its limits

The message detector (`MESSAGE_RULES` in `checking/rule_engine.py`) is rule-based, not machine
learning. Each of the six categories looks for a **behaviour**: an action combined with what it is
about, such as "send/reply with" + "OTP", "pay/transfer" + "RWF/MoMo", or "this is/calling from" +
"MTN Customer Care". A single word like "password", "MTN" or "congratulations" is not enough.
Advice such as "never share your PIN" or "do not send money" is skipped on purpose.

Only the first match in each category counts, so repeating urgent words cannot push a message to
High Concern by itself.

Things to keep in mind:

- It only detects the scam-like behaviours it has rules for. New or unusual wording can be missed.
- Results are advice, not proof. A flagged message may be genuine, and an unflagged one may still be a scam.
- `NO_KNOWN_WARNING_SIGNS` never means the content is guaranteed to be safe.
- Rules can be added over time. Re-run the evaluation after every change:

```bash
python manage.py evaluate_detector        # add -v 2 to see every result
```

The evaluation sets are in `checking/evaluation/dataset.py`:

| Set | Size | How it was used |
|-----|------|-----------------|
| main | 30 suspicious + 30 legitimate | Used while refining the rules |
| holdout | 15 + 15 | Written later; its misses were then used to fix gaps, so it is no longer unseen |
| challenge | 20 + 20 | Written after the final rule changes and run once without tuning |

The challenge set is the most honest measure of new wording: 60.0% of suspicious messages were
flagged and 5.0% of legitimate ones (Stage 2.5 final pass). Its misses mostly use `-ing` verbs
("by entering your password"), dropped subjects ("need 50k urgently") or synonyms the rules do not
know ("picked as winner", "reverse it to me"). `checking/tests/test_evaluation.py` fails if the
main or holdout results drop below 80% detection or rise above 20% false positives.

Rwanda mobile numbers are stored as `+2507XXXXXXXX`, so `0788 123 456`, `250788123456` and
`+250 788 123 456` all match the same phone reference record. Other countries' numbers are not changed.

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
