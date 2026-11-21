import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { mobileApp } from "../content";

const FEATURES = [
  ["Scan QR codes", "Point the camera at a QR code on a poster, sticker or message. Fake payment QR codes are a growing scam."],
  ["Paste in one tap", "Copy a suspicious SMS, then tap Paste. The clipboard is only read when you tap."],
  ["Warning you can feel", "A short vibration matches the result, so a warning stands out before you read it."],
  ["Share a warning", "Send the verdict and safer action to family in one tap. The checked message itself is not shared."],
  ["App lock", "Optional fingerprint, face or PIN lock, so nobody else can open your reports or account."],
  ["Offline aware", "The app tells you when there is no connection instead of failing silently."],
];

// Download and testing page for the Android app. Links only appear once they really exist.
export default function MobileAppPage() {
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!mobileApp.expoGoUrl) return;
    QRCode.toDataURL(mobileApp.expoGoUrl, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, []);

  return (
    <div className="container page-body">
      <header className="page-header">
        <h1 className="page-title">Scam Hunter for Android</h1>
        <p className="lead">The same checks as the website, plus features made for your phone.</p>
      </header>

      <div className="split mobile-get" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="apk-title">
          <h2 id="apk-title" className="section-title">Install the app</h2>
          {mobileApp.apkUrl ? (
            <>
              <p className="muted">Download the APK on your Android phone, then open it to install.</p>
              <a className="btn btn--check" href={mobileApp.apkUrl}>Download for Android (APK)</a>
              <p className="muted small" style={{ marginTop: 16 }}>
                Android may ask you to allow installing apps from your browser. This is a test build, not yet on the Play Store.
              </p>
            </>
          ) : (
            <p className="muted">
              The installable Android app (APK) will appear here once it has been built. Until then, use Expo Go to test it.
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="expo-title">
          <h2 id="expo-title" className="section-title">Test it now with Expo Go</h2>
          <ol className="steps-list">
            <li>Install <strong>Expo Go</strong> from the Google Play Store.</li>
            <li>Connect your phone to the <strong>same Wi-Fi</strong> as the computer running Scam Hunter.</li>
            <li>Open Expo Go and tap <strong>Scan QR code</strong>, then scan the code below.</li>
          </ol>
          {qr ? (
            <figure className="qr">
              <img src={qr} width="240" height="240" alt={`QR code that opens Scam Hunter in Expo Go (${mobileApp.expoGoUrl})`} />
              <figcaption className="muted small">{mobileApp.expoGoUrl}</figcaption>
            </figure>
          ) : (
            <p className="muted small">Start the mobile app on the computer to see its QR code here.</p>
          )}
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
          The app asks only for the camera (for QR codes) and biometrics (for App lock), when you use them. It never reads
          your SMS or contacts.
        </p>
      </section>
    </div>
  );
}
