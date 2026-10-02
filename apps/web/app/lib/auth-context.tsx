"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getWSClient } from "./ws-client";

// ── Types ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface WorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  role: "SUPER_ADMIN" | "ADMIN" | "AGENT" | "VIEWER";
}

interface AuthState {
  user: User | null;
  workspaces: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveWorkspace: (workspace: WorkspaceMembership) => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Context ───────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

// ── API Helper ────────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("tp_token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Provider ──────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<AuthState>({
    user: null,
    workspaces: [],
    activeWorkspace: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // ── Initialize from localStorage ─────────────────────────────────
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("tp_token");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false, isAuthenticated: false }));
      return;
    }

    try {
      const { ok, data } = await apiFetch("/api/auth/me");
      if (ok && data.id) {
        const activeWs = data.workspaces?.[0] || null;
        setState({
          user: { id: data.id, email: data.email, firstName: data.firstName, lastName: data.lastName },
          workspaces: data.workspaces || [],
          activeWorkspace: activeWs,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        // Token expired / invalid
        localStorage.removeItem("tp_token");
        setState((s) => ({ ...s, isLoading: false, isAuthenticated: false, token: null }));
      }
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // ── Real-time WebSocket lifecycle ────────────────────────────────
  // Open a single shared connection while authenticated; tear it down on
  // logout / token loss. Components subscribe via getWSClient().on(...).
  useEffect(() => {
    if (!state.token) return;
    const ws = getWSClient();
    ws.connect(state.token);
    return () => ws.disconnect();
  }, [state.token]);

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { ok, data } = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!ok) return { success: false, error: data.error || "Login failed" };

      localStorage.setItem("tp_token", data.token);
      const activeWs = data.workspaces?.[0] || null;

      setState({
        user: data.user,
        workspaces: data.workspaces || [],
        activeWorkspace: activeWs,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push("/dashboard");
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to server" };
    }
  }, [router]);

  // ── Register ─────────────────────────────────────────────────────
  const register = useCallback(async (regData: RegisterData) => {
    try {
      const { ok, data } = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(regData),
      });

      if (!ok) return { success: false, error: data.error || "Registration failed" };

      localStorage.setItem("tp_token", data.token);

      setState({
        user: data.user,
        workspaces: data.workspace ? [{ ...data.workspace, role: "SUPER_ADMIN" as const }] : [],
        activeWorkspace: data.workspace ? { ...data.workspace, role: "SUPER_ADMIN" as const } : null,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push("/onboarding");
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to server" };
    }
  }, [router]);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem("tp_token");
    setState({
      user: null,
      workspaces: [],
      activeWorkspace: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
    router.push("/login");
  }, [router]);

  // ── Set Active Workspace ─────────────────────────────────────────
  const setActiveWorkspace = useCallback((workspace: WorkspaceMembership) => {
    setState((s) => ({ ...s, activeWorkspace: workspace }));
    localStorage.setItem("tp_active_ws", workspace.id);
  }, []);

  // ── Protect dashboard routes ─────────────────────────────────────
  useEffect(() => {
    if (state.isLoading) return;

    const isAuthPage = pathname === "/login" || pathname === "/signup";
    const isDashboard = pathname?.startsWith("/dashboard");

    if (!state.isAuthenticated && isDashboard) {
      router.replace("/login");
    }

    if (state.isAuthenticated && isAuthPage) {
      router.replace("/dashboard");
    }
  }, [state.isLoading, state.isAuthenticated, pathname, router]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      setActiveWorkspace,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Export the API helper for use in other components ──────────────────
export { apiFetch };
