import { useState } from "react";

// Plays the product demo if the file exists, otherwise shows the fallback (a static app screen).
export default function DemoVideo({ src, poster, fallback }) {
  const [failed, setFailed] = useState(false);
  // People who ask for reduced motion get controls instead of autoplay.
  const [reduceMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  );

  if (!src || failed) return fallback;

  return (
    <video
      className="phone__video"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={!reduceMotion}
      controls={reduceMotion}
      preload="metadata"
      onError={() => setFailed(true)}
      aria-label="Demo: checking a suspicious message in Scam Hunter"
    />
  );
}
