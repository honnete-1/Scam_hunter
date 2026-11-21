import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockFetch, renderApp } from "./helpers";

describe("Scam Alerts page", () => {
  it("shows real stats and approved alerts from the backend", async () => {
    mockFetch(
      { status: 200, body: [{ id: 1, report_type: "PHONE", content: "+250 788 444 999", approved_at: "2026-11-13T09:06:05Z" }] },
      { status: 200, body: { approved_reports: 2, approved_by_type: {}, pending_reports: 1, suspicious_links: 1, suspicious_numbers: 1 } }
    );
    renderApp("/alerts");
    expect(await screen.findByText("+250 788 444 999")).toBeInTheDocument();
    expect(screen.getByText("Confirmed reports").previousSibling).toHaveTextContent("2");
  });

  it("explains a network failure", async () => {
    mockFetch(new TypeError("Failed to fetch"), new TypeError("Failed to fetch"));
    renderApp("/alerts");
    expect(await screen.findByText(/couldn't reach Scam Hunter/)).toBeInTheDocument();
  });
});
