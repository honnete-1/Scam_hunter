import type { ReactNode } from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { CheckSessionProvider } from '../src/context/CheckSessionContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import type { AnalysisResult } from '../src/types/api';

// Wraps a component in the same providers the app uses.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CheckSessionProvider>{children}</CheckSessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Fake fetch responses, used in order. An Error simulates a network failure.
export function mockFetch(...responses: ({ status: number; body?: unknown } | Error)[]) {
  const fetchMock = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce({
        ok: response.status < 400,
        status: response.status,
        json: async () => {
          if (response.body === undefined) throw new SyntaxError('No JSON');
          return response.body;
        },
      });
    }
  }
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export const CAUTION_RESULT: AnalysisResult = {
  status: 'SUCCESS',
  concern_level: 'CAUTION',
  indicators: [
    { type: 'urgency', evidence: 'within 30 minutes', explanation: 'The message pressures you to act quickly.' },
    { type: 'sensitive_information_request', evidence: 'send your OTP', explanation: 'The message asks for sensitive account information.' },
  ],
  reference_match: false,
  explanation: 'This message uses urgent language and asks for private information.',
  safer_action: 'Verify the sender through an official contact and never share your OTP.',
};

export const UNAVAILABLE_RESULT: AnalysisResult = {
  status: 'CHECK_UNAVAILABLE',
  concern_level: null,
  indicators: [],
  reference_match: false,
  explanation: 'The reference lookup could not be completed.',
  safer_action: 'Do not rely on this check yet. Verify the sender or destination independently.',
};
