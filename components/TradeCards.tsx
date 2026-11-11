"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtMoney, fmtPrice, fmtSigned, symbolBase } from "@/lib/format";
import { durationLabel, symbolDisplay } from "@/lib/symbols";
import { Btn, Card } from "./ui";
import { CountdownRing } from "./CountdownRing";

/* ---------- Prédiction en cours (compacte, pour panneau) ---------- */

export function ActiveTradeCard({ trade, price }: { trade: ApiTrade; price: number | null }) {
  const isUp = trade.direction === "UP";
  const winning =
    price == null || price === trade.openPrice
      ? null
      : isUp
        ? price > trade.openPrice
        : price < trade.openPrice;

  return (
    <Card className="anim-in p-2.5">
      <div className="flex items-center gap-2.5">
        <CountdownRing closesAt={trade.closesAt} durationSec={trade.durationSec} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-lg px-2 py-0.5 text-sm font-extrabold ${
                isUp ? "bg-hausse/15 text-hausse" : "bg-baisse/15 text-baisse"
              }`}
            >
              {isUp ? "ACHAT ▲" : "VENTE ▼"}
            </span>
            <span className="text-sm font-bold">{symbolBase(trade.symbol)}</span>
            <span className="text-xs font-semibold text-doux">{durationLabel(trade.durationSec)}</span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1 text-center tabular-nums">
            <div>
              <p className="text-xs leading-tight text-doux">Mise</p>
              <p className="text-sm font-bold leading-tight">{fmtMoney(trade.amount)}</p>
            </div>
            <div>
              <p className="text-xs leading-tight text-doux">Départ</p>
              <p className="text-sm font-bold leading-tight">{fmtPrice(trade.openPrice)}</p>
            </div>
            <div>
              <p className="text-xs leading-tight text-doux">Actuel</p>
              <p
                className={`text-sm font-bold leading-tight ${
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
              </p>
            </div>
          </div>
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
        : { text: "text-action", bg: "bg-action/15", arrow: "" };

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
        <p className={`text-3xl font-extrabold tabular-nums ${tone.text}`}>
          {tone.arrow ? `${tone.arrow} ` : ""}
          {fmtSigned(net)}
        </p>
        <p className="text-sm tabular-nums">
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
        <p className="mt-1 text-xs text-doux tabular-nums">
          {isUp ? "ACHAT" : "VENTE"} · {symbolDisplay(trade.symbol)} · {durationLabel(trade.durationSec)}
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
