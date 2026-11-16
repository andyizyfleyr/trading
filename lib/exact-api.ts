import Decimal from "decimal.js";
import { decimalFraction, exactToUsd, fraction, type ExactMoney } from "./exact-money";
import { isCurrency } from "./money";
import type { ApiTrade } from "./types";

export interface WireMoney { numerator: string; denominator: string }

export function wireMoney(value: ExactMoney): WireMoney {
  return { numerator: value.numerator.toString(), denominator: value.denominator.toString() };
}

/** Accepte les anciens clients en USD et les nouveaux montants en devise. */
export function parseStake(body: { amount?: unknown; amountExact?: unknown; localAmount?: unknown; localCurrency?: unknown }, userCurrency: string): ExactMoney {
  if (body.amountExact !== undefined) {
    const item = body.amountExact as Partial<WireMoney> | null;
    if (!item || typeof item.numerator !== "string" || typeof item.denominator !== "string" ||
        !/^\d{1,60}$/.test(item.numerator) || !/^\d{1,60}$/.test(item.denominator)) throw new Error("Montant invalide");
    const result = fraction(BigInt(item.numerator), BigInt(item.denominator));
    if (result.numerator <= BigInt(0)) throw new Error("Montant invalide");
    return result;
  }
  if (body.localAmount !== undefined || body.localCurrency !== undefined) {
    if (typeof body.localAmount !== "string" || body.localAmount.length > 40 || !isCurrency(body.localCurrency) || body.localCurrency !== userCurrency) {
      throw new Error("Montant invalide");
    }
    return exactToUsd(decimalFraction(body.localAmount), body.localCurrency);
  }
  const value = Number(body.amount);
  if (!Number.isFinite(value) || value <= 0 || value > 1e15) throw new Error("Montant invalide");
  return decimalFraction(new Decimal(value).toFixed());
}

/** Convertit la ligne atomique PostgreSQL sans refaire une lecture réseau. */
export function tradeFromSql(row: Record<string, unknown>): ApiTrade {
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
  const exact = (n: unknown, d: unknown) => n == null || d == null ? undefined : { numerator: String(n), denominator: String(d) };
  const result = row.result === "WIN" || row.result === "LOSS" || row.result === "TIE" ? row.result : null;
  return {
    id: Number(row.id), symbol: String(row.symbol), direction: row.direction === "DOWN" ? "DOWN" : "UP",
    amount: Number(row.amount), amountExact: exact(row.amount_numerator, row.amount_denominator),
    payout: row.payout == null ? null : Number(row.payout), payoutExact: exact(row.payout_numerator, row.payout_denominator) ?? null,
    openPrice: Number(row.open_price), closePrice: row.close_price == null ? null : Number(row.close_price),
    durationSec: Number(row.duration_sec), status: row.status === "SETTLED" ? "SETTLED" : "OPEN", result,
    openedAt: iso(row.opened_at), closesAt: iso(row.closes_at),
  };
}

