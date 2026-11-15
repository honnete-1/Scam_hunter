# Scam Hunter – Mobile app

React Native (Expo SDK 58, TypeScript, Expo Router). It is another client of the same Django API
as the web app: every check is analysed by the backend. The app contains no detection rules,
thresholds or moderation logic.

The app checks messages, URLs and phone numbers **manually**. It requests no SMS permissions
(they are explicitly blocked in `app.json`).

## 1. Start the backend

The phone has to reach Django over the network, so listen on all interfaces:

```bash
python manage.py runserver 0.0.0.0:8000
```

`localhost` on a phone means the phone itself, not your computer. Use one of these addresses:

| Where the app runs | `EXPO_PUBLIC_API_URL` | Django setting needed |
|--------------------|-----------------------|-----------------------|
| Android emulator | `http://10.0.2.2:8000` | none (`10.0.2.2` is allowed in DEBUG) |
| iOS simulator | `http://localhost:8000` | none |
| Physical phone with Expo Go (same Wi-Fi) | `http://<your computer's LAN IP>:8000` | `DJANGO_ALLOWED_HOSTS=<that IP>` |
| Web browser (`npm run web`) | `http://localhost:8000` | `DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:8081` |

Find your LAN IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux). A deployed backend later
just becomes `EXPO_PUBLIC_API_URL=https://your-domain`.

## 2. Configure and run the app

```bash
cd mobile
npm install
cp .env.example .env.local      # then edit EXPO_PUBLIC_API_URL
npx expo start                  # press a for Android, i for iOS, w for web, or scan the QR code in Expo Go
```

If you change `.env.local`, or edits don't show up, restart with `npx expo start --clear`.

## Commands

```bash
npm test            # Jest + React Native Testing Library
npm run typecheck   # TypeScript
npx expo-doctor     # dependency / config check
```

## Structure

```
mobile/
├── app.json                  Expo config (name, icons, splash, blocked permissions)
├── src/app/                  Screens (Expo Router: each file is a route)
│   ├── (tabs)/               Home, Check, Reports, Profile
│   ├── result.tsx            Check result
│   ├── report.tsx            Report form + confirmation
│   └── login.tsx, signup.tsx
├── src/components/           CheckForm, ResultView, ReportForm, AuthForm, buttons, inputs, ...
├── src/context/              ThemeContext, AuthContext, CheckSessionContext
├── src/services/api.ts       All calls to the Django API
├── src/services/storage.ts   Secure storage (token + theme choice only)
├── src/content/labels.ts     Friendly text for backend values
├── src/theme/                Colours, typography, spacing
└── __tests__/                Jest tests
```

## Privacy

- Checked content lives only in memory (`CheckSessionContext`) and is cleared from the input after a check.
  It is never written to storage or logged.
- Only the login token and the theme choice are stored, in the device's secure storage (`expo-secure-store`).
  The web preview has no secure storage, so it uses `localStorage` for those two values.
- Content is stored on the server only when the user submits a Community Report and ticks the acknowledgement.
