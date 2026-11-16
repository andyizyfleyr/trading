import { sql, type SQL } from "drizzle-orm";
import type { ExactMoney } from "./exact-money";

/**
 * Prépare un mouvement atomique sur le solde exact. Le contrôle et l'écriture
 * ont lieu sur la même ligne verrouillée ; deux mises ne peuvent pas dépenser
 * le même solde. La colonne historique est une approximation de compatibilité,
 * jamais la source des calculs exacts. La migration doit être appliquée avant.
 */
export function exactBalanceChange(userId: number, amount: ExactMoney, direction: "credit" | "debit"): SQL {
  if (!Number.isSafeInteger(userId) || userId <= 0 || amount.numerator <= BigInt(0) || amount.denominator <= BigInt(0)) {
    throw new Error("Mouvement invalide");
  }
  const n = amount.numerator.toString();
  const d = amount.denominator.toString();
  const sign = direction === "credit" ? sql`+` : sql`-`;
  const affordable = direction === "debit"
    ? sql`AND balance_numerator * ${d}::numeric >= ${n}::numeric * balance_denominator`
    : sql``;
  return sql`
    WITH locked AS (
      SELECT id, balance_numerator AS n, balance_denominator AS d
      FROM users WHERE id = ${userId} ${affordable} FOR UPDATE
    ), calculated AS (
      SELECT id, n * ${d}::numeric ${sign} ${n}::numeric * d AS n,
        d * ${d}::numeric AS d FROM locked
    ), reduced AS (
      SELECT id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    )
    UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
      balance = (reduced.n / reduced.d)::double precision
    FROM reduced WHERE users.id = reduced.id
    RETURNING users.balance, users.balance_numerator::text AS numerator,
      users.balance_denominator::text AS denominator`;
}
