import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface User {
  id: number;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKENS_KEY = "stock_academy_tokens";

function saveTokens(access: string, refresh: string) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ access, refresh }));
}

function loadTokens(): { access: string; refresh: string } | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return loadTokens()?.access ?? null;
}

function clearTokens() {
  localStorage.removeItem(TOKENS_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${tokens.access}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("session expired");
        return r.json();
      })
      .then((u) => setUser(u))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error?.detail ?? "登录失败");
    }
    const data = await r.json();
    saveTokens(data.access_token, data.refresh_token);
    const me = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    setUser(await me.json());
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error?.detail ?? "注册失败");
    }
    const data = await r.json();
    saveTokens(data.access_token, data.refresh_token);
    const me = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    setUser(await me.json());
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
