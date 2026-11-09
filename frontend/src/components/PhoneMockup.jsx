// A phone frame that always uses the dark look planned for the Stage 3 mobile app.
export default function PhoneMockup({ label, children }) {
  // With a label the whole phone is one image for screen readers; without one its content stays readable.
  const imageProps = label ? { role: "img", "aria-label": label } : {};
  return (
    <div className="phone" {...imageProps}>
      <div className="phone__screen force-dark">{children}</div>
    </div>
  );
}

// Example screen. The result matches what the real rule engine returns for this message.
export function MessageCheckScreen() {
  return (
    <>
      <div className="phone__app-bar">
        <span>Scam Hunter</span>
        <span className="phone__chip">Message</span>
      </div>
      <p className="phone__label">Suspicious message</p>
      <div className="phone__bubble">
        Your account will be blocked today. Send your <mark className="mark">PIN</mark>{" "}
        <mark className="mark">immediately</mark>.
      </div>
      <div className="phone__result tone-caution">
        <span className="status-pill">Caution</span>
        <p style={{ margin: "10px 0 0", fontWeight: 600 }}>2 warning signs found</p>
        <ul>
          <li>Urgent language</li>
          <li>Asks for your PIN</li>
        </ul>
        <p className="phone__action">Never share your PIN, even if the request looks official.</p>
      </div>
    </>
  );
}

export function MobileHomeScreen() {
  return (
    <>
      <div className="phone__app-bar">
        <span>Scam Hunter</span>
        <span className="phone__chip">Preview</span>
      </div>
      <p className="phone__label">Check before you act</p>
      <p style={{ font: "700 1.5rem/1.15 'Space Grotesk', sans-serif", margin: "0 0 4px" }}>
        What do you want to check?
      </p>
      <div className="phone__options">
        <div className="phone__option phone__option--selected">
          Message <small>Paste text</small>
        </div>
        <div className="phone__option">
          Link <small>Paste URL</small>
        </div>
        <div className="phone__option">
          Phone number <small>Type number</small>
        </div>
      </div>
      <div className="phone__cta">Check</div>
    </>
  );
}
