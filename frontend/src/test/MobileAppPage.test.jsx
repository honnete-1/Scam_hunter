import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockFetch } from "./helpers";

async function renderMobilePage() {
  // content.js reads the env when it loads, so load the app fresh after changing the env.
  vi.resetModules();
  const { renderApp } = await import("./helpers");
  mockFetch();
  renderApp("/mobile");
}

describe("Mobile App page", () => {
  it("never shows a download link before an APK exists", async () => {
    vi.stubEnv("VITE_ANDROID_APK_URL", "");
    vi.stubEnv("VITE_EXPO_GO_URL", "");
    await renderMobilePage();
    expect(await screen.findByRole("heading", { name: "Scam Hunter for Android" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download for Android/ })).not.toBeInTheDocument();
    expect(screen.getByText(/will appear here once it has been built/)).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("shows the APK download once a link is configured", async () => {
    vi.stubEnv("VITE_ANDROID_APK_URL", "https://expo.dev/artifacts/eas/example.apk");
    await renderMobilePage();
    const link = await screen.findByRole("link", { name: "Download for Android (APK)" });
    expect(link).toHaveAttribute("href", "https://expo.dev/artifacts/eas/example.apk");
    vi.unstubAllEnvs();
  });
});
