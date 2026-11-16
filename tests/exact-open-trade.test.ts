import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decimalFraction, exactToUsd } from "../lib/exact-money";
import { exactOpenTradeQuery, type ExactOpenTrade } from "../lib/exact-open-trade";

async function setup() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
    CREATE TABLE trades (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), symbol text NOT NULL CHECK (symbol <> 'INVALID'),
      direction text NOT NULL, amount double precision NOT NULL, open_price double precision NOT NULL, duration_sec integer NOT NULL,
      status text NOT NULL, payout double precision, opened_at timestamp NOT NULL, closes_at timestamp NOT NULL);
    INSERT INTO users VALUES (1, 10);`);
  await client.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
  return { client, db: drizzle(client) };
}
function input(amount = "1000"): ExactOpenTrade {
  return { userId: 1, symbol: "TEST", direction: "UP", amount: exactToUsd(decimalFraction(amount), "XOF"),
    openPrice: 7, durationSec: 60, openedAt: new Date("2026-01-01T00:00:00Z"), closesAt: new Date("2026-01-01T00:01:00Z") };
}

test("ouverture : la mise exacte est enregistrée et le solde débité atomiquement", async () => {
  const { client, db } = await setup();
  try {
    const order = input();
    const result = await db.execute(exactOpenTradeQuery(order));
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    assert.equal(String(row.amount_numerator), order.amount.numerator.toString());
    assert.equal(String(row.amount_denominator), order.amount.denominator.toString());
    const saved = await client.query<{ n: string; d: string }>(`SELECT balance_numerator::text n, balance_denominator::text d FROM users WHERE id=1`);
    const bal = saved.rows[0];
    assert.equal(BigInt(bal.n) * order.amount.denominator + order.amount.numerator * BigInt(bal.d), BigInt(10) * BigInt(bal.d) * order.amount.denominator);
  } finally { await client.close(); }
});

test("échec de l'insertion : le débit est annulé", async () => {
  const { client, db } = await setup();
  try {
    await assert.rejects(db.execute(exactOpenTradeQuery({ ...input(), symbol: "INVALID" })));
    const result = await client.query<{ n: string; d: string }>(`SELECT balance_numerator::text n, balance_denominator::text d FROM users WHERE id=1`);
    assert.equal(BigInt(result.rows[0].n), BigInt(10) * BigInt(result.rows[0].d));
    assert.equal((await client.query(`SELECT id FROM trades`)).rows.length, 0);
  } finally { await client.close(); }
});

test("une mise trop élevée ne débite et ne crée rien", async () => {
  const { client, db } = await setup();
  try {
    const result = await db.execute(exactOpenTradeQuery(input("10000")));
    assert.equal(result.rows.length, 0);
    assert.equal((await client.query(`SELECT id FROM trades`)).rows.length, 0);
  } finally { await client.close(); }
});
