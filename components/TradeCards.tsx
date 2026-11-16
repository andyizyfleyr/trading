"use client";

import type { ApiTrade } from "@/lib/types";
import { fmtGamePrice, fmtSigned } from "@/lib/format";
import { useMoney } from "@/hooks/useMoney";
import { useLang } from "@/lib/lang-context";
import { addExact, decimalFraction, fraction, multiplyExact } from "@/lib/exact-money";
import { RULES, durationLabel, symbolDisplay } from "@/lib/symbols";
import { ENCOURS, RESULT, RING } from "@/lib/design";
import { CountdownRing } from "./CountdownRing";

/* ---------- Prédiction en cours (compacte, 2 lignes + trait vert/rouge) ---------- */

export function ActiveTradeCard({ trade, price }: { trade: ApiTrade; price: number | null }) {
  const { money } = useMoney();
  const { t, lang } = useLang();
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
  // Le calcul reste exact même quand la mise en USD a une infinité de décimales.
  const gainExact = trade.amountExact ? multiplyExact(
    fraction(BigInt(trade.amountExact.numerator), BigInt(trade.amountExact.denominator)),
    addExact(decimalFraction("1"), decimalFraction(String(RULES.WIN_PAYOUT_RATIO)))
  ) : null;
  const wireGain = gainExact ? { numerator: gainExact.numerator.toString(), denominator: gainExact.denominator.toString() } : undefined;
  // Estimation : mise + bénéfice (×1,85) si ça gagne, mise perdue sinon, « = » si égalité.
  const est =
    winning == null
      ? "="
      : winning
        ? `+${money(trade.amount * (1 + RULES.WIN_PAYOUT_RATIO), wireGain)}`
        : `−${money(trade.amount, trade.amountExact)}`;

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
            {isUp ? t("Hausse ▲") : t("Baisse ▼")}
          </span>
          <span>
            {symbolDisplay(trade.symbol)} · {durationLabel(trade.durationSec)}
          </span>
        </div>
        <p className={ENCOURS.mid2}>
          {t("Mise")} <b className={ENCOURS.mid2B}>{money(trade.amount, trade.amountExact)}</b> · {t("Départ")}{" "}
          <b className={ENCOURS.mid2B}>{fmtGamePrice(trade.symbol, trade.openPrice, lang)}</b>
        </p>
      </div>
      <div className={ENCOURS.right}>
        <p className={`${ENCOURS.cur} ${toneText}`}>
          {price == null ? "…" : `${arrow}${fmtGamePrice(trade.symbol, price, lang)}`}
        </p>
        <p className={`${ENCOURS.est} ${toneText}`}>{est}</p>
      </div>
    </div>
  );
}

/* ---------- Résultat ---------- */

export function ResultCard({ trade, onReplay }: { trade: ApiTrade; onReplay: () => void }) {
  const { money } = useMoney();
  const { t, lang } = useLang();
  const isUp = trade.direction === "UP";
  const won = trade.result === "WIN";
  const lost = trade.result === "LOSS";
  const move = trade.closePrice == null ? null : trade.closePrice - trade.openPrice;

  const title = won ? t("Prédiction gagnée") : lost ? t("Prédiction ratée") : t("Égalité : mise rendue");
  // Gagné : ce qu'on a touché (mise + bénéfice, 100 → 185).
  const amount =
    won ? `+${money(trade.payout ?? 0, trade.payoutExact)}` : lost ? `−${money(trade.amount, trade.amountExact)}` : fmtSigned(0);
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
              {isUp ? t("Hausse ▲") : t("Baisse ▼")} · {symbolDisplay(trade.symbol)} ·{" "}
              {durationLabel(trade.durationSec)}
            </small>
          </p>
          <p className={`${RESULT.amt} ${won ? RESULT.amtWin : lost ? RESULT.amtLoss : RESULT.amtTie}`}>
            {amount}
          </p>
        </div>
        <p className={RESULT.move}>
          <span>
            {t("Départ")} <b className={RESULT.moveB}>{fmtGamePrice(trade.symbol, trade.openPrice, lang)}</b>
          </span>
          <span aria-hidden="true">→</span>
          <span>
            {t("Arrivée")}{" "}
            <b className={RESULT.moveB}>
              {trade.closePrice != null ? fmtGamePrice(trade.symbol, trade.closePrice, lang) : "…"}
            </b>
          </span>
          <span className={RESULT.moveFar}>
            {move == null ? "…" : `${moveArrow}${fmtGamePrice(trade.symbol, Math.abs(move), lang)}`}
          </span>
        </p>
      </div>
      <button type="button" onClick={onReplay} className={RESULT.again}>
        {t("Rejouer")} · {money(trade.amount, trade.amountExact)} {isUp ? "▲" : "▼"}
      </button>
    </>
  );
}
