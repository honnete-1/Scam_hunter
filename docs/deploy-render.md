# Deploying Scam Hunter on Render

Render runs the whole project from this repository, using `render.yaml` (a "Blueprint"):

| Render resource | Plan | What it does |
|---|---|---|
| `scam-hunter-db` (PostgreSQL) | Free | The one database for the website and the Android app |
| `scam-hunter` (web service) | Free | Django serves the website, the API (`/api/...`) and the moderator admin (`/admin/`) from one address |

At every deploy Render runs `build.sh`: it installs the Python packages, builds the React website,
collects the admin/API-docs files, runs the database migrations and creates the first moderator account.
Then it starts the server with `gunicorn`.

## 1. Push the code to GitHub

Render deploys from `https://github.com/honnete-1/Scam_hunter`. Commit and push everything first:

```powershell
git add -A
```

```powershell
git commit -m "Prepare deployment on Render"
```

```powershell
git push
```

`.env`, `db.sqlite3`, `media/` and `android_release.json` are git-ignored, so no keys or local data are uploaded.

## 2. Create the Blueprint on Render

1. Sign up at https://render.com with **GitHub** and allow Render to see the `Scam_hunter` repository.
2. In the dashboard: **New** > **Blueprint**, pick `honnete-1/Scam_hunter`, branch `main`.
3. Render reads `render.yaml` and lists the database and the web service. It asks for the values marked
   `sync: false`. Type them yourself:

   | Variable | What to enter |
   |---|---|
   | `DJANGO_SUPERUSER_USERNAME` | Moderator login name, e.g. `admin` |
   | `DJANGO_SUPERUSER_EMAIL` | Your email |
   | `DJANGO_SUPERUSER_PASSWORD` | A strong password (only you type it; it never goes in the code) |
   | `SCAM_HUNTER_AI_API_KEY` | Optional: your Groq key, copied from your local `.env` |
   | `GOOGLE_SAFE_BROWSING_API_KEY`, `URLHAUS_AUTH_KEY` | Optional, same as in `.env` |
   | `SCAM_HUNTER_ANDROID_APK_URL`, `SCAM_HUNTER_ANDROID_VERSION` | Leave empty for now (step 5) |

   `DATABASE_URL` and `DJANGO_SECRET_KEY` are filled in by Render automatically.
4. Click **Deploy Blueprint**. The first build takes about 5 to 10 minutes. Follow it under
   **scam-hunter** > **Logs**; it ends with `Your service is live`.

Your address is shown at the top of the service page, e.g. `https://scam-hunter.onrender.com`
(Render adds letters if the name is taken).

## 3. Check that it works

| Open | You should see |
|---|---|
| `https://<your-address>/` | The Scam Hunter website |
| `https://<your-address>/check` | Check a message, link or number |
| `https://<your-address>/api/` | The API reference (`/api/docs/` for Swagger) |
| `https://<your-address>/admin/` | Moderator login, with the username and password from step 2 |

## 4. Optional: copy your local data

The Render database starts empty (only the moderator account). To bring your local users, reports and
scam numbers along:

1. On Render open **scam-hunter-db** > **Connect** > **External** and copy the **External Database URL**.
   Treat it like a password.
2. On your computer, export the local PostgreSQL data:

   ```powershell
   .venv\Scripts\python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e sessions -e admin.logentry -o data.json
   ```

3. Load it into Render's database. Paste the External URL in place of `PASTE_EXTERNAL_URL`:

   ```powershell
   $env:DATABASE_URL = "PASTE_EXTERNAL_URL"; .venv\Scripts\python manage.py loaddata data.json; Remove-Item Env:DATABASE_URL
   ```

4. Delete `data.json` afterwards (it contains account data).

Accounts with the same username, such as `admin`, are updated rather than duplicated.

## 5. Point the Android app to Render

The current APK talks to your computer (`http://192.168.1.76:8000`). For an app that works anywhere:

1. In `mobile/eas.json`, set `EXPO_PUBLIC_API_URL` to `https://<your-address>`.
2. Build the APK: `powershell -ExecutionPolicy Bypass -File mobile\build-android.ps1 -ExpoHome D:\expo-home -TempDir D:\tmp`.
   The build prints the APK link at the end.
3. On Render: **scam-hunter** > **Environment**, set `SCAM_HUNTER_ANDROID_APK_URL` to that link and
   `SCAM_HUNTER_ANDROID_VERSION` to the version (e.g. `1.2.3`), then **Save Changes**. The website's
   download button and QR code now offer that APK.

## Free plan limits

- **Sleeps when idle.** After 15 minutes without visitors the service sleeps; the next visit takes about a
  minute to wake it. Open the site a minute before a demo or presentation.
- **Free database expires after 30 days.** Render deletes it after a 14-day grace period. Upgrade the
  database, or create a new one and repeat step 4, before then.
- **No persistent disk.** That is why removal-request proofs are stored in the database
  (`reporting/storage.py`) and the APK link is an environment variable.
- **Every push to `main` redeploys** the site automatically.

## If something goes wrong

| Problem | Where to look |
|---|---|
| Build fails | **Logs** of the failed deploy. `npm` errors are in the website build; `migrate` errors mean a database problem. |
| `Bad Request (400)` | The address is not allowed. Add it to `DJANGO_ALLOWED_HOSTS` (comma-separated) in **Environment**. |
| `Server Error (500)` | **Logs** show the Python error. |
| Admin login says CSRF failed | Open the admin through the `https://` address Render shows. |
| Checks say the AI is "Not set up" | Add `SCAM_HUNTER_AI_API_KEY` in **Environment**. |
