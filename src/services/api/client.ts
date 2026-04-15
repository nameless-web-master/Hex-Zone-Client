import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://hex-zone-server.onrender.com";

const TOKEN_KEY = "zoneweaver_token";
const REMEMBER_KEY = "zoneweaver_remember";

export type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T;
  message?: string;
};

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function persistToken(token: string, rememberMe: boolean): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(REMEMBER_KEY, rememberMe ? "1" : "0");
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === "1";
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function normalizeApiData<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === "object" &&
    "status" in raw &&
    "data" in raw &&
    (raw as Record<string, unknown>).status === "success"
  ) {
    return (raw as ApiEnvelope<T>).data;
  }
  return raw as T;
}

function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ||
      error.message;
    return message || "Request failed";
  }
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export async function request<T>(
  config: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const response = await apiClient.request(config);
    return { data: normalizeApiData<T>(response.data), error: null, loading: false };
  } catch (error) {
    return { data: null, error: toErrorMessage(error), loading: false };
  }
}

export { apiClient, TOKEN_KEY };
