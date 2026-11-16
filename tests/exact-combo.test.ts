import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decimalFraction } from "../lib/exact-money";
import { exactOpenComboQuery, exactSettleComboQuery, type ExactComboLeg } from "../lib/exact-combo";

test("un combiné est débité et réglé exactement, une seule fois", async () => {
  const client = new PGlite();
  try {
    await client.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
      CREATE TABLE trades (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
      CREATE TABLE combos (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), amount double precision NOT NULL, status text NOT NULL, result text, payout double precision);
      CREATE TABLE combo_legs (id serial PRIMARY KEY, combo_id integer NOT NULL REFERENCES combos(id), symbol text NOT NULL, direction text NOT NULL, open_price double precision NOT NULL, duration_sec integer NOT NULL, status text NOT NULL, opened_at timestamp NOT NULL, closes_at timestamp NOT NULL);
      INSERT INTO users VALUES (1, 100);`);
    await client.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
    const db = drizzle(client);
    const leg: ExactComboLeg = { symbol: "TEST", direction: "UP", openPrice: 7, durationSec: 60, openedAt: "2026-01-01T00:00:00Z", closesAt: "2026-01-01T00:01:00Z" };
    const open = await db.execute(exactOpenComboQuery(1, decimalFraction("10"), [leg, leg]));
    assert.equal(open.rows.length, 1);
    assert.equal(Number(open.rows[0].leg_count), 2);
    const id = Number(open.rows[0].id);
    const settled = await db.execute(exactSettleComboQuery(1, id, 2, false, 5000000));
    assert.equal(settled.rows.length, 1);
    assert.equal((await db.execute(exactSettleComboQuery(1, id, 2, false, 5000000))).rows.length, 0);
    const saved = await client.query<{ n: string; d: string }>(`SELECT balance_numerator::text n, balance_denominator::text d FROM users WHERE id=1`);
    assert.equal(BigInt(saved.rows[0].n) * BigInt(40), BigInt(4969) * BigInt(saved.rows[0].d)); // 90 + 34,225
  } finally { await client.close(); }
});
