# Scam Hunter

Scam Hunter helps people check suspicious messages, URLs and phone numbers before
they click, reply, share private information or send money. It never says something
is definitely a scam. A check gives one of these concern levels:

- `HIGH_CONCERN`
- `CAUTION`
- `NO_KNOWN_WARNING_SIGNS`

If the reference lookup fails, the result is `CHECK_UNAVAILABLE` instead (never "no warning signs").
Invalid input gets `INVALID_INPUT` and no concern level.

## Try it

- **Website:** https://scam-hunter-y1c7.onrender.com
  (free hosting: after 15 minutes without visitors the first page can take about a minute to load).
- **Android app (APK):** [release v1.3.0](https://github.com/honnete-1/Scam_hunter/releases/tag/v1.3.0), or
  [download the APK directly](https://github.com/honnete-1/Scam_hunter/releases/download/v1.3.0/ScamHunter-1.3.0.apk).
  1. Open the link on an Android phone and download `ScamHunter-1.3.0.apk`.
  2. Open the file and allow **Install unknown apps** when Android asks.
  3. If Play Protect warns, tap **Install anyway** (it is a test build, not on the Play Store).
  4. Create an account in the app or log in with an account from the website (both use the same server).

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

**Deploying:** see [docs/deploy-render.md](docs/deploy-render.md) (Render, free plan: one web service + one PostgreSQL database).
Locally `/` shows the API reference; in production the website is served at `/` and the API reference at `/api/`.

### Database

The website and the Android app share **one database**, always through the Django API (the app never opens
the database itself). Django reads `DATABASE_URL` from `.env`:

- **PostgreSQL** (used for this project): `DATABASE_URL=postgres://scam_hunter:PASSWORD@localhost:5433/scam_hunter`.
  Create the database once as the `postgres` user, e.g.
  `CREATE ROLE scam_hunter LOGIN PASSWORD '...' CREATEDB; CREATE DATABASE scam_hunter OWNER scam_hunter;`
  (`CREATEDB` lets `manage.py test` create its test database), then run `python manage.py migrate`.
- **SQLite**: leave `DATABASE_URL` empty and `db.sqlite3` is used. Fine for a quick local try-out.

PostgreSQL is used because moderation locks a report while it is reviewed (`select_for_update`), which SQLite
ignores, because it handles the website and many phones writing at the same time, and because hosting services
keep a managed PostgreSQL database while their disk (where `db.sqlite3` would live) is often wiped on redeploy.

To copy existing SQLite data into PostgreSQL:

```bash
set DATABASE_URL=& python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e sessions -o data.json
python manage.py migrate
python manage.py loaddata data.json
```

Uploaded proof files (removal requests) are saved in `media/` (git-ignored, or `SCAM_HUNTER_MEDIA_ROOT`). No URL
serves that folder; moderators open a proof only from the admin.

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

Public community API: `GET /api/reports/alerts/` (recent approved reports, with personal details hidden),
`GET /api/reports/stats/` (real counts), shown on the web app's **Scam Alerts** page, and
`GET /api/reports/scam-numbers/` (approved scam numbers, downloaded by the Android app).

The Android app has **real-time protection** like a caller-ID app: it warns about (or silences/blocks) scam
calls before you answer and flags scam SMS as they arrive. See
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
                                    REJECTED -> a rejected phone number also leaves the scam list
APPROVED -> moderator removes it, or accepts the owner's removal request -> REMOVED
```

**One number, any format.** Every phone report stores its number in one standard form (`phone_number`, e.g.
`0783 207 918`, `250783207918` and `+250783207918` all become `+250783207918`). The admin shows it with
**Times reported**, and searching any format finds all of them.

**Removing a number.** When a moderator rejects a phone report or uses **Remove selected numbers/links from the
scam list**, `clear_number()` takes the number off the list completely, however many people reported it:
every approved report of it becomes REMOVED, every pending one is rejected with the same reason, and the
phone app stops flagging it at its next list update. Each removal is logged in **Scam list removals**. A cleared
number is not put back by a direct report; new reports of it wait for a moderator, who can still approve them.

**Removal requests.** The owner of a number reported by mistake can ask to be removed (website:
*Number reported by mistake?*, app: Profile or a flagged number's result). They send their name, a contact, an
explanation and proof, for example a letter from MTN or Airtel with the company stamp (JPG, PNG or PDF, at most
5 MB; the file type is checked from its content, not only its name). Only numbers on the list can be requested,
one pending request per number. Moderators open the proof from **Removal requests** in the admin and choose
**Accept** (the number is cleared as above) or **Decline**; the owner sees the answer and the moderator's note.

Only `approve_report()` in `reporting/services.py` creates reference records, and the
reference lookup also ignores any record linked to a report that is not APPROVED.
Moderators can approve/reject from the admin (actions on the Community Reports list)
or through the API.

**Direct reports.** A logged-in user can report a *phone number* with `"review_mode": "DIRECT"`.
It goes through the same `approve_report()` straight away (the review is saved with no moderator and the reason
"Direct report"), so the number is flagged for everyone at once. To limit abuse, each account can make 5 direct
reports per day, and messages and links always need a moderator. If a direct report was wrong, a moderator selects
it in the admin and uses **Remove selected numbers/links from the scam list** (see above; history is kept).

## Answers in the message's language

When a message is not in English (e.g. Kinyarwanda, French, Swahili), the AI check also reports its language.
The backend then translates its own headline, explanation, safer action and warning-sign explanations into that
language (`checking/translator.py`) and keeps the English in `english`. Only Scam Hunter's explanation text is sent
for translation, never the user's message. If the AI is not set up or the translation fails, the answer stays in English.
The rules themselves only know English phrases, so a non-English scam is currently flagged by the AI (Caution) rather
than by the rules.

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
| GET | `/api/reports/scam-numbers/` (approved scam numbers for the Android app) | – |
| GET | `/api/app/android/` (newest published APK link and version) | – |

`POST /api/reports/` also accepts `"review_mode": "DIRECT"` for phone numbers (see Community reports).

Send the token as `Authorization: Token <key>`.
