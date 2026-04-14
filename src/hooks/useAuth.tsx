import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  login as loginRequest,
  register as registerRequest,
  fetchMe,
  fetchDevices,
  sendDeviceHeartbeat,
  updateOwner,
} from '../lib/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  account_type: string;
  zone_id?: string | number;
  active?: boolean;
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
    await updateOwner(profile.id, { active: true });
    const [refreshed] = await Promise.all([
      fetchMe(),
      (async () => {
        try {
          const devices = await fetchDevices();
          await Promise.allSettled(
            devices.map((device) => sendDeviceHeartbeat(device.id)),
          );
        } catch {
          /* session is valid even if device list / heartbeats fail */
        }
      })(),
    ]);
    setUser(refreshed);
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
