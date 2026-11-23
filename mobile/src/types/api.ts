// Shapes returned by the Django API. The mobile app only displays these; it never computes them.

export type CheckType = 'MESSAGE' | 'URL' | 'PHONE';

export type ConcernLevel = 'HIGH_CONCERN' | 'CAUTION' | 'NO_KNOWN_WARNING_SIGNS';

export type ResultStatus = 'SUCCESS' | 'CHECK_UNAVAILABLE';

export type Indicator = {
  type: string;
  evidence: string;
  explanation: string;
};

export type CheckRow = {
  id: string;
  label: string;
  status: 'COMPLETED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  finding: boolean;
  detail: string;
};

export type PhoneReputation = { approved_reports: number; first_reported: string | null };

export type AnalysisResult = {
  status: ResultStatus;
  concern_level: ConcernLevel | null;
  indicators: Indicator[];
  reference_match: boolean;
  explanation: string;
  safer_action: string;
  // Added with the AI and online checks; optional so older responses still work.
  checks?: CheckRow[];
  reputation?: PhoneReputation | null;
  // The AI model's scam-likelihood score (0-100), or null when the AI did not run.
  ai_score?: number | null;
  // Short title, and the message's language. When the result was translated into that language,
  // "english" holds the original English text.
  headline?: string;
  language?: string | null;
  english?: { headline: string; explanation: string; safer_action: string } | null;
};

export type User = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
};

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

export type RemovalRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type RemovalRequest = {
  id: number;
  phone_number: string;
  full_name: string;
  contact: string;
  explanation: string;
  status: RemovalRequestStatus;
  moderator_note: string;
  created_at: string;
  reviewed_at: string | null;
};

// MODERATED: a moderator checks it first. DIRECT: phone numbers only, flagged straight away.
export type ReviewMode = 'MODERATED' | 'DIRECT';

export type CommunityReport = {
  id: number;
  report_type: CheckType;
  content: string;
  details: string;
  review_mode?: ReviewMode;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};

export type ScamNumberList = {
  generated_at: string;
  count: number;
  numbers: { phone_number: string; reports: number }[];
};
