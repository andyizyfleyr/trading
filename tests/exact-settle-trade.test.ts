import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decimalFraction, exactToUsd, exactFromUsd, fraction, subtractExact, truncateExact } from "../lib/exact-money";
import { exactOpenTradeQuery } from "../lib/exact-open-trade";
import { exactSettleTradeQuery } from "../lib/exact-settle-trade";

async function setup() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
    CREATE TABLE trades (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), symbol text NOT NULL, direction text NOT NULL,
      amount double precision NOT NULL, open_price double precision NOT NULL, close_price double precision, duration_sec integer NOT NULL,
      status text NOT NULL, result text, payout double precision, opened_at timestamp NOT NULL, closes_at timestamp NOT NULL);
    INSERT INTO users VALUES (1, 10);`);
  await client.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
  return { client, db: drizzle(client) };
}

test("mise, règlement et solde exacts ; un deuxième règlement ne paie pas deux fois", async () => {
  const { client, db } = await setup();
  try {
    const amount = exactToUsd(decimalFraction("1000"), "XOF");
    const opened = await db.execute(exactOpenTradeQuery({ userId: 1, symbol: "TEST", direction: "UP", amount, openPrice: 7, durationSec: 60,
      openedAt: new Date("2026-01-01T00:00:00Z"), closesAt: new Date("2026-01-01T00:01:00Z") }));
    const tradeId = Number(opened.rows[0].id);
    const settled = await db.execute(exactSettleTradeQuery(1, tradeId, "WIN", 8, new Date("2026-01-01T00:02:00Z")));
    assert.equal(settled.rows.length, 1);
    const row = settled.rows[0];
    const payout = fraction(BigInt(String(row.payout_numerator)), BigInt(String(row.payout_denominator)));
    assert.equal(truncateExact(exactFromUsd(payout, "XOF"), 0), "1850");
    const balance = fraction(BigInt(String(row.balance_numerator_after)), BigInt(String(row.balance_denominator_after)));
    assert.equal(truncateExact(exactFromUsd(balance, "XOF"), 0), "6884"); // 10 USD → 6034,8044 ₣ ; +850 ₣
    const again = await db.execute(exactSettleTradeQuery(1, tradeId, "WIN", 8, new Date("2026-01-01T00:02:00Z")));
    assert.equal(again.rows.length, 0);
  } finally { await client.close(); }
});

test("égalité et défaite : remboursement exact ou aucune somme créditée", async () => {
  for (const result of ["TIE", "LOSS"] as const) {
    const { client, db } = await setup();
    try {
      const amount = exactToUsd(decimalFraction("1000"), "XOF");
      const opened = await db.execute(exactOpenTradeQuery({ userId: 1, symbol: "TEST", direction: "UP", amount, openPrice: 7, durationSec: 60,
        openedAt: new Date("2026-01-01T00:00:00Z"), closesAt: new Date("2026-01-01T00:01:00Z") }));
      const id = Number(opened.rows[0].id);
      assert.equal((await db.execute(exactSettleTradeQuery(1, id, result, 7, new Date("2026-01-01T00:00:30Z")))).rows.length, 0);
      const settled = await db.execute(exactSettleTradeQuery(1, id, result, 7, new Date("2026-01-01T00:02:00Z")));
      const row = settled.rows[0];
      const balance = fraction(BigInt(String(row.balance_numerator_after)), BigInt(String(row.balance_denominator_after)));
      assert.deepEqual(balance, result === "TIE" ? decimalFraction("10") : subtractExact(decimalFraction("10"), amount));
      const payout = fraction(BigInt(String(row.payout_numerator)), BigInt(String(row.payout_denominator)));
      assert.deepEqual(payout, result === "TIE" ? amount : decimalFraction("0"));
    } finally { await client.close(); }
  }
});
