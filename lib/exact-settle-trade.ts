import { sql, type SQL } from "drizzle-orm";

/**
 * Clôture une prédiction et crédite le solde en une seule requête atomique.
 * Les fractions restent exactes, y compris quand le taux de change donne
 * une infinité de décimales en USD. Les colonnes double sont un miroir ancien.
 */
export function exactSettleTradeQuery(userId: number, tradeId: number, result: "WIN" | "LOSS" | "TIE", closePrice: number, now: Date): SQL {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(tradeId) || tradeId <= 0 ||
      !Number.isFinite(closePrice) || closePrice <= 0 || !Number.isFinite(now.getTime())) {
    throw new Error("Clôture invalide");
  }
  const factorN = result === "WIN" ? 185 : result === "TIE" ? 1 : 0;
  const factorD = result === "WIN" ? 100 : 1;
  return sql`
    WITH eligible AS (
      SELECT id, user_id, amount_numerator * ${factorN}::numeric AS n,
        amount_denominator * ${factorD}::numeric AS d
      FROM trades WHERE id = ${tradeId} AND user_id = ${userId} AND status = 'OPEN'
        AND closes_at <= ${now.toISOString()}::timestamp FOR UPDATE
    ), payout AS (
      SELECT id, user_id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM eligible
    ), locked AS (
      SELECT users.id, users.balance_numerator AS n, users.balance_denominator AS d,
        payout.n AS pn, payout.d AS pd, payout.id AS trade_id
      FROM users JOIN payout ON payout.user_id = users.id FOR UPDATE OF users
    ), calculated AS (
      SELECT id, trade_id, pn, pd, n * pd + pn * d AS n, d * pd AS d FROM locked
    ), reduced AS (
      SELECT id, trade_id, pn, pd, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    ), credited AS (
      UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
        balance = (reduced.n / reduced.d)::double precision
      FROM reduced WHERE users.id = reduced.id
      RETURNING users.id, users.balance, users.balance_numerator, users.balance_denominator,
        reduced.trade_id, reduced.pn, reduced.pd
    ), settled AS (
      UPDATE trades SET status = 'SETTLED', result = ${result}, close_price = ${closePrice},
        payout_numerator = credited.pn, payout_denominator = credited.pd,
        payout = (credited.pn / credited.pd)::double precision
      FROM credited WHERE trades.id = credited.trade_id RETURNING trades.*
    )
    SELECT settled.*, credited.balance AS balance_after,
      credited.balance_numerator::text AS balance_numerator_after,
      credited.balance_denominator::text AS balance_denominator_after
    FROM settled JOIN credited ON credited.trade_id = settled.id`;
}
