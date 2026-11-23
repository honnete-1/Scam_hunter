import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockFetch } from "./helpers";

async function renderMobilePage(...responses) {
  // content.js reads the env when it loads, so load the app fresh after changing the env.
  vi.resetModules();
  const { renderApp } = await import("./helpers");
  const fetchMock = mockFetch(...responses);
  renderApp("/mobile");
  return fetchMock;
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

  it("always offers the newest build published on the backend", async () => {
    vi.stubEnv("VITE_ANDROID_APK_URL", "https://expo.dev/artifacts/eas/old.apk");
    const fetchMock = await renderMobilePage({
      status: 200,
      body: { apk_url: "https://expo.dev/artifacts/eas/newest.apk", version: "1.2.0", build_id: "b1", published_at: "2026-11-23T10:00:00Z" },
    });

    expect(await screen.findByText("Latest build (version 1.2.0)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download for Android (APK)" })).toHaveAttribute(
      "href", "https://expo.dev/artifacts/eas/newest.apk",
    );
    expect(await screen.findByAltText(/QR code that downloads the latest Scam Hunter APK/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/app/android/")).toBe(true);
    vi.unstubAllEnvs();
  });
});
