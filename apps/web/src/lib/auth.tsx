import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginResponse, OrganizationSummary, PublicUser, SessionResponse } from '@tesseract/shared';
import { api, getToken, setToken, SIGNED_OUT_EVENT } from './api';
import { syncRealtimeIdentity } from './realtime';

type AuthState =
  | { status: 'loading'; user: null; organization: null }
  | { status: 'signed-out'; user: null; organization: null }
  | { status: 'signed-in'; user: PublicUser; organization: OrganizationSummary | null };

interface AuthValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => void;
  updateUser: (user: PublicUser) => void;
  updateOrganization: (organization: OrganizationSummary) => void;
}

const SIGNED_OUT: AuthState = { status: 'signed-out', user: null, organization: null };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: 'loading', user: null, organization: null } : SIGNED_OUT
  );

  useEffect(() => {
    if (getToken()) {
      api<SessionResponse>('/auth/me', { auth: true })
        .then((data) => setState({ status: 'signed-in', user: data.user, organization: data.organization }))
        .catch(() => {
          setToken(null);
          setState(SIGNED_OUT);
        });
    }
    const onSignedOut = () => setState(SIGNED_OUT);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  // Live updates follow the session: operators and client users join their rooms once signed in.
  useEffect(() => {
    if (state.status !== 'loading') syncRealtimeIdentity();
  }, [state.status]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    setState({ status: 'signed-in', user: data.user, organization: data.organization });
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setState(SIGNED_OUT);
  }, []);

  const updateUser = useCallback((user: PublicUser) => {
    setState((s) => (s.status === 'signed-in' ? { ...s, user } : s));
  }, []);

  const updateOrganization = useCallback((organization: OrganizationSummary) => {
    setState((s) => (s.status === 'signed-in' ? { ...s, organization } : s));
  }, []);

  return <AuthContext.Provider value={{ state, login, logout, updateUser, updateOrganization }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/** The signed-in session. Only use inside screens rendered by ConsoleLayout, which guarantees sign-in. */
export function useSession(): Extract<AuthState, { status: 'signed-in' }> & Omit<AuthValue, 'state'> {
  const { state, ...rest } = useAuth();
  if (state.status !== 'signed-in') throw new Error('useSession requires a signed-in user.');
  return { ...state, ...rest };
}
