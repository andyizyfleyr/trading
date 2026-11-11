"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { otcPriceAt } from "@/lib/otc";
import { DURATIONS, SYMBOLS, durationLabel } from "@/lib/symbols";
import { fmtPrice } from "@/lib/format";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SignalIcon } from "@/components/Icons";

const GAMES = SYMBOLS.filter((s) => s.kind === "otc");

type Verdict = "UP" | "DOWN" | "TIE";

function verdict(
  symbol: string,
  fromSec: number,
  durationSec: number
): { v: Verdict; from: number; to: number } {
  const from = otcPriceAt(symbol, fromSec);
  const to = otcPriceAt(symbol, fromSec + durationSec);
  return { v: to > from ? "UP" : to < from ? "DOWN" : "TIE", from, to };
}

/**
 * Page PUBLIQUE (sans compte) : direction prévue des jeux casino,
 * calculée à l'avance pour chaque durée. Possible car les prix casino
 * suivent une formule fixe. Synchronisée sur l'heure du serveur.
 */
export default function PredictionsPage() {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  // Écart d'horloge avec le serveur (mesuré à la latence près).
  const syncClock = useCallback(async () => {
    if (GAMES.length === 0) return;
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/price?symbol=${GAMES[0].id}`, { cache: "no-store" });
      const json = (await res.json()) as { data?: { time?: unknown } };
      const serverTime = Number(json?.data?.time);
      if (!Number.isFinite(serverTime)) throw new Error("heure invalide");
      const t1 = Date.now();
      setOffsetMs(serverTime - (t0 + t1) / 2);
      setError(null);
    } catch {
      setError("Synchronisation impossible. Vérifiez votre connexion.");
    }
  }, []);

  useEffect(() => {
    syncClock();
    const timer = setInterval(syncClock, 30000);
    return () => clearInterval(timer);
  }, [syncClock]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  if (GAMES.length === 0) {
    return (
      <EmptyState
        icon={<SignalIcon className="h-8 w-8" />}
        title="Pas de jeu casino"
        text="Aucun jeu n'est disponible pour le moment."
      />
    );
  }

  if (error && offsetMs == null) {
    return <ErrorState text={error} retry={syncClock} />;
  }

  if (offsetMs == null) {
    return (
      <div className="flex flex-col gap-2" aria-label="Chargement des signaux...">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const serverSec = Math.floor((now + (offsetMs ?? 0)) / 1000);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold">Signaux casino</h1>
        <Link href="/">
          <Btn className="min-h-[44px] text-sm">Aller trader</Btn>
        </Link>
      </div>
      <p className="text-sm text-doux">
        Direction prévue pour chaque jeu et chaque durée, calculée à l&apos;avance.
        Indicatif : à la seconde près, ça peut changer.
      </p>

      <div className="grid gap-2 lg:grid-cols-3 lg:items-start">
        {GAMES.map((game) => (
          <div key={game.id} className="rounded-2xl border border-ligne bg-carte p-3">
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: game.color }}
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 truncate text-base font-extrabold">
                {game.base}
              </p>
              <span className="shrink-0 rounded-lg bg-action/15 px-2 py-1 text-xs font-extrabold text-action">
                JEU
              </span>
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-doux">
              {fmtPrice(otcPriceAt(game.id, serverSec))}
            </p>

            <div className="mt-2 flex flex-col gap-1.5">
              {DURATIONS.map((d) => {
                const { v, from, to } = verdict(game.id, serverSec, d);
                return (
                  <div
                    key={d}
                    className="flex items-center justify-between gap-2 rounded-xl bg-fond px-2.5 py-2"
                  >
                    <span className="text-sm font-bold tabular-nums">
                      {durationLabel(d)}
                    </span>
                    <span className="truncate text-xs tabular-nums text-doux">
                      {fmtPrice(from)} → {fmtPrice(to)}
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-sm font-extrabold ${
                        v === "UP"
                          ? "bg-hausse/15 text-hausse"
                          : v === "DOWN"
                            ? "bg-baisse/15 text-baisse"
                            : "bg-action/15 text-action"
                      }`}
                    >
                      {v === "UP" ? "ACHAT ▲" : v === "DOWN" ? "VENTE ▼" : "ÉGALITÉ"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
