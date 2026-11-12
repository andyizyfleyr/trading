"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtGain, fmtMoney, fmtPrice, fmtSigned } from "@/lib/format";
import { RULES, durationLabel, symbolDisplay } from "@/lib/symbols";
import { ENCOURS, RESULT, RING } from "@/lib/design";
import { CountdownRing } from "./CountdownRing";

/* ---------- Prédiction en cours (compacte, 2 lignes + trait vert/rouge) ---------- */

export function ActiveTradeCard({ trade, price }: { trade: ApiTrade; price: number | null }) {
  const isUp = trade.direction === "UP";
  // Écart prix actuel − prix de départ : la flèche suit le prix,
  // la couleur (vert/rouge) dit si le trade gagne ou perd.
  const diff = price == null ? null : price - trade.openPrice;
  const score = diff == null ? 0 : diff * (isUp ? 1 : -1);
  const winning = score > 0 ? true : score < 0 ? false : null;
  const tone = winning == null ? ENCOURS.toneFlat : winning ? ENCOURS.toneWin : ENCOURS.toneLoss;
  const toneText =
    winning == null ? ENCOURS.textFlat : winning ? ENCOURS.textWin : ENCOURS.textLoss;
  const arrow = diff == null || diff === 0 ? "" : diff > 0 ? "▲ " : "▼ ";
  // Estimation : gain net (+85 %) si ça gagne, mise perdue sinon, « = » si égalité.
  const est =
    winning == null
      ? "="
      : winning
        ? `+${fmtGain(trade.amount * RULES.WIN_PAYOUT_RATIO)}`
        : `−${fmtMoney(trade.amount)}`;

  return (
    <div className={`${ENCOURS.card} ${tone}`}>
      <CountdownRing
        closesAt={trade.closesAt}
        durationSec={trade.durationSec}
        size={RING.mini}
        compact
      />
      <div className={ENCOURS.mid}>
        <div className={ENCOURS.mid1}>
          <span className={isUp ? ENCOURS.dirUp : ENCOURS.dirDown}>
            {isUp ? "ACHAT ▲" : "VENTE ▼"}
          </span>
          <span>
            {symbolDisplay(trade.symbol)} · {durationLabel(trade.durationSec)}
          </span>
        </div>
        <p className={ENCOURS.mid2}>
          Mise <b className={ENCOURS.mid2B}>{fmtMoney(trade.amount)}</b> · Départ{" "}
          <b className={ENCOURS.mid2B}>{fmtPrice(trade.openPrice)}</b>
        </p>
      </div>
      <div className={ENCOURS.right}>
        <p className={`${ENCOURS.cur} ${toneText}`}>
          {price == null ? "…" : `${arrow}${fmtPrice(price)}`}
        </p>
        <p className={`${ENCOURS.est} ${toneText}`}>{est}</p>
      </div>
    </div>
  );
}

/* ---------- Résultat ---------- */

export function ResultCard({ trade, onReplay }: { trade: ApiTrade; onReplay: () => void }) {
  const isUp = trade.direction === "UP";
  const won = trade.result === "WIN";
  const lost = trade.result === "LOSS";
  const net = won ? (trade.payout ?? 0) - trade.amount : 0;
  const move = trade.closePrice == null ? null : trade.closePrice - trade.openPrice;

  const title = won ? "Prédiction gagnée" : lost ? "Prédiction ratée" : "Égalité : mise rendue";
  const amount = won ? `+${fmtGain(net)}` : lost ? `−${fmtMoney(trade.amount)}` : fmtSigned(0);
  const moveArrow = move == null || move === 0 ? "" : move > 0 ? "▲ " : "▼ ";

  return (
    <>
      <div className={`${RESULT.box} ${won ? RESULT.boxWin : lost ? RESULT.boxLoss : RESULT.boxTie}`}>
        <div className={RESULT.top}>
          <span
            className={`${RESULT.icon} ${won ? RESULT.iconWin : lost ? RESULT.iconLoss : RESULT.iconTie}`}
            aria-hidden="true"
          >
            {won ? "✓" : lost ? "✕" : "="}
          </span>
          <p className={RESULT.title}>
            {title}
            <small className={RESULT.sub}>
              {isUp ? "ACHAT ▲" : "VENTE ▼"} · {symbolDisplay(trade.symbol)} ·{" "}
              {durationLabel(trade.durationSec)}
            </small>
          </p>
          <p className={`${RESULT.amt} ${won ? RESULT.amtWin : lost ? RESULT.amtLoss : RESULT.amtTie}`}>
            {amount}
          </p>
        </div>
        <p className={RESULT.move}>
          <span>
            Départ <b className={RESULT.moveB}>{fmtPrice(trade.openPrice)}</b>
          </span>
          <span aria-hidden="true">→</span>
          <span>
            Arrivée{" "}
            <b className={RESULT.moveB}>
              {trade.closePrice != null ? fmtPrice(trade.closePrice) : "…"}
            </b>
          </span>
          <span className={RESULT.moveFar}>
            {move == null ? "…" : `${moveArrow}${fmtPrice(Math.abs(move))}`}
          </span>
        </p>
      </div>
      <button type="button" onClick={onReplay} className={RESULT.again}>
        Rejouer · {fmtMoney(trade.amount)} {isUp ? "▲" : "▼"}
      </button>
    </>
  );
}
