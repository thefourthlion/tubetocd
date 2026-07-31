import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { apiErrorMessage } from "@/lib/api-error";
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChanged();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChanged();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function getErrorMessage(err: unknown, fallback: string): string {
  return apiErrorMessage(err, fallback);
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>("/api/auth/register", {
      email,
      password,
      name,
    });
    setSession(data.token, data.user);
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Registration failed"));
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>("/api/auth/login", {
      email,
      password,
    });
    setSession(data.token, data.user);
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Sign in failed"));
  }
}

export async function getMe(): Promise<AuthUser> {
  try {
    const { data } = await api.get<{ user: AuthUser }>("/api/auth/me");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch (err) {
    clearSession();
    throw new Error(getErrorMessage(err, "Failed to load user"));
  }
}

export function logout() {
  clearSession();
}
