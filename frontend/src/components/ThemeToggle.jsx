import { useEffect, useState } from "react";
import { applyTheme, getCurrentTheme, getSavedTheme, saveTheme } from "../theme";
import { MoonIcon, SunIcon } from "./Icons";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    // Follow the system setting until the user picks a theme themselves.
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    function onSystemChange(event) {
      if (getSavedTheme()) return;
      const next = event.matches ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    }
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
