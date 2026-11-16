import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decimalFraction, exactToUsd } from "../lib/exact-money";
import { exactOpenTradeQuery } from "../lib/exact-open-trade";
import { exactCancelTradeQuery } from "../lib/exact-cancel-trade";

test("annuler une mise programmée rembourse exactement une seule fois", async () => {
  const client = new PGlite();
  try {
    await client.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
      CREATE TABLE trades (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), symbol text NOT NULL, direction text NOT NULL,
        amount double precision NOT NULL, open_price double precision NOT NULL, duration_sec integer NOT NULL, status text NOT NULL,
        payout double precision, opened_at timestamp NOT NULL, closes_at timestamp NOT NULL);
      CREATE TABLE combos (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
      INSERT INTO users VALUES (1, 10);`);
    await client.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
    const db = drizzle(client);
    const opened = await db.execute(exactOpenTradeQuery({ userId: 1, symbol: "TEST", direction: "UP", amount: exactToUsd(decimalFraction("1000"), "XOF"),
      openPrice: 7, durationSec: 60, openedAt: new Date("2026-01-01T00:01:00Z"), closesAt: new Date("2026-01-01T00:02:00Z") }));
    const id = Number(opened.rows[0].id);
    const refund = await db.execute(exactCancelTradeQuery(1, id, new Date("2026-01-01T00:00:00Z")));
    assert.equal(refund.rows.length, 1);
    assert.equal(refund.rows[0].numerator, "10");
    assert.equal(refund.rows[0].denominator, "1");
    assert.equal((await db.execute(exactCancelTradeQuery(1, id, new Date("2026-01-01T00:00:00Z")))).rows.length, 0);
  } finally { await client.close(); }
});
