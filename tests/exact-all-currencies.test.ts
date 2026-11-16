import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { setDbForTests } from "../lib/db";
import { SCHEMA_STATEMENTS } from "../lib/schema-ensure";
import { signToken } from "../lib/auth";
import { decimalFraction, exactToUsd } from "../lib/exact-money";
import { formatExactMoney, type CurrencyCode } from "../lib/money";
import { POST as deposit } from "../app/api/me/deposit/route";
import { POST as open } from "../app/api/trades/route";
import { POST as settle } from "../app/api/trades/settle/route";

test("chaque devise : mise réelle puis gain affiché sans arrondi intermédiaire", async () => {
  const client = new PGlite();
  try {
    setDbForTests(drizzle(client));
    for (const statement of SCHEMA_STATEMENTS) await client.exec(statement);
    const cases: Array<[CurrencyCode, string, string]> = [
      ["USD", "100", "185,00 $"], ["EUR", "100", "185,00 €"], ["GBP", "100", "185,00 £"],
      ["XOF", "10000", "18 500 ₣"], ["NGN", "20000", "37 000 ₦"], ["GHS", "200", "370 ₵"],
    ];
    for (let i = 0; i < cases.length; i++) {
      const [currency, amount, expected] = cases[i];
      const id = i + 1;
      await client.query(`INSERT INTO users (id,email,password_hash,balance,currency) VALUES ($1,$2,'hash',0,$3)`, [id, `user${id}@example.com`, currency]);
      const token = await signToken(id);
      const req = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const dep = await deposit(req("/api/me/deposit", { amount: 1000 }));
      assert.equal(dep.status, 200, currency);
      const exact = exactToUsd(decimalFraction(amount), currency);
      const wire = { numerator: exact.numerator.toString(), denominator: exact.denominator.toString() };
      const opened = await open(req("/api/trades", { symbol: "EURUSDOTC", direction: "UP", amount: 0, amountExact: wire, durationSec: 60 }));
      assert.equal(opened.status, 201, `${currency}: ${await opened.clone().text()}`);
      const placed = (await opened.json()).data;
      await client.query(`UPDATE trades SET open_price = 0.001, closes_at = NOW() - interval '1 minute' WHERE id = $1`, [placed.trade.id]);
      const finished = await settle(req("/api/trades/settle", {}));
      assert.equal(finished.status, 200, `${currency}: ${await finished.clone().text()}`);
      const result = (await finished.json()).data.settled[0];
      assert.equal(result.result, "WIN", currency);
      assert.equal(formatExactMoney(result.payoutExact, currency, "fr"), expected, currency);
    }
  } finally { setDbForTests(null); await client.close(); }
});
