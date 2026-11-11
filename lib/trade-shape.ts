import type { Trade, User } from "./schema";
import type { ApiTrade, ApiUser } from "./types";

/** Arrondit à 2 décimales pour éviter les artefacts de flottants. */
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function toApiUser(u: User): ApiUser {
  return {
    id: u.id,
    email: u.email,
    balance: round2(u.balance ?? 0),
    createdAt: u.createdAt ? iso(u.createdAt) : new Date().toISOString(),
  };
}

export function toApiTrade(t: Trade): ApiTrade {
  return {
    id: t.id,
    symbol: t.symbol,
    direction: t.direction === "DOWN" ? "DOWN" : "UP",
    amount: round2(t.amount),
    openPrice: t.openPrice,
    closePrice: t.closePrice ?? null,
    durationSec: t.durationSec,
    status: t.status === "SETTLED" ? "SETTLED" : "OPEN",
    result:
      t.result === "WIN" || t.result === "LOSS" || t.result === "TIE"
        ? t.result
        : null,
    payout: t.payout == null ? null : round2(t.payout),
    openedAt: iso(t.openedAt),
    closesAt: iso(t.closesAt),
  };
}

/** Détecte une violation d'unicité PostgreSQL (erreur 23505). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const rec = err as Record<string, unknown>;
  if (rec.code === "23505") return true;
  const msg = String(rec.message ?? "");
  return /duplicate|unique|déjà|already/i.test(msg);
}
