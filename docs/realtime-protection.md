# Real-time protection (Android)

Like a caller-ID app (e.g. Truecaller), Scam Hunter warns the user **while** a suspicious call rings or
right after a suspicious SMS arrives, without the user copying anything into the app.

It is built and switched **off by default**. The user turns it on in the app: Home → *Real-time protection*,
or Profile → *Real-time Protection*.

## How the phone sees calls and SMS

The app does not take screenshots or read the screen. Android itself hands the information to the app
through official APIs, and only after the user agrees.

| Event | Android mechanism | What Scam Hunter does |
|-------|-------------------|-----------------------|
| Incoming call | `CallScreeningService` (Android 10+). The user picks Scam Hunter as the **caller ID & spam app** in Android's own dialog. Android then passes the caller's number to the app before the phone rings, and gives it about 5 seconds to answer. Calls from saved contacts are not passed on. | 1. Looks the number up in the saved list of approved scam numbers (instant, works offline). 2. Otherwise asks `POST /api/check/phone/` (3 s limit). High Concern → warn, silence or block, as the user chose. Caution → warning only; the call still rings. |
| Incoming SMS | `BroadcastReceiver` for `SMS_RECEIVED`, permission `RECEIVE_SMS`. It receives **new** messages only; `READ_SMS` (the inbox) stays blocked in `app.json`. | Checks the sender against the saved scam number list and sends the text to `POST /api/check/message/`. Caution or High Concern shows a notification with the reason and the safer action, and a *Report number* button. |
| Message in WhatsApp, email, browser | Android **Share** menu (`ACTION_SEND`, `text/plain`) | The shared text is checked like a pasted message and the result opens in the app. No permission needed. |

Android does not let normal apps **delete or hide** an SMS; only the default SMS app can. So scam SMS
are flagged with a warning, not removed. Calls can be really blocked.

### Pop-up warning card

Like caller-ID apps, Scam Hunter can draw a warning card **on top of the incoming-call screen** (and on top of any open
app when a scam SMS arrives). It uses Android's *Display over other apps* permission (`SYSTEM_ALERT_WINDOW`), which the
user turns on in Android settings from the Protection screen. The card sits at the top of the screen so the answer and
decline buttons stay free, shows the reason and safer action, and has *Report number* and *Dismiss*. It hides itself
after 45 seconds. A blocked call never rings, so it only gets a notification. On some phones the card does not appear
over the lock screen; the notification still does.

### Answers in the message's language

The SMS check returns a `headline`, `explanation` and `safer_action` in the message's own language when it is not English
(see the main README). The notification and the pop-up card use those, so a Kinyarwanda scam is explained in Kinyarwanda.

## Pieces

```
Django                                   Android app
GET /api/reports/scam-numbers/  ──────►  saved scam number list (SharedPreferences)
POST /api/check/phone/          ◄──────  ScamCallScreeningService  (incoming call)
POST /api/check/message/        ◄──────  SmsScamReceiver           (new SMS)
                                         ShieldNotifications        (warning + "Report number")
                                         ScamShieldModule           (bridge to the React Native screens)
```

- Native code: `mobile/modules/scam-shield/android/` (Kotlin, Expo Modules API, autolinked as a local module);
  `WarningOverlay.kt` draws the pop-up card.
- Screens: `mobile/src/app/protection.tsx` (settings + recent warnings), `mobile/src/components/ProtectionCard.tsx` (Home),
  `mobile/src/components/ProtectionBridge.tsx` (startup sync + Share to check).
- JS wrapper: `mobile/src/services/protection.ts`. In Expo Go, on iOS and on the web the native part is missing,
  and the screen says so instead of failing.

There is no detection logic on the phone. The rules, AI and reference lists stay on the backend; the phone only keeps
a copy of the approved scam numbers so a call can be flagged within Android's 5-second limit.

## Privacy rules

- Off by default; each permission is asked only when the user turns that feature on.
- Calls: only the caller's number is checked. No audio is recorded.
- SMS: the text is sent to the backend for checking and never stored there (the check endpoints store nothing, and the
  AI only sees it after phone numbers, emails and codes are removed). The inbox is never read.
- Optional *Skip messages from my contacts* uses `READ_CONTACTS` only to look up the sender; contacts are never uploaded.
- The phone keeps a history of the last 50 warnings with the sender, verdict and reason, **not the message text**.
  The user can clear it.
- A failed check (offline, timeout) shows nothing. It is never reported as safe.

## Testing it

1. Install the APK from the web app's Mobile App page, or over USB with `mobile/install-on-phone.ps1` if Play Protect
   blocks it (see `mobile/README.md`). The phone must reach the backend on the same Wi-Fi.
2. Home → *Real-time protection*. Turn on calls (choose Scam Hunter in the dialog) and SMS (allow the permission).
3. Turn on *Show warning on top of the call screen* and allow *Display over other apps*.
   *Send a test warning* shows the notification and the pop-up card.
4. Approve a community report for another phone's number in the Django admin, tap *Update Now*, then call or SMS
   from that phone: the warning appears while it rings / when the SMS arrives.
5. On an Android emulator, *Extended controls → Phone* can simulate an incoming call or SMS from any number.

## Limits to be honest about

- The **Google Play Store restricts SMS permissions** to default SMS apps and a few exceptions, and Play Protect blocks
  sideloaded apps that ask to receive SMS. For a university demo the APK is installed over USB (`adb`). Publishing on
  Play would need Google's approval, or the app could rely on calls + Share to check only.
- Message checks need an internet connection. Known scam numbers still work offline.
- Battery savers on some phones (Tecno, Infinix, Xiaomi) may delay background work; a warning can take a few seconds.
- iPhone works differently (a pre-loaded block list and an SMS filter extension) and is not built yet.
