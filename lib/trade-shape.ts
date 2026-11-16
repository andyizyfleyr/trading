import type { Combo, ComboLeg, Trade, User } from "./schema";
import type { ApiCombo, ApiComboLeg, ApiTrade, ApiUser } from "./types";

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function toApiUser(u: User): ApiUser {
  return {
    id: u.id,
    email: u.email,
    balance: u.balance ?? 0,
    balanceExact: { numerator: u.balanceNumerator, denominator: u.balanceDenominator },
    currency: u.currency ?? "USD",
    country: u.country ?? null,
    lang: u.lang ?? "fr",
    createdAt: u.createdAt ? iso(u.createdAt) : new Date().toISOString(),
  };
}

export function toApiTrade(t: Trade): ApiTrade {
  return {
    id: t.id,
    symbol: t.symbol,
    direction: t.direction === "DOWN" ? "DOWN" : "UP",
    amount: t.amount,
    amountExact: t.amountNumerator != null && t.amountDenominator != null
      ? { numerator: t.amountNumerator, denominator: t.amountDenominator } : undefined,
    payoutExact: t.payoutNumerator != null && t.payoutDenominator != null
      ? { numerator: t.payoutNumerator, denominator: t.payoutDenominator } : null,
    openPrice: t.openPrice,
    closePrice: t.closePrice ?? null,
    durationSec: t.durationSec,
    status: t.status === "SETTLED" ? "SETTLED" : "OPEN",
    result:
      t.result === "WIN" || t.result === "LOSS" || t.result === "TIE"
        ? t.result
        : null,
    payout: t.payout == null ? null : t.payout,
    openedAt: iso(t.openedAt),
    closesAt: iso(t.closesAt),
  };
}

export function toApiComboLeg(l: ComboLeg): ApiComboLeg {
  return {
    id: l.id,
    symbol: l.symbol,
    direction: l.direction === "DOWN" ? "DOWN" : "UP",
    openPrice: l.openPrice,
    closePrice: l.closePrice ?? null,
    durationSec: l.durationSec,
    status: l.status === "SETTLED" ? "SETTLED" : "OPEN",
    result:
      l.result === "WIN" || l.result === "LOSS" || l.result === "TIE" || l.result === "VOID"
        ? l.result
        : null,
    openedAt: iso(l.openedAt),
    closesAt: iso(l.closesAt),
  };
}

export function toApiCombo(c: Combo, legs: ComboLeg[]): ApiCombo {
  return {
    id: c.id,
    amount: c.amount,
    amountExact: c.amountNumerator != null && c.amountDenominator != null
      ? { numerator: c.amountNumerator, denominator: c.amountDenominator } : undefined,
    payoutExact: c.payoutNumerator != null && c.payoutDenominator != null
      ? { numerator: c.payoutNumerator, denominator: c.payoutDenominator } : null,
    status: c.status === "SETTLED" ? "SETTLED" : "OPEN",
    result: c.result === "WIN" || c.result === "LOSS" || c.result === "TIE" ? c.result : null,
    payout: c.payout == null ? null : c.payout,
    createdAt: iso(c.createdAt),
    legs: legs.map(toApiComboLeg),
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
