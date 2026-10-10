import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';
import type { User } from '../api/types';

interface Credentials {
  name?: string;
  email: string;
  password: string;
}

interface AuthValue {
  user: User | null;
  /** False until we know whether a stored token is still valid. */
  ready: boolean;
  login: (credentials: Credentials) => Promise<User>;
  register: (credentials: Credentials) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(() => !tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  const authenticate = useCallback(async (mode: 'login' | 'register', credentials: Credentials) => {
    const res = await api.post<{ user: User; token: string }>(`/auth/${mode}`, credentials);
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login: (c) => authenticate('login', c),
      register: (c) => authenticate('register', c),
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, ready, authenticate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
