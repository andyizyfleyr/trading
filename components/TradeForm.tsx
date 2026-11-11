"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiOpenTrade, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { vibrate } from "@/lib/vibrate";
import { DURATIONS } from "@/lib/symbols";
import { durationLabel } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";
import { Btn, Card, HelpTip } from "./ui";

/** Signal venant de la page Signaux : quoi appuyer, et à quel moment exact. */
export interface SignalHint {
  direction: "UP" | "DOWN";
  atMs: number;
}

interface Props {
  balance: number;
  symbol: string;
  online: boolean;
  onOpened: (trade: ApiTrade, balance: number) => void;
  /** Durée pré-choisie (signal). */
  initialDuration?: number;
  /** Bouton conseillé + heure exacte pour miser (signal). */
  signal?: SignalHint | null;
}

function formatSignalRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Formulaire ultra-compact : 2 lignes + boutons, tout sur une vue. */
export function TradeForm({ balance, symbol, online, onOpened, initialDuration, signal }: Props) {
  const [durationSec, setDurationSec] = useState<number>(initialDuration ?? 60);
  const [amountStr, setAmountStr] = useState("50");
  const [placing, setPlacing] = useState<"UP" | "DOWN" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signalNow, setSignalNow] = useState(() => Date.now());

  // Durée imposée par le signal (arrive après le premier affichage).
  useEffect(() => {
    if (initialDuration != null) setDurationSec(initialDuration);
  }, [initialDuration]);

  // Décompte du signal : quand appuyer sur le bouton conseillé.
  useEffect(() => {
    if (!signal) return;
    setSignalNow(Date.now());
    const t = setInterval(() => setSignalNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [signal]);

  const signalRemainMs = signal ? signal.atMs - signalNow : 0;
  const signalLive = signal != null && signalRemainMs > 0;
  const signalLabel = signal?.direction === "DOWN" ? "VENTE ▼" : "ACHAT ▲";

  // Pas de plafond : on peut miser jusqu'à tout le solde.
  const maxBet = Math.max(0, balance);
  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);
  const gain = amount != null && amount > 0 ? Math.round(amount * 0.85 * 100) / 100 : 0;

  const place = async (direction: "UP" | "DOWN") => {
    setError(null);
    if (!online) {
      setError("Hors ligne : reconnectez-vous pour jouer.");
      return;
    }
    if (amount == null || amount <= 0) {
      setError("Entrez un montant de mise.");
      return;
    }
    if (amount < 10) {
      setError("La mise minimum est de 10.");
      return;
    }
    if (amount > maxBet) {
      setError("Solde insuffisant pour cette mise.");
      return;
    }
    setPlacing(direction);
    try {
      const { trade, balance: newBalance } = await apiOpenTrade({
        symbol,
        direction,
        amount,
        durationSec,
      });
      vibrate(20);
      onOpened(trade, newBalance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Prédiction impossible pour le moment.");
    } finally {
      setPlacing(null);
    }
  };

  return (
    <Card className="flex flex-col gap-1.5 p-2">
      {/* Durée */}
      <div id="guide-duration">
        <div className="mb-0.5 flex items-center gap-1 text-xs font-medium text-doux">
          Durée
          <HelpTip
            label="Durée"
            text="Le temps que dure ta prédiction. À la fin du compte à rebours, on compare le prix de fin au prix de départ."
          />
        </div>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Choisir la durée">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDurationSec(d)}
              aria-pressed={durationSec === d}
              className={`h-10 rounded-xl text-sm font-bold transition-colors duration-200 ${
                durationSec === d
                  ? "bg-primary text-white"
                  : "border border-ligne bg-fond text-doux active:text-texte"
              }`}
            >
              {durationLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Mise : montant + raccourcis sur une ligne */}
      <div id="guide-amount">
        <div className="mb-0.5 flex items-center justify-between gap-1 text-xs font-medium text-doux">
          <span className="flex items-center gap-1">
            Mise
            <HelpTip
              label="Mise"
              text="La somme jouée, de 10 jusqu'à tout ton solde. Bonne prédiction = mise + 85 % de gain. Égalité = mise rendue."
            />
          </span>
          <span className="tabular-nums">
            Gain <span className="font-bold text-hausse">+{fmtMoney(gain)}</span>
          </span>
        </div>
        <div className="flex gap-1.5">
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-label="Montant de la mise"
            className="h-10 w-[76px] shrink-0 rounded-xl border border-ligne bg-fond px-2 text-center text-base font-extrabold tabular-nums outline-none focus:border-action"
          />
          <div className="grid flex-1 grid-cols-4 gap-1.5" role="group" aria-label="Mises rapides">
            {[10, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmountStr(String(v))}
                className="h-10 rounded-xl border border-ligne bg-fond text-sm font-bold tabular-nums active:bg-ligne"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmountStr(String(maxBet))}
              className="h-10 rounded-xl border border-ligne bg-fond text-sm font-bold active:bg-ligne"
              aria-label={`Miser le maximum : ${fmtMoney(maxBet)}`}
            >
              Max
            </button>
          </div>
        </div>
      </div>

      {/* Signal : dans combien de temps appuyer, et sur quel bouton */}
      {signalLive && (
        <div role="status" className="anim-in rounded-xl bg-action/15 px-3 py-2 text-center">
          <p className="text-sm font-bold">
            Dans{" "}
            <span className="text-lg font-extrabold tabular-nums">
              {formatSignalRemain(signalRemainMs)}
            </span>
            , appuie sur{" "}
            <span className="font-extrabold">{signalLabel}</span>
          </p>
        </div>
      )}
      {signal && !signalLive && (
        <div role="alert" className="anim-in rounded-xl bg-baisse/10 px-3 py-2 text-center">
          <p className="text-sm font-bold text-baisse">
            Trop tard : ce coup est passé.{" "}
            <Link href="/predictions" className="underline">
              Voir le prochain signal
            </Link>
          </p>
        </div>
      )}

      {/* Prédiction */}
      <div id="guide-buttons" className="grid grid-cols-2 gap-1.5">
        <Btn
          variant="green"
          onClick={() => place("UP")}
          disabled={placing !== null}
          aria-label="ACHAT : je prédis que le prix va monter"
          className={`min-h-[56px] text-lg font-extrabold ${
            signalLive && signal?.direction === "UP" ? "animate-pulse ring-4 ring-white" : ""
          }`}
        >
          {placing === "UP" ? "…" : "ACHAT ▲"}
        </Btn>
        <Btn
          variant="red"
          onClick={() => place("DOWN")}
          disabled={placing !== null}
          aria-label="VENTE : je prédis que le prix va descendre"
          className={`min-h-[56px] text-lg font-extrabold ${
            signalLive && signal?.direction === "DOWN" ? "animate-pulse ring-4 ring-white" : ""
          }`}
        >
          {placing === "DOWN" ? "…" : "VENTE ▼"}
        </Btn>
      </div>

      {error && (
        <p role="alert" className="anim-in rounded-xl bg-baisse/10 px-3 py-1.5 text-center text-sm font-medium text-baisse">
          {error}
        </p>
      )}
    </Card>
  );
}
