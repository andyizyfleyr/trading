"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtMoney, fmtPrice, fmtSigned } from "@/lib/format";
import { RULES, durationLabel, isOtc, symbolDisplay } from "@/lib/symbols";
import { BTN, CARD, LAYOUT, RESULT, RING, TONE, TRADE, TRADER } from "@/lib/design";
import { Btn } from "./ui";
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
    <div className={CARD.active}>
      <div className={RESULT.row}>
        <CountdownRing closesAt={trade.closesAt} durationSec={trade.durationSec} size={RING.card} />
        <div className={LAYOUT.cardMain}>
          <div className={LAYOUT.cardHead}>
            <span className={isUp ? TONE.up : TONE.down}>
              {isUp ? "ACHAT ▲" : "VENTE ▼"}
            </span>
            <span className={TRADE.name}>{symbolDisplay(trade.symbol)}</span>
            <span className={TRADE.dur}>{durationLabel(trade.durationSec)}</span>
            {isOtc(trade.symbol) && (
              <span className={TRADER.tag}>
                JEU
              </span>
            )}
          </div>
          <div className={TRADE.stats}>
            <div>
              <p className={TRADE.statLabel}>Mise</p>
              <p className={TRADE.statVal}>{fmtMoney(trade.amount)}</p>
            </div>
            <div>
              <p className={TRADE.statLabel}>Départ</p>
              <p className={TRADE.statVal}>{fmtPrice(trade.openPrice)}</p>
            </div>
            <div>
              <p className={TRADE.statLabel}>Actuel</p>
              <p
                className={`${TRADE.statVal} ${
                  winning == null ? "" : winning ? TRADE.statUp : TRADE.statDown
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
    </div>
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
      ? { text: RESULT.winText, bg: RESULT.winBg, arrow: "▲" }
      : trade.result === "LOSS"
        ? { text: RESULT.lossText, bg: RESULT.lossBg, arrow: "▼" }
        : { text: RESULT.tieText, bg: RESULT.tieBg, arrow: "" };

  const title =
    trade.result === "WIN"
      ? "Bonne prédiction !"
      : trade.result === "LOSS"
        ? "Prédiction ratée"
        : "Égalité : mise rendue";

  return (
    <div className={`${CARD.result} ${tone.bg}`}>
      <div className={RESULT.col}>
        <p className={TRADE.resultTitle}>{title}</p>
        <p className={`${TRADE.resultNet} ${tone.text}`}>
          {tone.arrow ? `${tone.arrow} ` : ""}
          {fmtSigned(net)}
        </p>
        <p className={TRADE.resultLine}>
          {trade.result === "WIN" && (
            <span className={TRADE.resultWin}>
              {fmtMoney(net)} gagnés{" "}
              <span className={TRADE.resultMuted}>
                (mise + {Math.round(RULES.WIN_PAYOUT_RATIO * 100)} %)
              </span>
            </span>
          )}
          {trade.result === "LOSS" && (
            <span className={TRADE.resultWin}>-{fmtMoney(trade.amount)}</span>
          )}
          {trade.result === "TIE" && (
            <span className={TRADE.resultWin}>{fmtMoney(trade.amount)} rendus</span>
          )}
        </p>
        <p className={TRADE.resultMeta}>
          {isUp ? "ACHAT" : "VENTE"} · {symbolDisplay(trade.symbol)}
          {isOtc(trade.symbol) ? " · JEU" : ""} · {durationLabel(trade.durationSec)}
          <br />
          {fmtPrice(trade.openPrice)} → {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
        </p>
        <Btn onClick={onReplay} className={`${BTN.block} ${RESULT.btn}`} variant="primary">
          Rejouer
        </Btn>
      </div>
    </div>
  );
}
