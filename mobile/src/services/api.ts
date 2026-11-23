// Every call to the Django API goes through this file. Screens never call fetch directly.
import { API_URL, REQUEST_TIMEOUT_MS } from '../config';
import type { AnalysisResult, CheckType, CommunityReport, ReviewMode, ScamNumberList, User } from '../types/api';

// "kind" says what went wrong without exposing server details to the user.
export type FailureKind = 'network' | 'validation' | 'auth' | 'server';

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; kind: FailureKind; data: any };

let authToken: string | null = null;

// AuthContext calls this after login, logout and app start.
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: { method?: string; body?: object } = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Token ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // No connection, wrong address, or the timeout above.
    return { ok: false, status: 0, kind: 'network', data: null };
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Empty (204) or not JSON, e.g. an HTML error page that should never reach the user.
  }

  if (response.ok) return { ok: true, status: response.status, data };

  let kind: FailureKind = 'server';
  if (response.status === 400) kind = 'validation';
  else if (response.status === 401 || response.status === 403) kind = 'auth';
  return { ok: false, status: response.status, kind, data };
}

// DRF sends field errors as lists of strings. This picks the first readable one.
export function firstError(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return firstError(value[0]);
  return typeof value === 'string' ? value : '';
}

export type CheckOutcome =
  | { kind: 'result'; result: AnalysisResult }
  | { kind: 'fieldError'; message: string }
  | { kind: 'network' }
  | { kind: 'server' };

const CHECK_ENDPOINTS: Record<CheckType, { path: string; field: string }> = {
  MESSAGE: { path: '/api/check/message/', field: 'message' },
  URL: { path: '/api/check/url/', field: 'url' },
  PHONE: { path: '/api/check/phone/', field: 'phone_number' },
};

export async function checkContent(type: CheckType, value: string): Promise<CheckOutcome> {
  const { path, field } = CHECK_ENDPOINTS[type];
  const res = await request<AnalysisResult>(path, { method: 'POST', body: { [field]: value } });

  if (res.ok) return { kind: 'result', result: res.data };
  // The backend answered but could not finish the check (HTTP 503). This is a result to show,
  // and it is different from the app not reaching the backend at all.
  if (res.status === 503 && res.data?.status === 'CHECK_UNAVAILABLE') return { kind: 'result', result: res.data };
  if (res.kind === 'validation') {
    return { kind: 'fieldError', message: firstError(res.data?.errors?.[field]) || 'Please check what you entered.' };
  }
  if (res.kind === 'network') return { kind: 'network' };
  return { kind: 'server' };
}

export const checkMessage = (message: string) => checkContent('MESSAGE', message);
export const checkUrl = (url: string) => checkContent('URL', url);
export const checkPhone = (phoneNumber: string) => checkContent('PHONE', phoneNumber);

export function signUp(details: { username: string; email: string; password: string }) {
  return request<User>('/api/accounts/register/', { method: 'POST', body: details });
}

export function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/api/accounts/login/', { method: 'POST', body: { username, password } });
}

export function logout() {
  return request<null>('/api/accounts/logout/', { method: 'POST' });
}

export function getCurrentUser() {
  return request<User>('/api/accounts/me/');
}

export function submitReport(report: { reportType: CheckType; content: string; details: string; reviewMode?: ReviewMode }) {
  return request<CommunityReport>('/api/reports/', {
    method: 'POST',
    body: {
      report_type: report.reportType,
      content: report.content,
      details: report.details,
      review_mode: report.reviewMode ?? 'MODERATED',
    },
  });
}

export function getMyReports() {
  return request<CommunityReport[]>('/api/reports/');
}

// Approved scam numbers, saved on the phone for instant call and SMS warnings.
export function getScamNumbers() {
  return request<ScamNumberList>('/api/reports/scam-numbers/');
}
