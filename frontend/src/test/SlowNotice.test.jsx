import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckPanel from "../components/CheckPanel";
import { SLOW_SERVER_NOTICE, useSlowNotice } from "../useSlowNotice";
import { CAUTION_RESULT, renderWithRouter } from "./helpers";

describe("slow server notice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("turns on only after loading has lasted 5 seconds, and off when loading stops", () => {
    const { result, rerender } = renderHook(({ loading }) => useSlowNotice(loading), { initialProps: { loading: true } });
    act(() => vi.advanceTimersByTime(4900));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);

    rerender({ loading: false });
    expect(result.current).toBe(false);
  });

  it("tells the user the server is waking up during a slow check, then shows the result", async () => {
    // A check that only answers when the test says so, like a sleeping server.
    let answer;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => (answer = resolve))));
    renderWithRouter(<CheckPanel />);

    fireEvent.change(screen.getByLabelText("Message to check"), { target: { value: "Send money now" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Message" }));
    expect(screen.getByText("Reviewing the submitted content.")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(SLOW_SERVER_NOTICE)).toBeInTheDocument();

    await act(async () => answer({ ok: true, status: 200, json: async () => CAUTION_RESULT }));
    expect(screen.getByText("2 warning signs found")).toBeInTheDocument();
    expect(screen.queryByText(SLOW_SERVER_NOTICE)).not.toBeInTheDocument();
  });
});
