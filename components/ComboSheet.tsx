"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { apiPlaceCombo, ApiError, type ComboLegInput } from "@/lib/api";
import { DEFAULT_BET, DEFAULT_DURATION_SEC, VIBRATE } from "@/lib/config";
import { ENCOURS, ORDER, SHEET } from "@/lib/design";
import { fmtRemainShort, fmtTime } from "@/lib/format";
import { useMoney } from "@/hooks/useMoney";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { CURRENCIES, convertToUsd, convertUsd, roundCurrency } from "@/lib/money";
import { compareExact } from "@/lib/exact-ledger";
import {
  addExact,
  decimalFraction,
  exactFromUsd,
  exactToUsd,
  fraction,
  multiplyExact,
  truncateExact,
} from "@/lib/exact-money";
import { DURATIONS, RULES, SYMBOLS, durationLabel, symbolDisplay, type DurationSec } from "@/lib/symbols";
import type { ApiCombo, ApiExactMoney } from "@/lib/types";
import { vibrate } from "@/lib/vibrate";
import { MinusIcon, PlusIcon } from "./Icons";
import { BottomSheet, Btn } from "./ui";

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

export function comboMultiplier(legsCount: number): number {
  if (legsCount < RULES.COMBO_MIN_LEGS) return 1;
  return Math.pow(1 + RULES.WIN_PAYOUT_RATIO, legsCount);
}

export function exactComboPayout(amountExact: ApiExactMoney | undefined, legsCount: number): ApiExactMoney | undefined {
  if (!amountExact || legsCount < RULES.COMBO_MIN_LEGS) return undefined;
  let value = fraction(BigInt(amountExact.numerator), BigInt(amountExact.denominator));
  const mult = addExact(decimalFraction("1"), decimalFraction(String(RULES.WIN_PAYOUT_RATIO)));
  for (let i = 0; i < legsCount; i += 1) {
    value = multiplyExact(value, mult);
  }
  const cap = decimalFraction(String(RULES.COMBO_MAX_PAYOUT));
  const capped = compareExact(value, cap) > 0 ? cap : value;
  return { numerator: capped.numerator.toString(), denominator: capped.denominator.toString() };
}

export function ComboCard({
  combo,
  now,
}: {
  combo: ApiCombo;
  now: number;
}) {
  const { t, lang } = useLang();
  const { money } = useMoney();
  const open = combo.status === "OPEN";
  const won = combo.result === "WIN";
  const lost = combo.result === "LOSS";
  const mult = comboMultiplier(combo.legs.length);
  const multLabel = mult.toFixed(2).replace(".", lang === "en" ? "." : ",");

  const right = open
    ? t("En cours")
    : won
      ? `+${money(combo.payout ?? 0, combo.payoutExact)}`
      : lost
        ? `−${money(combo.amount, combo.amountExact)}`
        : "±0";

  const borderTone = open ? ENCOURS.toneFlat : won ? ENCOURS.toneWin : lost ? ENCOURS.toneLoss : ENCOURS.toneFlat;
  const rightTone = open ? "text-action" : won ? ENCOURS.textWin : lost ? ENCOURS.textLoss : ENCOURS.textFlat;

  return (
    <div className={`rounded-[10px] border border-ligne border-l-[3px] ${borderTone} bg-fond px-2.5 py-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold">
            {t("Combiné · {n} jambes", { n: combo.legs.length })}{" "}
            <span className="font-bold text-payout">×{multLabel}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-doux tabular-nums">
            {t("Mise")} <b className="font-semibold text-texte">{money(combo.amount, combo.amountExact)}</b> ·{" "}
            {fmtTime(combo.createdAt, lang)}
          </p>
        </div>
        <span className={`shrink-0 text-[13px] font-extrabold tabular-nums ${rightTone}`}>{right}</span>
      </div>

      <div className="mt-2 flex flex-col gap-1 border-t border-ligne pt-1.5">
        {combo.legs.map((leg) => {
          const sym = SYMBOLS.find((s) => s.id === leg.symbol);
          const isUp = leg.direction === "UP";
          const legOpen = leg.status === "OPEN";
          const remain = Math.max(0, new Date(leg.closesAt).getTime() - now);
          const badge = legOpen
            ? t("Fin {x}", { x: fmtRemainShort(remain) })
            : leg.result === "WIN"
              ? t("Gagnée")
              : leg.result === "LOSS"
                ? t("Perdue")
                : leg.result === "VOID"
                  ? t("Annulée")
                  : t("Nul");
          const badgeTone = legOpen
            ? "text-action"
            : leg.result === "WIN"
              ? "text-hausse"
              : leg.result === "LOSS"
                ? "text-baisse"
                : "text-doux";
          return (
            <div key={leg.id} className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: sym?.color ?? "#8E93A7" }}
                  aria-hidden="true"
                />
                <span className="truncate font-bold">{symbolDisplay(leg.symbol)}</span>
                <span className="text-doux">· {durationLabel(leg.durationSec)}</span>
                <span className={isUp ? "font-extrabold text-hausse" : "font-extrabold text-baisse"}>
                  {isUp ? "▲" : "▼"}
                </span>
              </div>
              <span className={`shrink-0 font-bold tabular-nums ${badgeTone}`}>{badge}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ComboSheetProps {
  open: boolean;
  onClose: () => void;
  defaultSymbol: string;
  balance: number;
  online: boolean;
  legs: ComboLegInput[];
  onLegsChange: (legs: ComboLegInput[]) => void;
  onPlaced: (combo: ApiCombo, balance: number, balanceExact?: ApiExactMoney) => void;
}

export function ComboSheet({
  open,
  onClose,
  defaultSymbol,
  balance,
  online,
  legs,
  onLegsChange,
  onPlaced,
}: ComboSheetProps) {
  const { t, lang } = useLang();
  const { currency, money } = useMoney();
  const { user } = useAuth();

  const [pickSym, setPickSym] = useState<string>(defaultSymbol || SYMBOLS[0].id);
  const [pickDur, setPickDur] = useState<DurationSec>(DEFAULT_DURATION_SEC);
  const [amountStr, setAmountStr] = useState<string>(() => String(convertUsd(DEFAULT_BET, currency)));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);
  const amountUsd = amount == null ? null : convertToUsd(amount, currency);
  const amountExact = useMemo(() => {
    try {
      const value = exactToUsd(decimalFraction(amountStr.replace(",", ".").trim()), currency);
      return { numerator: value.numerator.toString(), denominator: value.denominator.toString() };
    } catch {
      return undefined;
    }
  }, [amountStr, currency]);

  const maxBet = Math.max(0, balance);
  const mult = comboMultiplier(legs.length);
  const multStr = mult.toFixed(2).replace(".", lang === "en" ? "." : ",");
  const payoutExact = exactComboPayout(amountExact, legs.length);

  const addLeg = (direction: "UP" | "DOWN") => {
    setError(null);
    if (legs.length >= RULES.COMBO_MAX_LEGS) {
      setError(t("Maximum {max} prédictions par combiné.", { max: RULES.COMBO_MAX_LEGS }));
      return;
    }
    const dup = legs.some(
      (l) => l.symbol === pickSym && l.durationSec === pickDur && l.direction === direction
    );
    if (dup) {
      setError(t("Deux jambes identiques : ça ne compte pas double."));
      return;
    }
    const opp = legs.some(
      (l) => l.symbol === pickSym && l.durationSec === pickDur && l.direction !== direction
    );
    if (opp) {
      setError(t("Hausse et Baisse sur le même jeu : combiné perdu d'avance."));
      return;
    }
    onLegsChange([...legs, { symbol: pickSym, direction, durationSec: pickDur }]);
    vibrate(VIBRATE.tap);
  };

  const removeLeg = (idx: number) => {
    setError(null);
    onLegsChange(legs.filter((_, i) => i !== idx));
  };

  const stepBet = (dir: 1 | -1) => {
    const step = new Decimal(RULES.MIN_BET)
      .mul(CURRENCIES[currency].perUsd)
      .toDecimalPlaces(CURRENCIES[currency].decimals, Decimal.ROUND_UP);
    const cap = user?.balanceExact
      ? truncateExact(
          exactFromUsd(
            fraction(BigInt(user.balanceExact.numerator), BigInt(user.balanceExact.denominator)),
            currency
          ),
          CURRENCIES[currency].decimals
        )
      : String(convertUsd(maxBet, currency));
    const cur = new Decimal(
      amount != null && amount > 0 ? amountStr.replace(",", ".") : convertUsd(DEFAULT_BET, currency)
    );
    const next = dir > 0 ? Decimal.min(cap, cur.plus(step)) : Decimal.max(step, cur.minus(step));
    setAmountStr(String(Math.max(0, roundCurrency(next.toNumber(), currency))));
  };

  const submit = async () => {
    setError(null);
    if (!online) {
      setError(t("Hors ligne : reconnectez-vous pour jouer."));
      return;
    }
    if (legs.length < RULES.COMBO_MIN_LEGS || legs.length > RULES.COMBO_MAX_LEGS) {
      setError(t("Un combiné, c'est 2 à 5 prédictions."));
      return;
    }
    if (amountUsd == null || amountUsd <= 0 || !amountExact) {
      setError(t("Entrez un montant de mise."));
      return;
    }
    const belowMin =
      compareExact(
        fraction(BigInt(amountExact.numerator), BigInt(amountExact.denominator)),
        decimalFraction(String(RULES.MIN_BET))
      ) < 0;
    if (belowMin) {
      setError(t("La mise minimum est de {min}.", { min: money(RULES.MIN_BET) }));
      return;
    }
    const overBal = user?.balanceExact
      ? compareExact(
          fraction(BigInt(amountExact.numerator), BigInt(amountExact.denominator)),
          fraction(BigInt(user.balanceExact.numerator), BigInt(user.balanceExact.denominator))
        ) > 0
      : amountUsd > maxBet;
    if (overBal) {
      setError(t("Solde insuffisant pour cette mise."));
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPlaceCombo(amountUsd, legs, amountExact);
      vibrate(VIBRATE.action);
      onLegsChange([]);
      onPlaced(res.combo, res.balance, res.balanceExact);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Combiné impossible pour le moment."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t("Combiné (2 à 5 prédictions)")}>
      <div className={SHEET.list2}>
        <p className="text-xs text-doux">
          {legs.length >= RULES.COMBO_MIN_LEGS
            ? t("Toutes les prédictions doivent gagner (cote ×{mult}).", { mult: multStr })
            : t("Ajoute 2 à 5 prédictions pour multiplier tes gains.")}
        </p>

        {/* 1. Constructeur de jambe */}
        <div className="flex flex-col gap-2 rounded-xl border border-ligne bg-fond p-2.5">
          <p className="text-xs font-extrabold">{t("Ajouter une prédiction")}</p>

          <div className="grid grid-cols-3 gap-1.5">
            {SYMBOLS.map((s) => {
              const on = s.id === pickSym;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPickSym(s.id)}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold ${
                    on ? "border-primary bg-primary text-white" : "border-ligne bg-carte text-texte"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{s.base}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {DURATIONS.map((d) => {
              const on = d === pickDur;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPickDur(d)}
                  className={`flex h-8 items-center justify-center rounded-lg border text-[11px] font-bold tabular-nums ${
                    on ? "border-primary bg-primary text-white" : "border-ligne bg-carte text-texte"
                  }`}
                >
                  {durationLabel(d)}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => addLeg("UP")}
              disabled={legs.length >= RULES.COMBO_MAX_LEGS}
              className="flex h-10 items-center justify-center rounded-lg bg-hausse text-xs font-extrabold text-white active:scale-[0.98] disabled:opacity-45"
            >
              {t("+ Hausse ▲")}
            </button>
            <button
              type="button"
              onClick={() => addLeg("DOWN")}
              disabled={legs.length >= RULES.COMBO_MAX_LEGS}
              className="flex h-10 items-center justify-center rounded-lg bg-vente text-xs font-extrabold text-white active:scale-[0.98] disabled:opacity-45"
            >
              {t("+ Baisse ▼")}
            </button>
          </div>
        </div>

        {/* 2. Liste des jambes choisies */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-extrabold">
            {t("Ta sélection ({n}/{max})", { n: legs.length, max: RULES.COMBO_MAX_LEGS })}
          </p>
          {legs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ligne px-3 py-2.5 text-center text-xs text-doux">
              {t("Ajoute au moins 2 prédictions ci-dessus.")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {legs.map((l, idx) => {
                const sym = SYMBOLS.find((s) => s.id === l.symbol);
                const isUp = l.direction === "UP";
                return (
                  <div
                    key={`${l.symbol}-${l.durationSec}-${l.direction}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ligne bg-fond px-2.5 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sym?.color ?? "#8E93A7" }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-bold">{symbolDisplay(l.symbol)}</span>
                      <span className="text-doux">· {durationLabel(l.durationSec)}</span>
                      <span className={isUp ? ENCOURS.dirUp : ENCOURS.dirDown}>
                        {isUp ? t("Hausse ▲") : t("Baisse ▼")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLeg(idx)}
                      aria-label={t("Fermer")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-puce text-xs font-bold text-texte"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Mise + Cote + Gain potentiel */}
        <div className={ORDER.box}>
          <span className={ORDER.boxLabel}>
            {t("Investissement")} ({CURRENCIES[currency].symbol})
          </span>
          <div className={ORDER.invRow}>
            <button
              type="button"
              onClick={() => stepBet(-1)}
              aria-label={t("Diminuer la mise")}
              className={ORDER.step}
            >
              <MinusIcon className={ORDER.stepIcon} />
            </button>
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-label={t("Montant de la mise")}
              className={ORDER.invInput}
            />
            <button
              type="button"
              onClick={() => stepBet(1)}
              aria-label={t("Augmenter la mise")}
              className={ORDER.step}
            >
              <PlusIcon className={ORDER.stepIcon} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className={ORDER.debRow}>
            <span className={ORDER.debLabel}>{t("Cote totale")}</span>
            <span className={ORDER.debDots} aria-hidden="true" />
            <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-payout">
              ×{multStr}
            </span>
          </div>
          <div className={ORDER.debRow}>
            <span className={ORDER.debLabel}>{t("Gain potentiel")}</span>
            <span className={ORDER.debDots} aria-hidden="true" />
            <span className={ORDER.debVal}>{payoutExact ? money(0, payoutExact) : "—"}</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-baisse/10 px-3 py-1.5 text-center text-xs font-medium text-baisse">
            {error}
          </p>
        )}

        <Btn
          onClick={submit}
          disabled={submitting || legs.length < RULES.COMBO_MIN_LEGS}
          className="w-full font-extrabold"
        >
          {submitting ? "…" : t("Valider le combiné ({n})", { n: legs.length })}
        </Btn>
      </div>
    </BottomSheet>
  );
}
