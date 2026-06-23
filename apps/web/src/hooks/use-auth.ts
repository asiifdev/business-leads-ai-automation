"use client";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const TOKEN_KEY = "prospex_token";
const USER_KEY = "prospex_user";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        const { user: u, workspace: w } = JSON.parse(raw);
        setUser(u);
        setWorkspace(w);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || "Login failed");
    }
    const data = await res.json() as { token: string; user: AuthUser; workspace: AuthWorkspace };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ user: data.user, workspace: data.workspace }));
    setUser(data.user);
    setWorkspace(data.workspace);
    return data;
  };

  const register = async (name: string, email: string, password: string, workspaceName: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, workspaceName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || "Registration failed");
    }
    const data = await res.json() as { token: string; user: AuthUser; workspace: AuthWorkspace };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ user: data.user, workspace: data.workspace }));
    setUser(data.user);
    setWorkspace(data.workspace);
    return data;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setWorkspace(null);
  };

  return { user, workspace, loading, login, register, logout };
}
