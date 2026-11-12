"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiLogin, apiMe, apiRegister, ApiError, getToken, setToken } from "./api";
import type { ApiUser } from "./types";

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await apiMe();
      setUser(me);
    } catch (err) {
      // Token refusé (401/403) : déconnexion. Panne réseau ou serveur :
      // on ne touche à rien (sinon chaque micro-coupure efface la session).
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Retour du réseau : on revalide la session gardée (sans cela, un
  // utilisateur banni vers la connexion par une micro-coupure devrait
  // retaper son mot de passe alors que son token est toujours bon).
  useEffect(() => {
    const onOnline = () => {
      if (getToken()) refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: me } = await apiLogin(email, password);
    setToken(token);
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { token, user: me } = await apiRegister(email, password);
    setToken(token);
    setUser(me);
  }, []);

  const setBalance = useCallback((balance: number) => {
    setUser((u) => (u ? { ...u, balance } : u));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setBalance }),
    [user, loading, login, register, logout, refresh, setBalance]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return ctx;
}
