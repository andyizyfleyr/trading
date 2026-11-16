import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decimalFraction, exactFromUsd, exactToUsd, truncateExact } from "../lib/exact-money";
import { creditExact, debitExact, tradePayoutExact } from "../lib/exact-ledger";

const d = decimalFraction;

test("mise et gain exacts en ₣ avec conversion USD réversible", () => {
  const stake = exactToUsd(d("1000"), "XOF");
  const initial = exactToUsd(d("10000"), "XOF");
  const afterBet = debitExact(initial, stake);
  assert.equal(truncateExact(exactFromUsd(afterBet, "XOF"), 0), "9000");
  const payout = tradePayoutExact(stake, "WIN");
  assert.equal(truncateExact(exactFromUsd(payout, "XOF"), 0), "1850");
  assert.equal(truncateExact(exactFromUsd(creditExact(afterBet, payout), "XOF"), 0), "10850");
});

test("annulation et égalité remboursent exactement la mise", () => {
  const initial = d("50.001");
  const stake = exactToUsd(d("1000"), "XOF");
  const remaining = debitExact(initial, stake);
  assert.deepEqual(creditExact(remaining, stake), initial);
  assert.deepEqual(creditExact(remaining, tradePayoutExact(stake, "TIE")), initial);
  assert.deepEqual(creditExact(remaining, tradePayoutExact(stake, "LOSS")), remaining);
});

test("interdit les mises invalides et les soldes insuffisants", () => {
  assert.throws(() => debitExact(d("1"), d("2")));
  assert.throws(() => debitExact(d("1"), d("0")));
  assert.throws(() => creditExact(d("1"), d("-1")));
  assert.throws(() => tradePayoutExact(d("-1"), "WIN"));
});
