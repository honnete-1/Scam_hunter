import { QRImage, useAndroidRelease } from "../components/AndroidApp";
import { mobileApp } from "../content";

const FEATURES = [
  ["Scam call warnings", "Known scam numbers are flagged while the phone rings, with a warning card on top of the call screen. You choose to be warned, silence them or block them."],
  ["Scam SMS warnings", "A new SMS with scam warning signs triggers a pop-up and a notification right away, with the safer thing to do. Your inbox is never read."],
  ["Your language", "When a scam message is written in Kinyarwanda, French or another language, the explanation is given in that language too."],
  ["Report and block", "Report a scam number for verification, or as a direct report that flags it for everyone at once."],
  ["Share to check", "Got a suspicious WhatsApp message or email? Tap Share, then Scam Hunter, to check it without copying."],
  ["Scan QR codes", "Point the camera at a QR code on a poster, sticker or message. Fake payment QR codes are a growing scam."],
  ["Paste in one tap", "Copy a suspicious SMS, then tap Paste. The clipboard is only read when you tap."],
  ["Share a warning", "Send the verdict and safer action to family in one tap. The checked message itself is not shared."],
  ["App lock", "Optional fingerprint, face or PIN lock, so nobody else can open your reports or account."],
  ["Offline aware", "The app tells you when there is no connection instead of failing silently."],
];

// Download and testing page for the Android app. Links only appear once they really exist.
export default function MobileAppPage() {
  const release = useAndroidRelease();
  const versionText = release.version ? ` (version ${release.version})` : "";

  return (
    <div className="container page-body">
      <header className="page-header">
        <h1 className="page-title">Scam Hunter for Android</h1>
        <p className="lead">The same checks as the website, plus protection that works while calls and messages arrive.</p>
      </header>

      <div className="split mobile-get" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="apk-title">
          <h2 id="apk-title" className="section-title">Install the app</h2>
          {release.apkUrl ? (
            <>
              <p className="muted">
                Scan the code with your Android phone's camera, or open this page on the phone and tap the button.
              </p>
              <figure className="qr">
                <QRImage value={release.apkUrl} label={`QR code that downloads the latest Scam Hunter APK${versionText}`} />
                <figcaption className="muted small">Latest build{versionText}</figcaption>
              </figure>
              <a className="btn btn--check" href={release.apkUrl}>Download for Android (APK)</a>
              <p className="muted small" style={{ marginTop: 16 }}>
                This is a test build, not yet on the Play Store. If Android blocks the install because of the SMS
                permission, install it from a computer with USB debugging (see the project README).
              </p>
            </>
          ) : (
            <p className="muted">
              The installable Android app (APK) will appear here once it has been built. Until then, use Expo Go to test it.
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="expo-title">
          <h2 id="expo-title" className="section-title">For developers: Expo Go</h2>
          <ol className="steps-list">
            <li>Install <strong>Expo Go</strong> from the Google Play Store.</li>
            <li>Connect your phone to the <strong>same Wi-Fi</strong> as the computer running Scam Hunter.</li>
            <li>Open Expo Go and tap <strong>Scan QR code</strong>, then scan the code below.</li>
          </ol>
          {mobileApp.expoGoUrl ? (
            <figure className="qr">
              <QRImage value={mobileApp.expoGoUrl} size={180} label={`QR code that opens Scam Hunter in Expo Go (${mobileApp.expoGoUrl})`} />
              <figcaption className="muted small">{mobileApp.expoGoUrl}</figcaption>
            </figure>
          ) : (
            <p className="muted small">Start the mobile app on the computer to see its QR code here.</p>
          )}
          <p className="muted small">Call and SMS protection only work in the installed APK, not in Expo Go.</p>
        </section>
      </div>

      <section className="section section--tight" aria-labelledby="features-title">
        <h2 id="features-title" className="section-title">Made for your phone</h2>
        <dl className="meaning-list">
          {FEATURES.map(([name, text]) => (
            <div className="meaning" key={name}>
              <dt><strong>{name}</strong></dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          Each permission is asked for only when you turn that feature on: new SMS (never the inbox), caller ID, display
          over other apps (for the warning card), contacts (optional, only to skip messages from people you know), camera
          and biometrics. Real-time protection is off until you switch it on, and checked messages are never stored.
        </p>
      </section>
    </div>
  );
}
