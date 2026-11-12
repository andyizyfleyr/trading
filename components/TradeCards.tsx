"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtGain, fmtMoney, fmtPrice, fmtSigned } from "@/lib/format";
import { RULES, durationLabel, isOtc, symbolDisplay } from "@/lib/symbols";
import { BTN, CARD, ENCOURS, RESULT, RING, TRADE } from "@/lib/design";
import { Btn } from "./ui";
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
