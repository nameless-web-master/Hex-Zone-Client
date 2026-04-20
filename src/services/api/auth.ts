import { clearStoredToken, persistToken, request } from "./client";

export type AccountType =
  | "PRIVATE"
  | "PRIVATE_PLUS"
  | "EXCLUSIVE"
  | "ENHANCED"
  | "ENHANCED_PLUS";
export type RegistrationType = "ADMINISTRATOR" | "USER";
export type UserRole = "administrator" | "user";

export type AuthUser = {
  id: string;
  name: string;
  accountType: AccountType;
  registrationType?: RegistrationType;
  accountOwnerId?: number;
  role?: UserRole;
  email?: string;
  zoneId?: string;
  first_name?: string;
  last_name?: string;
  zone_id?: string | number;
  account_type?: string;
  registration_type?: string;
  account_owner_id?: number;
  address?: string;
  phone?: string | null;
  mapCenter?: { latitude: number; longitude: number } | null;
  map_center?: { latitude: number; longitude: number } | null;
};

export type OwnerListItem = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  zone_id?: string | number | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
  registrationType: RegistrationType;
  accountOwnerId?: number;
  zoneId?: string;
  phone?: string;
  address?: string;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type LegacyLoginResponse = {
  access_token?: string;
  token?: string;
  user?: AuthUser;
};

type LegacyRegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  account_type: string;
  zone_id?: string;
  role?: UserRole;
  account_owner_id?: number;
  phone?: string;
  address?: string;
};

function toLegacyAccountType(accountType: AccountType): string {
  return accountType.toLowerCase();
}

function parseAccountType(value?: string): AccountType {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "PRIVATE_PLUS") return "PRIVATE_PLUS";
  if (normalized === "EXCLUSIVE") return "EXCLUSIVE";
  if (normalized === "ENHANCED") return "ENHANCED";
  if (normalized === "ENHANCED_PLUS") return "ENHANCED_PLUS";
  return "PRIVATE";
}

function parseRegistrationType(value?: string): RegistrationType {
  return String(value ?? "").toUpperCase() === "USER" ? "USER" : "ADMINISTRATOR";
}

function mapLegacyRegisterPayload(payload: RegisterPayload): LegacyRegisterPayload {
  const [first, ...rest] = payload.name.trim().split(/\s+/);
  const last = rest.join(" ");
  return {
    email: payload.email,
    password: payload.password,
    first_name: first || payload.name,
    last_name: last,
    account_type: toLegacyAccountType(payload.accountType),
    zone_id: payload.zoneId,
    role: payload.registrationType === "USER" ? "user" : "administrator",
    account_owner_id: payload.accountOwnerId,
    phone: payload.phone,
    address: payload.address,
  };
}

function normalizeLoginData(
  data: LoginResponse | LegacyLoginResponse | null,
): LoginResponse | null {
  if (!data) return null;
  const row = data as LoginResponse & LegacyLoginResponse;
  const token = row.token || row.access_token;
  if (!token) return null;
  return {
    token,
    user:
      row.user ??
      ({
        id: "",
        name: "",
        accountType: parseAccountType(),
        registrationType: parseRegistrationType(),
      } as AuthUser),
  };
}

export async function login(payload: LoginPayload, rememberMe = true) {
  const primary = await request<LoginResponse>({
    method: "POST",
    url: "/login",
    data: payload,
  });
  const primaryData = normalizeLoginData(primary.data);
  if (primaryData?.token) {
    persistToken(primaryData.token, rememberMe);
    return { ...primary, data: primaryData };
  }
  const legacy = await request<LegacyLoginResponse>({
    method: "POST",
    url: "/owners/login",
    data: payload,
  });
  const legacyData = normalizeLoginData(legacy.data);
  if (legacyData?.token) {
    persistToken(legacyData.token, rememberMe);
    return { ...legacy, data: legacyData };
  }
  return {
    data: null,
    error: primary.error || legacy.error || "Login failed",
    loading: false,
  };
}

export async function register(payload: RegisterPayload) {
  const primary = await request<{ id?: string }>({
    method: "POST",
    url: "/register",
    data: payload,
  });
  if (!primary.error) return primary;
  return request<{ id?: string }>({
    method: "POST",
    url: "/owners/register",
    data: mapLegacyRegisterPayload(payload),
  });
}

export async function getProfile() {
  const primary = await request<AuthUser>({ method: "GET", url: "/me" });
  if (primary.data) return primary;
  return request<AuthUser>({ method: "GET", url: "/owners/me" });
}

export async function getOwners(params?: { skip?: number; limit?: number }) {
  const primary = await request<OwnerListItem[]>({
    method: "GET",
    url: "/owners/",
    params,
  });
  if (primary.data) return primary;
  return request<OwnerListItem[]>({
    method: "GET",
    url: "/owners",
    params,
  });
}

export function logout() {
  clearStoredToken();
}
