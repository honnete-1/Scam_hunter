import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnalysisResult, CheckType } from '../types/api';

// Holds the current check and report draft in memory only.
// Nothing here is written to storage, so checked content disappears when the app closes.

type LastCheck = { type: CheckType; content: string; result: AnalysisResult };
type ReportDraft = { type: CheckType; content: string };

type CheckSessionValue = {
  lastCheck: LastCheck | null;
  setLastCheck: (check: LastCheck | null) => void;
  reportDraft: ReportDraft | null;
  setReportDraft: (draft: ReportDraft | null) => void;
};

const CheckSessionContext = createContext<CheckSessionValue | null>(null);

export function CheckSessionProvider({ children }: { children: ReactNode }) {
  const [lastCheck, setLastCheck] = useState<LastCheck | null>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);

  return (
    <CheckSessionContext.Provider value={{ lastCheck, setLastCheck, reportDraft, setReportDraft }}>
      {children}
    </CheckSessionContext.Provider>
  );
}

export function useCheckSession() {
  const value = useContext(CheckSessionContext);
  if (!value) throw new Error('useCheckSession must be used inside CheckSessionProvider');
  return value;
}
