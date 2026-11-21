import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockFetch, renderApp } from "./helpers";

describe("Architecture page", () => {
  it("shows the diagram layers and the measured detection rates", () => {
    mockFetch();
    renderApp("/architecture");
    expect(screen.getByRole("heading", { name: "System architecture" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Scam Hunter architecture diagram" })).toBeInTheDocument();
    expect(screen.getByText("Checking pipeline")).toBeInTheDocument();
    expect(screen.getByText("Groq AI")).toBeInTheDocument();
    expect(screen.getByText("Challenge (unseen)")).toBeInTheDocument();
    expect(screen.getByText("95.0%")).toBeInTheDocument();
  });
});
