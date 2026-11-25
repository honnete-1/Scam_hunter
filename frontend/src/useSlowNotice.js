import { useEffect, useState } from "react";

// The free hosting plan puts the server to sleep after 15 minutes without visitors, and waking it
// takes up to a minute. Without a notice the spinner just turns and people think the site is broken.
export const SLOW_SERVER_NOTICE = "The server is waking up. This can take up to a minute, please wait.";
export const SLOW_AFTER_MS = 5000;

// True once `loading` has lasted longer than `delay`; false again as soon as loading stops.
export function useSlowNotice(loading, delay = SLOW_AFTER_MS) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setSlow(true), delay);
    // Runs when loading stops, so the next check starts without the notice.
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [loading, delay]);

  return loading && slow;
}
