import { useState } from "react";
import { Link } from "react-router";
import CheckPanel from "../components/CheckPanel";
import DemoVideo from "../components/DemoVideo";
import HowSteps from "../components/HowSteps";
import { ArrowIcon, LockIcon } from "../components/Icons";
import PhoneMockup, { MessageCheckScreen, MobileHomeScreen } from "../components/PhoneMockup";
import { media, rwandaStats } from "../content";

function Hero() {
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div>
          <h1 className="hero__title">
            Check before you act<span className="accent-dot">.</span>
          </h1>
          <p className="hero__copy">
            Scam Hunter helps you examine suspicious messages, URLs and phone numbers before you click,
            reply, share sensitive information or send money.
          </p>
          <div className="hero__actions">
            <Link to="/check" className="btn btn--check">Check Something</Link>
            <Link to="/how-it-works" className="link-arrow">
              See How It Works <ArrowIcon />
            </Link>
          </div>
          <p className="hero__note">
            <LockIcon /> What you check isn't saved.
          </p>
        </div>
        <div className="hero__visual">
          <PhoneMockup label="Example: Scam Hunter marks a message asking for a PIN immediately as Caution, with 2 warning signs." >
            <MessageCheckScreen />
          </PhoneMockup>
        </div>
      </div>
    </section>
  );
}

function WhyItMatters() {
  // The photo only appears once it has loaded, so a missing file never leaves an empty box.
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const stats = rwandaStats.filter((stat) => stat.value && stat.source);

  const title = <h2 id="why-title" className="story__title">Scams arrive looking like ordinary messages.</h2>;
  const body = (
    <div>
      <p className="story__copy">
        A text from your "bank", a mobile money request from a "relative", a link to claim a prize.
        The moment to pause is before you reply, click or pay.
      </p>

      {stats.length > 0 && (
        <dl className="stats">
          {stats.map((stat) => (
            <div key={stat.key}>
              <dt className="stat__value">{stat.value}</dt>
              <dd className="stat__label">{stat.label}</dd>
              <dd className="stat__source">
                Source: {stat.sourceUrl ? <a href={stat.sourceUrl}>{stat.source}</a> : stat.source}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  return (
    <section className="section section--dark" aria-labelledby="why-title">
      {/* With a photo: photo | text. Without one: big statement | supporting text. */}
      <div className={imageReady ? "container story__grid" : "container story__grid story__grid--text-only"}>
        {!imageFailed && (
          <img
            className="story__image"
            src={media.problemImage}
            alt={media.problemImageAlt}
            hidden={!imageReady}
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
          />
        )}
        {imageReady ? (
          <div>
            {title}
            {body}
          </div>
        ) : (
          <>
            {title}
            {body}
          </>
        )}
      </div>
    </section>
  );
}

function TryIt() {
  return (
    <section className="section" id="try" aria-labelledby="try-title">
      <div className="container container--narrow">
        <h2 id="try-title" className="section-title">Check something suspicious</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Nothing you check here is saved.</p>
        <CheckPanel />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section section--tight" aria-labelledby="how-title">
      <div className="container">
        <h2 id="how-title" className="section-title">How it works</h2>
        <HowSteps />
        <Link to="/how-it-works" className="link-arrow">
          What each result means <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function MobilePreview() {
  return (
    <section className="section section--dark" aria-labelledby="mobile-title">
      <div className="container split">
        <div className="split__copy">
          <h2 id="mobile-title" className="story__title">Scam Hunter on the go.</h2>
          <p className="story__copy">
            Check suspicious content wherever you are. The mobile app keeps the same idea: one clear action
            and a result you can understand at a glance.
          </p>
          <span className="coming-next">Mobile app coming next</span>
        </div>
        <div className="split__visual">
          <PhoneMockup>
            <DemoVideo
              src={media.demoVideo}
              poster={media.demoPoster}
              fallback={<MobileHomeScreen />}
            />
          </PhoneMockup>
        </div>
      </div>
    </section>
  );
}

function Community() {
  return (
    <section className="section" aria-labelledby="community-title">
      <div className="container split">
        <div className="split__copy">
          <h2 id="community-title" className="section-title">Seen something suspicious? Report it.</h2>
          <p className="muted">
            Reports are stored only when you choose to submit one. A moderator reviews each report before it
            can affect anyone's results.
          </p>
          <ol className="flow" aria-label="What happens to a report">
            <li>Submitted</li>
            <li>Pending review</li>
            <li>Approved or rejected</li>
          </ol>
          <Link to="/report" className="btn btn--primary">Submit a Report</Link>
        </div>
        <div className="split__visual" aria-hidden="true">
          <div className="card card--preview">
            <h3>Report Submitted</h3>
            <p className="muted">Your report has been sent for review.</p>
            <p className="confirmation__status" style={{ marginBottom: 0 }}>
              Status: <span className="report-status">Pending</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyItMatters />
      <TryIt />
      <HowItWorks />
      <MobilePreview />
      <Community />
    </>
  );
}
