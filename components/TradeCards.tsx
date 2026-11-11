"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtMoney, fmtPrice, fmtSigned, symbolBase } from "@/lib/format";
import { durationLabel } from "@/lib/symbols";
import { Btn, Card } from "./ui";
import { CountdownRing } from "./CountdownRing";

/* ---------- Prédiction en cours ---------- */

export function ActiveTradeCard({ trade, price }: { trade: ApiTrade; price: number | null }) {
  const isUp = trade.direction === "UP";
  const winning =
    price == null || price === trade.openPrice
      ? null
      : isUp
        ? price > trade.openPrice
        : price < trade.openPrice;

  return (
    <Card className="anim-in">
      <div className="flex items-center gap-3">
        <CountdownRing closesAt={trade.closesAt} durationSec={trade.durationSec} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-lg px-2.5 py-1 text-base font-extrabold ${
                isUp ? "bg-hausse/15 text-hausse" : "bg-baisse/15 text-baisse"
              }`}
            >
              {isUp ? "ACHAT ▲" : "VENTE ▼"}
            </span>
            <span className="text-base font-bold">{symbolBase(trade.symbol)}/USDT</span>
            <span className="text-sm font-semibold text-doux">{durationLabel(trade.durationSec)}</span>
          </div>
          <dl className="mt-2 space-y-1 text-base tabular-nums">
            <div className="flex justify-between gap-2">
              <dt className="text-doux">Mise</dt>
              <dd className="font-bold">{fmtMoney(trade.amount)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-doux">Prix d&apos;ouverture</dt>
              <dd className="font-bold">{fmtPrice(trade.openPrice)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-doux">Prix actuel</dt>
              <dd
                className={`font-bold ${
                  winning == null ? "" : winning ? "text-hausse" : "text-baisse"
                }`}
              >
                {price == null ? (
                  "…"
                ) : (
                  <>
                    {winning == null ? "" : winning ? "▲ " : "▼ "}
                    {fmtPrice(price)}
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Résultat ---------- */

export function ResultCard({ trade, onReplay }: { trade: ApiTrade; onReplay: () => void }) {
  const isUp = trade.direction === "UP";
  const net =
    trade.result === "WIN"
      ? (trade.payout ?? 0) - trade.amount
      : trade.result === "LOSS"
        ? -trade.amount
        : 0;

  const tone =
    trade.result === "WIN"
      ? { text: "text-hausse", bg: "bg-hausse/15", arrow: "▲" }
      : trade.result === "LOSS"
        ? { text: "text-baisse", bg: "bg-baisse/15", arrow: "▼" }
        : { text: "text-action", bg: "bg-action/15", arrow: "±" };

  const title =
    trade.result === "WIN"
      ? "Bonne prédiction !"
      : trade.result === "LOSS"
        ? "Prédiction ratée"
        : "Égalité : mise rendue";

  return (
    <Card className={`anim-in ${tone.bg} border-transparent`}>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-semibold">{title}</p>
        <p className={`text-4xl font-extrabold tabular-nums ${tone.text}`}>
          {tone.arrow ? `${tone.arrow} ` : ""}
          {fmtSigned(net)}
        </p>
        <p className="text-base tabular-nums">
          {trade.result === "WIN" && (
            <span className="font-bold">
              {fmtMoney(net)} gagnés <span className="text-doux">(mise + 85 %)</span>
            </span>
          )}
          {trade.result === "LOSS" && (
            <span className="font-bold">-{fmtMoney(trade.amount)}</span>
          )}
          {trade.result === "TIE" && (
            <span className="font-bold">{fmtMoney(trade.amount)} rendus</span>
          )}
        </p>
        <p className="mt-1 text-sm text-doux tabular-nums">
          {isUp ? "ACHAT" : "VENTE"} · {symbolBase(trade.symbol)}/USDT · {durationLabel(trade.durationSec)}
          <br />
          {fmtPrice(trade.openPrice)} → {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
        </p>
        <Btn onClick={onReplay} className="mt-2 w-full" variant="primary">
          Rejouer
        </Btn>
      </div>
    </Card>
  );
}
