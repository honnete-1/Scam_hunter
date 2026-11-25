// All calls to the Django API go through this file, so components never use fetch directly.
const API_BASE = "/api";
const TOKEN_KEY = "scamHunterToken";

export const NETWORK_ERROR = "We couldn't reach Scam Hunter. Check your connection and try again.";
export const SERVER_ERROR = "Something went wrong on our side. Please try again in a moment.";
export const RATE_LIMIT_ERROR = "Too many requests. Please wait a minute and try again.";

// The message to show for a failed request that has no field errors.
export function failureMessage(kind) {
  if (kind === "network") return NETWORK_ERROR;
  if (kind === "rateLimited") return RATE_LIMIT_ERROR;
  return SERVER_ERROR;
}

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
  // A FormData body (file upload) sets its own multipart Content-Type.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
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
  else if (response.status === 429) kind = "rateLimited";
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
  return { error: failureMessage(res.kind) };
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

export function submitReport({ reportType, content, details, reviewMode = "MODERATED" }) {
  return request("/reports/", {
    method: "POST",
    body: { report_type: reportType, content, details, review_mode: reviewMode },
  });
}

// The newest published Android build (APK link and version), or apk_url null if none yet.
export function getLatestAndroidBuild() {
  return request("/app/android/");
}

export function getAlerts() {
  return request("/reports/alerts/");
}

export function getCommunityStats() {
  return request("/reports/stats/");
}

export function getMyReports() {
  return request("/reports/");
}

// The owner of a wrongly reported number asks to be taken off the scam list, with a proof file.
export function sendRemovalRequest({ phoneNumber, fullName, contact, explanation, proof }) {
  const form = new FormData();
  form.append("phone_number", phoneNumber);
  form.append("full_name", fullName);
  form.append("contact", contact);
  form.append("explanation", explanation);
  form.append("proof", proof);
  return request("/reports/removal-requests/", { method: "POST", body: form });
}

export function getMyRemovalRequests() {
  return request("/reports/removal-requests/");
}
