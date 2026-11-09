import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { saveToken } from "../api";
import { mockFetch, renderApp } from "./helpers";

const USER = { id: 1, username: "tester", email: "", is_staff: false };

describe("Community reporting", () => {
  it("asks logged-out users to log in before reporting", async () => {
    mockFetch();
    renderApp("/report");
    expect(await screen.findByRole("heading", { name: "Log in to submit a report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Report" })).not.toBeInTheDocument();
  });

  it("requires consent, then submits the report and shows it as pending", async () => {
    saveToken("token-1");
    const fetchMock = mockFetch(
      { status: 200, body: USER },
      {
        status: 201,
        body: { id: 7, report_type: "URL", content: "http://bad.example", details: "From SMS", status: "PENDING" },
      }
    );
    renderApp("/report");

    await userEvent.click(await screen.findByLabelText("URL"));
    await userEvent.type(screen.getByLabelText("Content"), "http://bad.example");
    await userEvent.type(screen.getByLabelText(/Additional details/), "From SMS");
    await userEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(screen.getByText("Please confirm that you understand the report will be stored.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText(/I understand this report will be stored/));
    await userEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(await screen.findByRole("heading", { name: "Report Submitted" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/verified|confirmed scam|added to/i);

    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/reports/");
    expect(JSON.parse(options.body)).toEqual({ report_type: "URL", content: "http://bad.example", details: "From SMS" });
  });
});

describe("Authentication", () => {
  it("logs in with the backend and stores the token", async () => {
    mockFetch({ status: 200, body: { token: "new-token", user: USER } });
    renderApp("/login");

    await userEvent.type(screen.getByLabelText("Username"), "tester");
    await userEvent.type(screen.getByLabelText("Password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/));
    expect(localStorage.getItem("scamHunterToken")).toBe("new-token");
    expect(screen.getAllByRole("button", { name: "Log out" }).length).toBeGreaterThan(0);
  });

  it("shows a clear message for a wrong password", async () => {
    mockFetch({ status: 401, body: { detail: "Invalid username or password." } });
    renderApp("/login");

    await userEvent.type(screen.getByLabelText("Username"), "tester");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("That username and password don't match. Please try again.")).toBeInTheDocument();
  });

  it("logging out from My Reports goes home and forgets the token", async () => {
    saveToken("token-1");
    mockFetch({ status: 200, body: USER }, { status: 200, body: [] }, { status: 204, body: undefined });
    renderApp("/my-reports");

    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => expect(localStorage.getItem("scamHunterToken")).toBeNull());
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });
});
