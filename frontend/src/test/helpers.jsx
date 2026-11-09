import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";
import App from "../App";
import { AuthProvider } from "../auth";

// Replaces fetch with fake responses, used in order. Pass an Error to simulate a network failure.
export function mockFetch(...responses) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce({
        ok: response.status < 400,
        status: response.status,
        json: async () => {
          if (response.body === undefined) throw new SyntaxError("No JSON");
          return response.body;
        },
      });
    }
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Shows where the router currently is, so tests can check navigation.
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

export function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>
  );
}

export function renderWithRouter(ui) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

export const CAUTION_RESULT = {
  status: "SUCCESS",
  concern_level: "CAUTION",
  indicators: [
    { type: "urgency", evidence: "immediately", explanation: "The message pressures you to act immediately." },
    { type: "payment_request", evidence: "send money", explanation: "The message asks you to send money or make a payment." },
  ],
  reference_match: false,
  explanation: "This message uses urgent language and asks for money or a payment.",
  safer_action: "Do not send money until you have verified the request independently.",
};
