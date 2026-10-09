import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../api/axios';
import type { AuthUser } from '../types';

interface LoginCredentials { email: string; password: string; }
interface RegistrationDetails extends LoginCredentials { name: string; }
interface UserEnvelope { user: AuthUser; }

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionError: string;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  register: (details: RegistrationDetails) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isSignedOutResponse(error: unknown) {
  return axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<UserEnvelope>('/auth/me');
      setUser(response.data.user);
      setSessionError('');
      return response.data.user;
    } catch (error) {
      if (isSignedOutResponse(error)) {
        setUser(null);
        setSessionError('');
        return null;
      }
      setSessionError(errorMessage(error));
      throw error;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.get<UserEnvelope>('/auth/me', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setUser(response.data.user); setSessionError(''); } })
      .catch(error => {
        if (controller.signal.aborted || axios.isCancel(error)) return;
        if (isSignedOutResponse(error)) { setUser(null); setSessionError(''); }
        else setSessionError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await api.post<UserEnvelope>('/auth/login', credentials);
    setUser(response.data.user);
    setSessionError('');
    return response.data.user;
  }, []);

  const register = useCallback(async (details: RegistrationDetails) => {
    const response = await api.post<UserEnvelope>('/auth/register', details);
    setUser(response.data.user);
    setSessionError('');
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setSessionError('');
  }, []);

  const value = useMemo(() => ({ user, loading, sessionError, login, register, logout, refresh }), [user, loading, sessionError, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
