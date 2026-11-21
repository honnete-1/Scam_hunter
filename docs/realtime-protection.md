# Real-time protection (next stage): design

Goal: like a caller-ID app (e.g. Truecaller), Scam Hunter warns the user **while** a suspicious call
rings or right after a suspicious SMS arrives, without the user copying anything into the app.

This is **Android only**. iOS does not let apps read incoming SMS or calls.

## How it will work

| Event | Android mechanism | What Scam Hunter does |
|-------|-------------------|-----------------------|
| Incoming call | `CallScreeningService` (Android 10+). The user sets Scam Hunter as the "caller ID & spam app" in Settings. No call-log permission needed. | Sends the caller's number to `POST /api/check/phone/`. If the result is High Concern or the number has approved community reports, it shows a warning notification ("Reported by 3 community members") while the phone rings. |
| Incoming SMS | `BroadcastReceiver` for `SMS_RECEIVED`, with the `RECEIVE_SMS` permission. | Sends the text to `POST /api/check/message/`. Caution or High Concern shows a notification with the main warning sign and the safer action. Tapping it opens the full result. |

Both reuse the existing backend endpoints and the `reputation` and `checks` fields added in this
stage. There is no detection logic on the phone.

## Privacy rules (must not be broken)

- Off by default. The user turns on "Real-time protection" with a clear consent screen that says exactly what is sent.
- Only SMS from numbers that are **not** in the user's contacts are checked (needs `READ_CONTACTS`, explained to the user), and the user can pause it any time.
- Message text is never stored on the phone or the server (the check endpoints already store nothing).
  Before any AI call the backend removes phone numbers, emails and codes.
- No call audio is recorded or analysed; only the number is checked.

## What it needs

- A **native module** (Kotlin) written with the Expo Modules API plus a config plugin, inside `mobile/`.
  It cannot run in Expo Go, so it needs a **development build**: `npx expo run:android`
  (Android Studio installed) or `eas build --profile development` (free Expo account).
- The `RECEIVE_SMS` permission and the call-screening role. These must be removed from the
  `blockedPermissions` list in `app.json` at that point.
- Testing on a real Android phone or emulator. The emulator can simulate incoming SMS and calls
  from its "Extended controls" window, which makes demos repeatable.

## Limits to be honest about

- The **Google Play Store restricts SMS permissions** to apps that are the default SMS app, plus a few exceptions.
  For a university demo, install the APK directly; publishing on Play would need Google's approval
  or a different design (for example, a share-to-Scam-Hunter action instead of reading SMS).
- Checks need an internet connection. Offline, the app should say it could not check, never "safe".
- Background work on Android is limited by battery saving, so a check may take a few seconds.
