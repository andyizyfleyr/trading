import { sql, type SQL } from "drizzle-orm";
import type { ExactMoney } from "./exact-money";

/** Données validées par l'API ; les prix viennent exclusivement du serveur. */
export interface ExactOpenTrade {
  userId: number;
  symbol: string;
  direction: "UP" | "DOWN";
  amount: ExactMoney;
  openPrice: number;
  durationSec: number;
  openedAt: Date;
  closesAt: Date;
}

/**
 * Débite et crée une prédiction dans UNE requête PostgreSQL atomique.
 * En cas d'échec de l'insertion, PostgreSQL annule aussi le débit.
 * Le solde et la mise exacts sont des fractions ; les champs historiques
 * double sont conservés uniquement pour la compatibilité temporaire.
 */
export function exactOpenTradeQuery(input: ExactOpenTrade): SQL {
  const { userId, symbol, direction, amount, openPrice, durationSec, openedAt, closesAt } = input;
  if (!Number.isSafeInteger(userId) || userId <= 0 || amount.numerator <= BigInt(0) || amount.denominator <= BigInt(0) ||
      !Number.isFinite(openPrice) || openPrice <= 0 || !Number.isSafeInteger(durationSec) || durationSec <= 0 ||
      !Number.isFinite(openedAt.getTime()) || !Number.isFinite(closesAt.getTime())) {
    throw new Error("Prédiction invalide");
  }
  const n = amount.numerator.toString();
  const d = amount.denominator.toString();
  return sql`
    WITH locked AS (
      SELECT id, balance_numerator AS n, balance_denominator AS d
      FROM users WHERE id = ${userId}
        AND balance_numerator * ${d}::numeric >= ${n}::numeric * balance_denominator
      FOR UPDATE
    ), calculated AS (
      SELECT id, n * ${d}::numeric - ${n}::numeric * d AS n, d * ${d}::numeric AS d FROM locked
    ), reduced AS (
      SELECT id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    ), debit AS (
      UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
        balance = (reduced.n / reduced.d)::double precision
      FROM reduced WHERE users.id = reduced.id
      RETURNING users.id, users.balance, users.balance_numerator, users.balance_denominator
    ), inserted AS (
      INSERT INTO trades (user_id, symbol, direction, amount, amount_numerator, amount_denominator,
        open_price, duration_sec, status, opened_at, closes_at)
      SELECT debit.id, ${symbol}, ${direction}, (${n}::numeric / ${d}::numeric)::double precision,
        ${n}::numeric, ${d}::numeric, ${openPrice}, ${durationSec}, 'OPEN',
        ${openedAt.toISOString()}::timestamp, ${closesAt.toISOString()}::timestamp
      FROM debit RETURNING *
    )
    SELECT inserted.*, debit.balance AS balance_after,
      debit.balance_numerator::text AS balance_numerator_after,
      debit.balance_denominator::text AS balance_denominator_after
    FROM inserted JOIN debit ON debit.id = inserted.user_id`;
}
