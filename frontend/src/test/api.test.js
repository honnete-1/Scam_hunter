import { describe, expect, it } from "vitest";
import { NETWORK_ERROR, SERVER_ERROR, checkContent, saveToken } from "../api";
import { CAUTION_RESULT, mockFetch } from "./helpers";

describe("checkContent", () => {
  it("posts to the right endpoint with the right field", async () => {
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    const response = await checkContent("PHONE", "+250788123456");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/check/phone/");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ phone_number: "+250788123456" });
    expect(response.result).toEqual(CAUTION_RESULT);
  });

  it("returns CHECK_UNAVAILABLE as a result, not as an error", async () => {
    const unavailable = { status: "CHECK_UNAVAILABLE", concern_level: null, indicators: [], safer_action: "x" };
    mockFetch({ status: 503, body: unavailable });
    const response = await checkContent("URL", "https://example.com");
    expect(response.result.status).toBe("CHECK_UNAVAILABLE");
    expect(response.result.concern_level).toBeNull();
  });

  it("returns the field error for invalid input", async () => {
    mockFetch({
      status: 400,
      body: { status: "INVALID_INPUT", concern_level: null, errors: { url: ["Enter a valid URL, for example https://example.com."] } },
    });
    const response = await checkContent("URL", "not a url");
    expect(response).toEqual({ fieldError: "Enter a valid URL, for example https://example.com." });
  });

  it("returns a friendly message when the network fails", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    expect(await checkContent("MESSAGE", "hello")).toEqual({ error: NETWORK_ERROR });
  });

  it("never passes server error pages to the user", async () => {
    mockFetch({ status: 500, body: undefined });
    expect(await checkContent("MESSAGE", "hello")).toEqual({ error: SERVER_ERROR });
  });

  it("sends the saved token", async () => {
    saveToken("abc123");
    const fetchMock = mockFetch({ status: 200, body: CAUTION_RESULT });
    await checkContent("MESSAGE", "hello");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Token abc123");
  });
});
