import { sql, type SQL } from "drizzle-orm";

/** Supprime une mise programmée et la rembourse exactement, en une requête. */
export function exactCancelTradeQuery(userId: number, tradeId: number, now: Date): SQL {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(tradeId) || tradeId <= 0 || !Number.isFinite(now.getTime())) {
    throw new Error("Annulation invalide");
  }
  return sql`
    WITH deleted AS (
      DELETE FROM trades WHERE id = ${tradeId} AND user_id = ${userId} AND status = 'OPEN'
        AND opened_at > ${now.toISOString()}::timestamp
      RETURNING user_id, amount_numerator AS n, amount_denominator AS d
    ), locked AS (
      SELECT users.id, users.balance_numerator AS n, users.balance_denominator AS d,
        deleted.n AS refund_n, deleted.d AS refund_d
      FROM users JOIN deleted ON deleted.user_id = users.id FOR UPDATE OF users
    ), calculated AS (
      SELECT id, n * refund_d + refund_n * d AS n, d * refund_d AS d FROM locked
    ), reduced AS (
      SELECT id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    )
    UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
      balance = (reduced.n / reduced.d)::double precision
    FROM reduced WHERE users.id = reduced.id
    RETURNING users.balance, users.balance_numerator::text AS numerator,
      users.balance_denominator::text AS denominator`;
}
