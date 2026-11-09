// All calls to the Django API go through this file, so components never use fetch directly.
const API_BASE = "/api";
const TOKEN_KEY = "scamHunterToken";

export const NETWORK_ERROR = "We couldn't reach Scam Hunter. Check your connection and try again.";
export const SERVER_ERROR = "Something went wrong on our side. Please try again in a moment.";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be blocked (private mode). The user then stays logged in only for this page.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

// Returns { ok, status, kind, data }. "kind" tells the caller what went wrong without exposing server details.
async function request(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, kind: "network", data: null };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Empty (204) or non-JSON responses, e.g. an HTML error page we never want to show.
  }

  if (response.ok) return { ok: true, status: response.status, kind: "success", data };

  let kind = "server";
  if (response.status === 400) kind = "validation";
  else if (response.status === 401 || response.status === 403) kind = "auth";
  else if (response.status === 503 && data?.status === "CHECK_UNAVAILABLE") kind = "unavailable";
  return { ok: false, status: response.status, kind, data };
}

// DRF sends field errors as lists of strings. This picks the first readable one.
export function firstError(value) {
  if (!value) return "";
  if (Array.isArray(value)) return firstError(value[0]);
  if (typeof value === "string") return value;
  return "";
}

const CHECK_ENDPOINTS = {
  MESSAGE: { path: "/check/message/", field: "message" },
  URL: { path: "/check/url/", field: "url" },
  PHONE: { path: "/check/phone/", field: "phone_number" },
};

// Returns exactly one of: { result }, { fieldError } or { error }.
export async function checkContent(type, value) {
  const { path, field } = CHECK_ENDPOINTS[type];
  const res = await request(path, { method: "POST", body: { [field]: value } });

  // I keep unavailable as a result too, so the card can show it clearly instead of an error.
  if (res.ok || res.kind === "unavailable") return { result: res.data };
  if (res.kind === "validation") {
    return { fieldError: firstError(res.data?.errors?.[field]) || "Please check what you entered." };
  }
  if (res.kind === "network") return { error: NETWORK_ERROR };
  return { error: SERVER_ERROR };
}

export function register({ username, email, password }) {
  return request("/accounts/register/", { method: "POST", body: { username, email, password } });
}

export function login(username, password) {
  return request("/accounts/login/", { method: "POST", body: { username, password } });
}

export function logout() {
  return request("/accounts/logout/", { method: "POST" });
}

export function getCurrentUser() {
  return request("/accounts/me/");
}

export function submitReport({ reportType, content, details }) {
  return request("/reports/", {
    method: "POST",
    body: { report_type: reportType, content, details },
  });
}

export function getMyReports() {
  return request("/reports/");
}
