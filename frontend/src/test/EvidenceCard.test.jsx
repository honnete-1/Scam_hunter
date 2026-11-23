import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EvidenceCard from "../components/EvidenceCard";
import { CAUTION_RESULT } from "./helpers";

function renderCard(result, checkType = "MESSAGE", handlers = {}) {
  const props = { onReport: vi.fn(), onCheckAnother: vi.fn(), onTryAgain: vi.fn(), ...handlers };
  const view = render(<EvidenceCard result={result} checkType={checkType} {...props} />);
  return { ...view, ...props };
}

const indicator = (type) => ({ type, evidence: type, explanation: `Explanation for ${type}` });

describe("EvidenceCard", () => {
  it("shows a caution result with its findings and safer action", () => {
    renderCard(CAUTION_RESULT);
    expect(screen.getByText("Caution")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 warning signs found" })).toBeInTheDocument();
    expect(screen.getByText("Urgent language")).toBeInTheDocument();
    expect(screen.getByText("Payment request")).toBeInTheDocument();
    expect(screen.getByText(CAUTION_RESULT.safer_action)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report this" })).toBeInTheDocument();
  });

  it("uses cautious wording for high concern", () => {
    const { container } = renderCard({
      ...CAUTION_RESULT,
      concern_level: "HIGH_CONCERN",
      indicators: ["urgency", "payment_request", "reward_claim"].map(indicator),
    });
    expect(screen.getByText("High concern")).toBeInTheDocument();
    expect(screen.getByText("This content contains several concerning signs.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/is a scam|definitely/i);
  });

  it("explains a reference match", () => {
    renderCard({ ...CAUTION_RESULT, concern_level: "HIGH_CONCERN", indicators: [], reference_match: true }, "PHONE");
    expect(screen.getByText("This phone number matches a record moderators approved as suspicious.")).toBeInTheDocument();
    expect(screen.getByText("Matches an approved suspicious record")).toBeInTheDocument();
  });

  it("never calls a clear result safe", () => {
    const { container } = renderCard({
      status: "SUCCESS",
      concern_level: "NO_KNOWN_WARNING_SIGNS",
      indicators: [],
      reference_match: false,
      safer_action: "Continue to use caution.",
    });
    expect(screen.getByText("No known warning signs")).toBeInTheDocument();
    expect(screen.getByText("No configured warning indicators or approved suspicious record matches were found.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/verified safe|this is safe/i);
    expect(screen.queryByText("Safe")).not.toBeInTheDocument();
  });

  it("shows check unavailable as its own neutral state", async () => {
    const { container, onTryAgain } = renderCard({
      status: "CHECK_UNAVAILABLE",
      concern_level: null,
      indicators: [],
      reference_match: false,
      safer_action: "Do not rely on this check yet. Verify the sender or destination independently.",
    });
    expect(screen.getByText("Check could not be completed")).toBeInTheDocument();
    expect(screen.getByText("This does not mean the content is safe.")).toBeInTheDocument();
    expect(screen.queryByText("No known warning signs")).not.toBeInTheDocument();
    expect(container.querySelector(".tone-clear")).toBeNull();
    expect(container.querySelector(".tone-unavailable")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onTryAgain).toHaveBeenCalled();
  });

  it("hides extra findings until the user expands them", async () => {
    renderCard({
      ...CAUTION_RESULT,
      concern_level: "HIGH_CONCERN",
      indicators: ["urgency", "payment_request", "reward_claim", "impersonation", "emotional_pressure"].map(indicator),
    });
    expect(screen.queryByText("Emotional pressure or threats")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show 2 more signs" }));
    expect(screen.getByText("Emotional pressure or threats")).toBeInTheDocument();
  });
});

describe("New checking layers", () => {
  it("lists every check that ran, including ones that could not run", async () => {
    renderCard({
      ...CAUTION_RESULT,
      checks: [
        { id: "rules", label: "Scam-pattern rules", status: "COMPLETED", finding: true, detail: "" },
        { id: "ai", label: "AI analysis", status: "UNAVAILABLE", finding: false, detail: "" },
        { id: "safe_browsing", label: "Google Safe Browsing", status: "NOT_CONFIGURED", finding: false, detail: "" },
      ],
    });
    await userEvent.click(screen.getByRole("button", { name: "How we checked (3 checks)" }));
    expect(screen.getByText("Found a warning")).toBeInTheDocument();
    expect(screen.getByText("Couldn't run")).toBeInTheDocument();
    expect(screen.getByText("Not set up")).toBeInTheDocument();
  });

  it("shows how many moderator-approved reports name a phone number", () => {
    renderCard(
      { ...CAUTION_RESULT, concern_level: "HIGH_CONCERN", indicators: [], reference_match: true,
        reputation: { approved_reports: 3, first_reported: "2026-11-13" } },
      "PHONE"
    );
    expect(screen.getByText(/Reported by 3 community members, first on 2026-11-13/)).toBeInTheDocument();
  });

  it("shows the AI finding with a friendly label", () => {
    renderCard({
      ...CAUTION_RESULT,
      indicators: [{ type: "ai_assessment", evidence: "Looks like a fake prize.", explanation: "An AI model also rated it as scam-like." }],
    });
    expect(screen.getByText("AI second opinion")).toBeInTheDocument();
  });
});

describe("AI score", () => {
  it("shows the AI scam-likelihood percentage as a meter", () => {
    renderCard({ ...CAUTION_RESULT, ai_score: 90 });
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "AI scam-likelihood score" })).toHaveAttribute("aria-valuenow", "90");
  });

  it("shows no score when the AI did not run", () => {
    renderCard({ ...CAUTION_RESULT, ai_score: null });
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("explains a Kinyarwanda message in Kinyarwanda, with English one click away", async () => {
    renderCard({
      ...CAUTION_RESULT,
      headline: "Witondere: hari ibimenyetso by'uburiganya",
      explanation: "Ubu butumwa burasaba amafaranga.",
      safer_action: "Ntiwohereze amafaranga.",
      language: "rw",
      english: {
        headline: "Be careful: warning signs found",
        explanation: "This message asks for money.",
        safer_action: "Do not send money.",
      },
    });

    expect(screen.getByText("In Kinyarwanda, the language of the message")).toBeInTheDocument();
    expect(screen.getByText("Ubu butumwa burasaba amafaranga.")).toBeInTheDocument();
    expect(screen.getByText("Ntiwohereze amafaranga.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show in English" }));
    expect(screen.getByText("This message asks for money.")).toBeInTheDocument();
    expect(screen.getByText("Do not send money.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show in Kinyarwanda" })).toBeInTheDocument();
  });
});
