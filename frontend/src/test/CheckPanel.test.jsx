import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CheckPanel from "../components/CheckPanel";
import { CAUTION_RESULT, mockFetch, renderWithRouter } from "./helpers";

describe("CheckPanel", () => {
  it("shows an error next to the input and does not call the API for empty input", async () => {
    const fetchMock = mockFetch();
    renderWithRouter(<CheckPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Check Message" }));

    expect(screen.getByText("Please enter a message before checking.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to check")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("switches between message, URL and phone forms", async () => {
    renderWithRouter(<CheckPanel />);

    await userEvent.click(screen.getByRole("tab", { name: "URL" }));
    expect(screen.getByRole("heading", { name: "Check a URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check URL" })).toBeInTheDocument();

    // Arrow keys move between tabs.
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Phone Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Check Number" })).toBeInTheDocument();
  });

  it("calls the real message endpoint and shows the result", async () => {
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    renderWithRouter(<CheckPanel />);

    await userEvent.type(screen.getByLabelText("Message to check"), "Send money immediately");
    await userEvent.click(screen.getByRole("button", { name: "Check Message" }));

    expect(await screen.findByText("2 warning signs found")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/check/message/");
  });

  it("shows server validation errors close to the input", async () => {
    mockFetch({
      status: 400,
      body: { status: "INVALID_INPUT", concern_level: null, errors: { phone_number: ["Enter a valid phone number, for example +250 788 123 456."] } },
    });
    renderWithRouter(<CheckPanel initialType="PHONE" />);

    await userEvent.type(screen.getByLabelText("Phone number to check"), "call me");
    await userEvent.click(screen.getByRole("button", { name: "Check Number" }));

    expect(await screen.findByText("Enter a valid phone number, for example +250 788 123 456.")).toBeInTheDocument();
    expect(screen.queryByText(/warning signs/i)).not.toBeInTheDocument();
  });

  it("explains that a network failure is not a safe result", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    renderWithRouter(<CheckPanel initialType="URL" />);

    await userEvent.type(screen.getByLabelText("Link to check"), "example.com");
    await userEvent.click(screen.getByRole("button", { name: "Check URL" }));

    expect(await screen.findByText(/couldn't reach Scam Hunter/)).toBeInTheDocument();
    expect(screen.getByText("This does not mean the content is safe.")).toBeInTheDocument();
  });

  it("only goes to the report form when the user chooses Report this", async () => {
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    renderWithRouter(<CheckPanel />);

    await userEvent.type(screen.getByLabelText("Message to check"), "Send money immediately");
    await userEvent.click(screen.getByRole("button", { name: "Check Message" }));
    await userEvent.click(await screen.findByRole("button", { name: "Report this" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/report");
    // Only the check request was sent. Nothing was posted to the reports endpoint.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
