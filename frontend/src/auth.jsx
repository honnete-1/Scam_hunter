import { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // While a saved token is being checked we don't know yet if the user is logged in.
  const [loading, setLoading] = useState(() => Boolean(api.getToken()));

  useEffect(() => {
    if (!api.getToken()) return;
    api.getCurrentUser().then((res) => {
      if (res.ok) setUser(res.data);
      else if (res.kind === "auth") api.clearToken();
      setLoading(false);
    });
  }, []);

  async function login(username, password) {
    const res = await api.login(username, password);
    if (res.ok) {
      api.saveToken(res.data.token);
      setUser(res.data.user);
    }
    return res;
  }

  async function signup(details) {
    const res = await api.register(details);
    if (!res.ok) return res;
    return login(details.username, details.password);
  }

  async function logout() {
    await api.logout();
    // Clear locally even if the request failed, so logging out always works on this device.
    forgetUser();
  }

  // Used when the server says the saved token is no longer valid.
  function forgetUser() {
    api.clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, forgetUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
