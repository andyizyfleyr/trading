"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { otcPriceAt } from "@/lib/otc";
import { DURATIONS, SYMBOLS, durationLabel, type DurationSec } from "@/lib/symbols";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SignalIcon } from "@/components/Icons";

const GAMES = SYMBOLS.filter((s) => s.kind === "otc");
const SLOT_COUNT = 20;

type Verdict = "UP" | "DOWN" | "TIE";

function verdict(symbol: string, fromSec: number, durationSec: number): Verdict {
  const from = otcPriceAt(symbol, fromSec);
  const to = otcPriceAt(symbol, fromSec + durationSec);
  return to > from ? "UP" : to < from ? "DOWN" : "TIE";
}

function verdictLabel(v: Verdict): string {
  return v === "UP" ? "ACHAT ▲" : v === "DOWN" ? "VENTE ▼" : "PASSE";
}

/** Heure locale avec la seconde exacte : « 14:32:00 ». */
function fmtSlot(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * Compte à rebours « MM:SS ». Arrondi vers le haut : « 00:00 » ne s'affiche
 * qu'au moment exact où le créneau arrive, jamais une seconde en avance.
 */
function fmtCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Page PUBLIQUE (sans compte) : dit quoi miser et à quelle seconde exacte.
 * Une seule consigne géante (le prochain coup jouable), 3 étapes simples,
 * puis les choix (jeu, durée) et tous les coups à venir.
 */
export default function PredictionsPage() {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string>(GAMES[0]?.id ?? "");
  const [duration, setDuration] = useState<DurationSec>(60);
  const [now, setNow] = useState(() => Date.now());

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

  // Horloge fluide pour le compte à rebours (10 fois par seconde pour que
  // la seconde affichée bascule pile au bon moment). Les signaux, eux,
  // restent stables : ils n'avancent que de minute en minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const serverNowMs = now + (offsetMs ?? 0);
  const minuteKey = Math.floor(serverNowMs / 60000);

  const slots = useMemo(() => {
    if (offsetMs == null || !game) return [];
    const first = (minuteKey + 1) * 60;
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const start = first + i * 60;
      return { start, v: verdict(game.id, start, duration) };
    });
  }, [offsetMs, minuteKey, gameId, duration, game]);

  // Le coup mis en avant : le premier où on peut gagner (on saute les « PASSE »).
  const target = slots.find((s) => s.v !== "TIE") ?? slots[0];
  const remainingMs = target ? Math.max(0, target.start * 1000 - serverNowMs) : 0;
  const elapsedPct = Math.min(100, Math.max(0, ((60000 - remainingMs) / 60000) * 100));

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

  if (offsetMs == null || !game || !target) {
    return (
      <div className="flex flex-col gap-2" aria-label="Chargement des signaux...">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const playable = target.v !== "TIE";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-extrabold">Signaux casino</h1>
        <p className="mt-0.5 text-sm text-doux">
          On te dit à l&apos;avance s&apos;il faut appuyer sur ACHAT ou VENTE, et à
          quelle seconde exacte.
        </p>
      </div>

      {/* LA consigne : quoi miser, et dans combien de temps */}
      <div className="rounded-2xl border-2 border-action bg-carte p-3">
        <div className="flex items-center gap-2">
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

        {playable ? (
          <>
            <p className="mt-2 text-center text-sm font-bold text-doux">
              À{" "}
              <span className="text-base font-extrabold tabular-nums text-texte">
                {fmtSlot(target.start)}
              </span>{" "}
              précises, appuie sur :
            </p>
            <p
              className={`mx-auto mt-1 w-fit rounded-2xl px-6 py-2 text-center text-3xl font-extrabold ${
                target.v === "UP" ? "bg-hausse text-[#06240f]" : "bg-vente text-white"
              }`}
            >
              {verdictLabel(target.v)}
            </p>
            <p className="mt-2 text-center text-sm font-bold text-doux">Mise dans</p>
            <p
              className="text-center text-5xl font-extrabold tabular-nums"
              aria-label={`Temps restant avant de miser : ${fmtCountdown(remainingMs)}`}
            >
              {remainingMs < 1000 ? "GO !" : fmtCountdown(remainingMs)}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fond" aria-hidden="true">
              <div className="h-full rounded-full bg-action" style={{ width: `${elapsedPct}%` }} />
            </div>
            <Link
              href={`/?jeu=${game.id}&duree=${duration}&sens=${target.v === "UP" ? "up" : "down"}&slot=${target.start}`}
              className="mt-3 block"
            >
              <Btn className="min-h-[56px] w-full text-lg font-extrabold">
                Préparer ma mise →
              </Btn>
            </Link>
            <p className="mt-1.5 text-center text-xs text-doux">
              Le jeu, la durée et le bouton sont déjà remplis sur l&apos;écran suivant.
            </p>
          </>
        ) : (
          <p className="mt-2 py-4 text-center text-base font-bold text-doux">
            Pas de coup jouable pour l&apos;instant : reviens dans une minute.
          </p>
        )}
      </div>

      {/* Comment ne pas louper le coup */}
      <div className="rounded-2xl border border-ligne bg-carte p-3">
        <p className="text-base font-extrabold">Comment ne pas louper le coup</p>
        <ol className="mt-1.5 flex flex-col gap-1.5">
          {[
            "Appuie sur « Préparer ma mise » : tout est déjà rempli.",
            "Choisis ta mise, puis attends que le décompte arrive à 00:00.",
            "À 00:00 pile, appuie vite sur le bouton entouré de blanc.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action text-sm font-extrabold text-white"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="pt-0.5 font-medium">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-doux">
          En retard même d&apos;1 seconde ? Le coup est raté : attends le suivant.
        </p>
      </div>

      {/* Choix du jeu et de la durée */}
      <div>
        <p className="mb-1 text-sm font-extrabold">Quel jeu ?</p>
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
      </div>

      <div>
        <p className="mb-1 text-sm font-extrabold">Quelle durée ?</p>
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
      </div>

      {/* Tous les coups à venir */}
      <div className="overflow-hidden rounded-2xl border border-ligne bg-carte">
        <p className="border-b border-ligne px-3 py-2.5 text-base font-extrabold">
          Les coups à venir
        </p>
        <ul>
          {slots.map((s) => {
            const isTarget = playable && s.start === target.start;
            return (
              <li
                key={s.start}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
                  isTarget ? "bg-action/10" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-base font-extrabold tabular-nums">
                    {fmtSlot(s.start)}
                  </span>
                  {isTarget && (
                    <span className="shrink-0 rounded-md bg-action px-1.5 py-0.5 text-xs font-extrabold text-white">
                      À JOUER
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-sm font-extrabold ${
                    s.v === "UP"
                      ? "bg-hausse/15 text-hausse"
                      : s.v === "DOWN"
                        ? "bg-baisse/15 text-baisse"
                        : "bg-fond text-doux"
                  }`}
                >
                  {verdictLabel(s.v)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-ligne px-3 py-2 text-sm text-doux">
          « PASSE » = le prix ne bougera pas : garde ta mise pour le coup d&apos;après.
        </p>
      </div>
    </div>
  );
}
