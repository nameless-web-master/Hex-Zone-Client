import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getRememberMe,
  getStoredToken,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  request,
  type AuthUser,
  type RegisterPayload,
} from "../../services/api";

type LegacyRegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  account_type: "private" | "exclusive";
  zone_id?: string;
  phone?: string;
  address?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (
    email: string,
    password: string,
    options?: { rememberMe?: boolean },
  ) => Promise<void>;
  register: (payload: RegisterPayload | LegacyRegisterPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseJwtExp(token: string): number | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(atob(payloadPart)) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp * 1000;
}

function mapLegacyRegister(payload: LegacyRegisterPayload): RegisterPayload {
  return {
    name: `${payload.first_name} ${payload.last_name}`.trim(),
    email: payload.email,
    password: payload.password,
    accountType:
      payload.account_type === "exclusive" ? "EXCLUSIVE" : "PRIVATE",
    zoneId: payload.zone_id,
    phone: payload.phone,
    address: payload.address,
  };
}

function normalizeUser(raw: AuthUser | null): AuthUser | null {
  if (!raw) return null;
  const first = raw.first_name ?? "";
  const last = raw.last_name ?? "";
  const fullName = raw.name || `${first} ${last}`.trim() || raw.email || "User";
  const zoneId =
    raw.zoneId ?? (raw.zone_id != null ? String(raw.zone_id) : undefined);
  return {
    ...raw,
    name: fullName,
    accountType:
      raw.accountType ||
      (String(raw.account_type).toUpperCase() === "EXCLUSIVE"
        ? "EXCLUSIVE"
        : "PRIVATE"),
    zoneId,
    zone_id: raw.zone_id ?? zoneId,
  };
}

async function fetchCurrentUser() {
  const me = await request<AuthUser>({ method: "GET", url: "/me" });
  if (me.data) return me;
  const legacyMe = await request<AuthUser>({ method: "GET", url: "/owners/me" });
  return legacyMe;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    if (!token || isExpired(token)) return;
    setLoading(true);
    const result = await fetchCurrentUser();
    if (result.data) {
      setUser(normalizeUser(result.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!token) return;
    if (isExpired(token)) {
      authLogout();
      setToken(null);
      setUser(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    fetchCurrentUser()
      .then((result) => {
        if (!isMounted) return;
        if (result.data) {
          setUser(normalizeUser(result.data));
          return;
        }
        // Keep token on transient fetch failures to avoid refresh logout loops.
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const exp = parseJwtExp(token);
    if (!exp) return;
    const timeoutMs = exp * 1000 - Date.now();
    if (timeoutMs <= 0) {
      authLogout();
      setToken(null);
      setUser(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      authLogout();
      setToken(null);
      setUser(null);
    }, timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [token]);

  const login = async (
    email: string,
    password: string,
    options?: { rememberMe?: boolean },
  ) => {
    const rememberMe = options?.rememberMe ?? getRememberMe();
    const result = await authLogin({ email, password }, rememberMe);
    if (!result.data) {
      throw new Error(result.error ?? "Login failed");
    }
    setToken(result.data.token);
    if (result.data.user?.id) {
      setUser(normalizeUser(result.data.user));
    } else {
      const me = await fetchCurrentUser();
      if (!me.data) throw new Error(me.error ?? "Could not load profile");
      setUser(normalizeUser(me.data));
    }
  };

  const register = async (payload: RegisterPayload | LegacyRegisterPayload) => {
    const normalized =
      "name" in payload ? payload : mapLegacyRegister(payload);
    const result = await authRegister(normalized);
    if (result.error) {
      throw new Error(result.error);
    }
  };

  const logout = () => {
    authLogout();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, refreshUser, login, register, logout }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
