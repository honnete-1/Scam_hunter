// Shapes returned by the Django API. The mobile app only displays these; it never computes them.

export type CheckType = 'MESSAGE' | 'URL' | 'PHONE';

export type ConcernLevel = 'HIGH_CONCERN' | 'CAUTION' | 'NO_KNOWN_WARNING_SIGNS';

export type ResultStatus = 'SUCCESS' | 'CHECK_UNAVAILABLE';

export type Indicator = {
  type: string;
  evidence: string;
  explanation: string;
};

export type AnalysisResult = {
  status: ResultStatus;
  concern_level: ConcernLevel | null;
  indicators: Indicator[];
  reference_match: boolean;
  explanation: string;
  safer_action: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
};

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CommunityReport = {
  id: number;
  report_type: CheckType;
  content: string;
  details: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
};
