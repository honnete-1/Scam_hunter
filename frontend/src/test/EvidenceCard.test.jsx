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
