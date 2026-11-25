import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import { deleteItem, getItem, setItem } from '../services/storage';
import type { User } from '../types/api';

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => ReturnType<typeof api.login>;
  signUp: (details: { username: string; email: string; password: string }) => Promise<api.ApiResponse<unknown>>;
  logout: () => Promise<void>;
  forgetUser: () => Promise<void>;
};

const TOKEN_KEY = 'scamHunterToken';
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On start, reuse a saved token if the backend still accepts it.
  useEffect(() => {
    (async () => {
      const token = await getItem(TOKEN_KEY);
      if (token) {
        api.setAuthToken(token);
        const res = await api.getCurrentUser();
        if (res.ok) setUser(res.data);
        else if (res.kind === 'auth') await forgetUser();
      }
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string) {
    // Don't send an old token with the login request; the server would refuse it.
    api.setAuthToken(null);
    const res = await api.login(username, password);
    if (res.ok) {
      api.setAuthToken(res.data.token);
      await setItem(TOKEN_KEY, res.data.token);
      setUser(res.data.user);
    }
    return res;
  }

  async function signUp(details: { username: string; email: string; password: string }) {
    api.setAuthToken(null);
    const res = await api.signUp(details);
    if (!res.ok) return res;
    return login(details.username, details.password);
  }

  async function logout() {
    await api.logout();
    // Forget the token locally even if the request failed, so logging out always works.
    await forgetUser();
  }

  async function forgetUser() {
    api.setAuthToken(null);
    await deleteItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, logout, forgetUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
