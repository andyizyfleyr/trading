"use client";

/**
 * Client HTTP des API JSON. Même contrat que consommera la future app
 * React Native : Authorization Bearer + réponses { data } / { error }.
 */
import type {
  ApiCandle,
  ApiLesson,
  ApiTrade,
  ApiUser,
  LeaderboardEntry,
} from "./types";

const TOKEN_KEY = "tf_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "ERREUR", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Pas de connexion Internet. Vérifiez votre connexion.", "HORS_LIGNE", 0);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* réponse vide */
  }

  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(err?.message ?? "Une erreur est survenue.", err?.code ?? "ERREUR", res.status);
  }
  return (json as { data: T }).data;
}

// --- Auth ---

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export const apiRegister = (email: string, password: string) =>
  request<AuthResponse>("/api/auth/register", { method: "POST", body: { email, password } });

export const apiLogin = (email: string, password: string) =>
  request<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } });

export const apiMe = () => request<{ user: ApiUser }>("/api/me");

// --- Compte ---

export const apiReset = () => request<{ user: ApiUser }>("/api/me/reset", { method: "POST" });

export const apiDeposit = (amount: number) =>
  request<{ user: ApiUser }>("/api/me/deposit", { method: "POST", body: { amount } });

export const apiWithdraw = (amount: number) =>
  request<{ user: ApiUser }>("/api/me/withdraw", { method: "POST", body: { amount } });

// --- Marché ---

export const apiCandles = (symbol: string, interval: string, limit = 200) =>
  request<{ symbol: string; interval: string; candles: ApiCandle[] }>(
    `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
  );

export const apiGetPrice = async (symbol: string): Promise<number> => {
  const d = await request<{ symbol: string; price: number; time: number }>(
    `/api/price?symbol=${encodeURIComponent(symbol)}`
  );
  return d.price;
};

// --- Prédictions ---

export const apiMyTrades = (status: "open" | "settled" | "all" = "all", limit = 50) =>
  request<{ trades: ApiTrade[] }>(`/api/trades?status=${status}&limit=${limit}`);

export const apiOpenTrade = (input: {
  symbol: string;
  direction: "UP" | "DOWN";
  amount: number;
  durationSec: number;
}) => request<{ trade: ApiTrade; balance: number }>("/api/trades", { method: "POST", body: input });

export const apiSettle = (ids?: number[]) =>
  request<{ settled: ApiTrade[]; pending: number; balance: number }>("/api/trades/settle", {
    method: "POST",
    body: ids ? { ids } : {},
  });

// --- Classement ---

export const apiLeaderboard = () =>
  request<{
    entries: LeaderboardEntry[];
    me: { rank: number; balance: number };
    total: number;
  }>("/api/leaderboard");

// --- Leçons ---

export const apiLessons = () =>
  request<{ lessons: ApiLesson[]; progress: Record<string, boolean> }>("/api/lessons");

export const apiLessonProgress = (lessonId: string, done = true) =>
  request<{ lessonId: string; done: boolean }>("/api/lessons/progress", {
    method: "POST",
    body: { lessonId, done },
  });
