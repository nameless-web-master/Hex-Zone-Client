import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as loginRequest, register as registerRequest, fetchMe } from '../lib/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  account_type: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; first_name: string; last_name: string; account_type: 'private' | 'exclusive'; phone?: string; zone_id?: string; address?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('zoneweaver_token'));

  useEffect(() => {
    if (token) {
      fetchMe()
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem('zoneweaver_token');
          setToken(null);
          setUser(null);
        });
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await loginRequest({ email, password });
    localStorage.setItem('zoneweaver_token', data.access_token);
    setToken(data.access_token);
    const profile = await fetchMe();
    setUser(profile);
  };

  const register = async (payload: { email: string; password: string; first_name: string; last_name: string; account_type: 'private' | 'exclusive'; phone?: string; zone_id?: string; address?: string }) => {
    await registerRequest(payload);
  };

  const logout = () => {
    localStorage.removeItem('zoneweaver_token');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, login, register, logout }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
