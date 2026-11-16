import { sql, type SQL } from "drizzle-orm";
import { addExact, decimalFraction, type ExactMoney } from "./exact-money";
import { RULES } from "./symbols";

export interface ExactComboLeg {
  symbol: string;
  direction: "UP" | "DOWN";
  openPrice: number;
  durationSec: number;
  openedAt: string;
  closesAt: string;
}

/** Débite et insère le combiné et toutes ses jambes dans la même requête. */
export function exactOpenComboQuery(userId: number, amount: ExactMoney, legs: ExactComboLeg[]): SQL {
  if (!Number.isSafeInteger(userId) || userId <= 0 || amount.numerator <= BigInt(0) || amount.denominator <= BigInt(0) || legs.length < 2 || legs.length > 5) throw new Error("Combiné invalide");
  const n = amount.numerator.toString();
  const d = amount.denominator.toString();
  return sql`
    WITH locked AS (
      SELECT id, balance_numerator AS n, balance_denominator AS d FROM users
      WHERE id = ${userId} AND balance_numerator * ${d}::numeric >= ${n}::numeric * balance_denominator FOR UPDATE
    ), calculated AS (
      SELECT id, n * ${d}::numeric - ${n}::numeric * d AS n, d * ${d}::numeric AS d FROM locked
    ), reduced AS (
      SELECT id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    ), debit AS (
      UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
        balance = (reduced.n / reduced.d)::double precision FROM reduced WHERE users.id = reduced.id
      RETURNING users.id, users.balance, users.balance_numerator, users.balance_denominator
    ), inserted AS (
      INSERT INTO combos (user_id, amount, amount_numerator, amount_denominator, status)
      SELECT id, (${n}::numeric / ${d}::numeric)::double precision, ${n}::numeric, ${d}::numeric, 'OPEN' FROM debit RETURNING *
    ), inserted_legs AS (
      INSERT INTO combo_legs (combo_id, symbol, direction, open_price, duration_sec, status, opened_at, closes_at)
      SELECT inserted.id, l.symbol, l.direction, l.\"openPrice\", l.\"durationSec\", 'OPEN', l.\"openedAt\", l.\"closesAt\"
      FROM inserted CROSS JOIN jsonb_to_recordset(${JSON.stringify(legs)}::jsonb) AS l(
        symbol text, direction text, \"openPrice\" double precision, \"durationSec\" integer,
        \"openedAt\" timestamp, \"closesAt\" timestamp)
      RETURNING *
    )
    SELECT inserted.*, debit.balance, debit.balance_numerator::text AS numerator,
      debit.balance_denominator::text AS denominator, (SELECT count(*) FROM inserted_legs) AS leg_count,
      (SELECT json_agg(inserted_legs) FROM inserted_legs) AS legs
    FROM inserted JOIN debit ON debit.id = inserted.user_id`;
}

/** Règle et crédite un combiné sans arrondir entre ses jambes. */
export function exactSettleComboQuery(userId: number, comboId: number, wins: number, loss: boolean, maxPayout: number): SQL {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(comboId) || comboId <= 0 ||
      !Number.isSafeInteger(wins) || wins < 0 || wins > 5 || !Number.isSafeInteger(maxPayout) || maxPayout <= 0) throw new Error("Combiné invalide");
  const factor = addExact(decimalFraction("1"), decimalFraction(String(RULES.WIN_PAYOUT_RATIO)));
  const factorN = loss ? "0" : (factor.numerator ** BigInt(wins)).toString();
  const factorD = (factor.denominator ** BigInt(wins)).toString();
  const result = loss ? "LOSS" : wins ? "WIN" : "TIE";
  return sql`
    WITH eligible AS (
      SELECT id, user_id, amount_numerator * ${factorN}::numeric AS n,
        amount_denominator * ${factorD}::numeric AS d
      FROM combos WHERE id = ${comboId} AND user_id = ${userId} AND status = 'OPEN' FOR UPDATE
    ), capped AS (
      SELECT id, user_id, CASE WHEN n > ${maxPayout}::numeric * d THEN ${maxPayout}::numeric ELSE n END AS n,
        CASE WHEN n > ${maxPayout}::numeric * d THEN 1::numeric ELSE d END AS d FROM eligible
    ), payout AS (
      SELECT id, user_id, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM capped
    ), locked AS (
      SELECT users.id, users.balance_numerator AS n, users.balance_denominator AS d,
        payout.n AS pn, payout.d AS pd, payout.id AS combo_id
      FROM users JOIN payout ON payout.user_id = users.id FOR UPDATE OF users
    ), calculated AS (
      SELECT id, combo_id, pn, pd, n * pd + pn * d AS n, d * pd AS d FROM locked
    ), reduced AS (
      SELECT id, combo_id, pn, pd, div(n, gcd(abs(n), d)) AS n, div(d, gcd(abs(n), d)) AS d FROM calculated
    ), credited AS (
      UPDATE users SET balance_numerator = reduced.n, balance_denominator = reduced.d,
        balance = (reduced.n / reduced.d)::double precision FROM reduced WHERE users.id = reduced.id
      RETURNING users.id, reduced.combo_id, reduced.pn, reduced.pd
    )
    UPDATE combos SET status = 'SETTLED', result = ${result}, payout_numerator = credited.pn,
      payout_denominator = credited.pd, payout = (credited.pn / credited.pd)::double precision
    FROM credited WHERE combos.id = credited.combo_id RETURNING combos.id`;
}
