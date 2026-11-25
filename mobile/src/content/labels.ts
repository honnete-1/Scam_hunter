// Friendly text for the values the backend returns. Display only: no detection logic lives here.
import type { CheckType, ConcernLevel, RemovalRequestStatus, ReportStatus } from '../types/api';
import type { StatusTone } from '../theme/colors';

export const concernLabels: Record<ConcernLevel, { label: string; tone: StatusTone }> = {
  HIGH_CONCERN: { label: 'High Concern', tone: 'high' },
  CAUTION: { label: 'Caution', tone: 'caution' },
  NO_KNOWN_WARNING_SIGNS: { label: 'No Known Warning Signs', tone: 'clear' },
};

export const UNAVAILABLE_LABEL = 'Check Could Not Be Completed';

export const indicatorLabels: Record<string, string> = {
  urgency: 'Urgent pressure',
  sensitive_information_request: 'Sensitive information request',
  payment_request: 'Payment request',
  impersonation: 'Claims to be an organisation',
  reward_claim: 'Prize or reward claim',
  emotional_pressure: 'Emotional pressure or threats',
  ip_address_host: 'Uses an IP address instead of a name',
  credentials_in_url: 'Hidden destination (@ in the link)',
  punycode_domain: 'Look-alike characters in the name',
  url_shortener: 'Shortened link',
  excessive_subdomains: 'Unusually long website name',
  suspicious_domain_word: 'Official-sounding word in the name',
  very_long_url: 'Unusually long link',
  ai_assessment: 'AI second opinion',
  known_malicious_link: 'Link listed as harmful',
  new_domain: 'Very new website',
  similar_to_reported: 'Matches confirmed community reports',
};

export const checkStatusText: Record<string, string> = {
  COMPLETED: 'Checked',
  NOT_CONFIGURED: 'Not set up',
  UNAVAILABLE: "Couldn't run",
};

// "sensitive_information_request" -> "Sensitive information request" for any type not listed above.
export function labelForIndicator(type: string) {
  if (indicatorLabels[type]) return indicatorLabels[type];
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const subjectNames: Record<CheckType, string> = { MESSAGE: 'message', URL: 'link', PHONE: 'phone number' };

export const checkTypeLabels: Record<CheckType, string> = { MESSAGE: 'Message', URL: 'URL', PHONE: 'Phone Number' };

export const reportStatusLabels: Record<ReportStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REMOVED: 'Removed from list',
};

export const removalStatusLabels: Record<RemovalRequestStatus, string> = {
  PENDING: 'Waiting for a moderator',
  ACCEPTED: 'Accepted: number removed',
  DECLINED: 'Declined',
};

export const NETWORK_ERROR = {
  title: 'Unable to connect to Scam Hunter.',
  detail: 'Check your internet connection and try again.',
};

export const SERVER_ERROR = {
  title: 'Something went wrong on our side.',
  detail: 'Please try again in a moment.',
};

export const RATE_LIMIT_ERROR = {
  title: 'Too many requests.',
  detail: 'Please wait a minute and try again.',
};

// What went wrong with a request that has no field errors, and the message for it.
export type FailureType = 'network' | 'server' | 'rateLimited';

export function toFailure(kind: string): FailureType {
  return kind === 'network' || kind === 'rateLimited' ? kind : 'server';
}

export function failureLabel(failure: FailureType | null) {
  if (failure === 'network') return NETWORK_ERROR;
  if (failure === 'rateLimited') return RATE_LIMIT_ERROR;
  return SERVER_ERROR;
}

// Languages the backend may detect in a message (ISO 639-1 codes).
export const languageNames: Record<string, string> = {
  en: 'English', rw: 'Kinyarwanda', fr: 'French', sw: 'Swahili', rn: 'Kirundi', lg: 'Luganda', ln: 'Lingala',
  es: 'Spanish', pt: 'Portuguese', ar: 'Arabic', de: 'German', zh: 'Chinese', hi: 'Hindi',
};

export function languageName(code: string | null | undefined) {
  return code ? languageNames[code] ?? code.toUpperCase() : '';
}

export const SAFETY_TIPS = [
  'Real support teams will never ask you to share your OTP or PIN.',
  'If a message rushes you, slow down. Call the organisation on a number you already know.',
  'Prizes you never entered for are a common trick. Real prizes never ask for a fee first.',
  'A new number claiming to be family? Call the old number or ask something only they would know.',
];
