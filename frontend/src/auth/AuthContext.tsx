import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../api/axios';
export type AccountRole = 'customer' | 'admin';
export interface Customer { id: string; name: string; email: string; role: AccountRole; }
interface AuthState {
  user: Customer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Customer>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const interceptor = api.interceptors.response.use(response => response, error => {
      if (isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.startsWith('/auth/login')) setUser(null);
      return Promise.reject(error);
    });
    const refresh = () => api.get<{ user: Customer }>('/auth/me')
      .then(response => { if (active) setUser(response.data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; api.interceptors.response.eject(interceptor); window.removeEventListener('focus', onFocus); };
  }, []);
  async function login(email: string, password: string) {
    const response = await api.post<{ user: Customer }>('/auth/login', { email, password });
    setUser(response.data.user);
    return response.data.user;
  }
  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}

