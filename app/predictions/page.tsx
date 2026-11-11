"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { otcPriceAt } from "@/lib/otc";
import { DURATIONS, SYMBOLS, durationLabel, type DurationSec } from "@/lib/symbols";
import { fmtPrice } from "@/lib/format";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SignalIcon } from "@/components/Icons";

const GAMES = SYMBOLS.filter((s) => s.kind === "otc");
const SLOT_COUNT = 20;

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

/** Heure locale avec la seconde exacte : « 14:32:00 ». */
function fmtSlot(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * Page PUBLIQUE (sans compte) : signaux casino stables, un par heure de
 * prédiction. Chaque ligne dit quoi prédire si tu ouvres pile à l'heure
 * affichée. La liste n'est pas recalculée chaque seconde : elle avance
 * seulement de minute en minute.
 */
export default function PredictionsPage() {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string>(GAMES[0]?.id ?? "");
  const [duration, setDuration] = useState<DurationSec>(60);
  const [tick, setTick] = useState(0);

  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];

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

  // La liste avance de minute en minute, jamais chaque seconde.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const slots = useMemo(() => {
    if (offsetMs == null || !game) return [];
    const serverNowSec = Math.floor((Date.now() + offsetMs) / 1000);
    const first = Math.ceil(serverNowSec / 60) * 60;
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const start = first + i * 60;
      return { start, ...verdict(game.id, start, duration) };
    });
  }, [offsetMs, tick, gameId, duration, game]);

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

  if (offsetMs == null || !game) {
    return (
      <div className="flex flex-col gap-2" aria-label="Chargement des signaux...">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold">Signaux casino</h1>
        <Link href="/">
          <Btn className="min-h-[44px] text-sm">Aller trader</Btn>
        </Link>
      </div>
      <p className="text-sm text-doux">
        Choisis ton jeu et ta durée. Chaque ligne te dit quoi prédire si tu ouvres
        pile à l&apos;heure affichée.
      </p>

      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Choisir le jeu">
        {GAMES.map((g) => {
          const selected = g.id === game.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGameId(g.id)}
              aria-pressed={selected}
              className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-extrabold ${
                selected
                  ? "border-action bg-action/15 text-texte"
                  : "border-ligne bg-carte text-doux"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: g.color }}
                aria-hidden="true"
              />
              <span className="truncate">{g.base}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Choisir la durée">
        {DURATIONS.map((d) => {
          const selected = d === duration;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              aria-pressed={selected}
              className={`min-h-[44px] rounded-xl border text-sm font-extrabold tabular-nums ${
                selected
                  ? "border-action bg-action/15 text-texte"
                  : "border-ligne bg-carte text-doux"
              }`}
            >
              {durationLabel(d)}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-doux">
        Ouvre ta prédiction pile à la seconde affichée (ex : 14:32:00). Même 1 seconde
        de retard peut changer le résultat.
      </p>

      <div className="overflow-hidden rounded-2xl border border-ligne bg-carte">
        <div className="flex items-center gap-2 border-b border-ligne px-3 py-2.5">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: game.color }}
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 truncate text-base font-extrabold">
            {game.base} <span className="font-bold text-doux">· {durationLabel(duration)}</span>
          </p>
          <span className="shrink-0 rounded-lg bg-action/15 px-2 py-1 text-xs font-extrabold text-action">
            JEU
          </span>
        </div>
        <ul>
          {slots.map((s, i) => (
            <li
              key={s.start}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
                i > 0 ? "border-t border-ligne" : ""
              } ${i === 0 ? "bg-action/10" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-base font-extrabold tabular-nums">
                  {fmtSlot(s.start)}
                </span>
                {i === 0 && (
                  <span className="shrink-0 rounded-md bg-action px-1.5 py-0.5 text-xs font-extrabold text-white">
                    PROCHAIN
                  </span>
                )}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-center text-xs tabular-nums text-doux min-[400px]:block">
                {fmtPrice(s.from)} → {fmtPrice(s.to)}
              </span>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-sm font-extrabold ${
                  s.v === "UP"
                    ? "bg-hausse/15 text-hausse"
                    : s.v === "DOWN"
                      ? "bg-baisse/15 text-baisse"
                      : "bg-action/15 text-action"
                }`}
              >
                {s.v === "UP" ? "ACHAT ▲" : s.v === "DOWN" ? "VENTE ▼" : "ÉGALITÉ"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
