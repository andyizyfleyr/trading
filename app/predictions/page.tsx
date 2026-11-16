"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { otcPriceAt } from "@/lib/otc";
import { DURATIONS, SYMBOLS, durationLabel, type DurationSec } from "@/lib/symbols";
import { useOnline } from "@/hooks/useOnline";
import { useServerOffset } from "@/hooks/useServerOffset";
import {
  COUNTDOWN_TICK_MS,
  DEFAULT_DURATION_SEC,
  GO_THRESHOLD_MS,
  ROUTES,
  SIGNAL_PARAMS,
  SIGNAL_SLOT_COUNT,
  TIME_SLOT_BOOK_MARGIN_MS,
} from "@/lib/config";
import { ICON, SIGNAL, STACK, TEXT, TONE, TRADER } from "@/lib/design";
import { fmtRemain, fmtSlot } from "@/lib/format";
import { useLang } from "@/lib/lang-context";
import { Btn, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SignalIcon } from "@/components/Icons";

const GAMES = SYMBOLS.filter((s) => s.kind === "otc");

type Verdict = "UP" | "DOWN" | "TIE";

function verdict(symbol: string, fromSec: number, durationSec: number): Verdict {
  const from = otcPriceAt(symbol, fromSec);
  const to = otcPriceAt(symbol, fromSec + durationSec);
  return to > from ? "UP" : to < from ? "DOWN" : "TIE";
}

function verdictLabel(v: Verdict, t: (key: string) => string): string {
  return v === "UP" ? t("Hausse ▲") : v === "DOWN" ? t("Baisse ▼") : t("Égalité =");
}

/**
 * Page PUBLIQUE (sans compte) : dit quoi miser et à quelle seconde exacte.
 * Une seule consigne géante (le prochain coup jouable), 3 étapes simples,
 * puis les choix (jeu, durée) et tous les coups à venir.
 */
export default function PredictionsPage() {
  const { t } = useLang();
  // Même heure serveur que le trader (le coup « À JOUER » part à la seconde pile là-bas).
  const offsetMs = useServerOffset();
  const online = useOnline();
  const [gameId, setGameId] = useState<string>(GAMES[0]?.id ?? "");
  const [duration, setDuration] = useState<DurationSec>(DEFAULT_DURATION_SEC);
  const [now, setNow] = useState(() => Date.now());

  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0];

  // Horloge fluide pour le compte à rebours (10 fois par seconde pour que
  // la seconde affichée bascule pile au bon moment). Les signaux, eux,
  // restent stables : ils n'avancent que de minute en minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const serverNowMs = now + (offsetMs ?? 0);
  const minuteKey = Math.floor(serverNowMs / 60000);

  const slots = useMemo(() => {
    if (offsetMs == null || !game) return [];
    // Premier créneau à plus de 8 s : sans cela, il tombe parfois dans moins
    // d'1 s et la consigne affiche « GO ! » pour un coup déjà raté.
    let first = (minuteKey + 1) * 60;
    if (first * 1000 - serverNowMs < TIME_SLOT_BOOK_MARGIN_MS) first += 60;
    return Array.from({ length: SIGNAL_SLOT_COUNT }, (_, i) => {
      const start = first + i * 60;
      return { start, v: verdict(game.id, start, duration) };
    });
  }, [offsetMs, minuteKey, serverNowMs, gameId, duration, game]);

  // Le coup mis en avant : le premier où on peut gagner (on saute les « ÉGALITÉ »).
  const target = slots.find((s) => s.v !== "TIE") ?? slots[0];
  const remainingMs = target ? Math.max(0, target.start * 1000 - serverNowMs) : 0;
  // Jauge sur la vraie fenêtre (la minute qui précède le coup), pas sur 60 s
  // fixes : sinon elle reste à 0 % quand le coup est dans 3 minutes.
  const spanStartMs = target ? (target.start - 60) * 1000 : 0;
  const spanMs = target ? target.start * 1000 - spanStartMs : 1;
  const elapsedPct = Math.min(100, Math.max(0, ((serverNowMs - spanStartMs) / spanMs) * 100));

  if (GAMES.length === 0) {
    return (
      <EmptyState
        icon={<SignalIcon className={ICON.xl} />}
        title={t("Pas de jeu casino")}
        text={t("Aucun jeu n'est disponible pour le moment.")}
      />
    );
  }

  if (!online && offsetMs == null) {
    return (
      <ErrorState
        text={t("Hors ligne : reconnecte-toi pour voir les signaux.")}
        retry={() => window.location.reload()}
      />
    );
  }

  if (offsetMs == null || !game || !target) {
    return (
      <div className={STACK.c2} aria-label={t("Chargement des signaux...")}>
        <Skeleton className={SIGNAL.skelTitle} />
        <Skeleton className={SIGNAL.skelBar} />
        <Skeleton className={SIGNAL.skelBig} />
      </div>
    );
  }

  const playable = target.v !== "TIE";

  return (
    <div className={SIGNAL.root}>
      <div className={STACK.c1}>
        <h1 className={TEXT.pageTitle}>{t("Signaux casino")}</h1>
        <p className={TEXT.bodyMuted}>
          {t("On te dit à l'avance s'il faut appuyer sur Hausse ou Baisse, et à quelle seconde exacte.")}
        </p>
      </div>

      {/* LA consigne : quoi miser, et dans combien de temps */}
      <div className={SIGNAL.consigne}>
        <div className={SIGNAL.head}>
          <span
            className={SIGNAL.dot}
            style={{ backgroundColor: game.color }}
            aria-hidden="true"
          />
          <p className={SIGNAL.title}>
            {game.base} <span className={SIGNAL.titleSub}>· {durationLabel(duration)}</span>
          </p>
          <span className={TRADER.tag}>
            {t("JEU")}
          </span>
        </div>

        {playable ? (
          <>
            <p className={SIGNAL.verdictLine}>
              {t("À")}{" "}
              <span className={SIGNAL.verdictTime}>
                {fmtSlot(target.start)}
              </span>{" "}
              {t("précises, appuie sur :")}
            </p>
            <p
              className={`${SIGNAL.pill} ${
                target.v === "UP" ? SIGNAL.pillUp : SIGNAL.pillDown
              }`}
            >
              {verdictLabel(target.v, t)}
            </p>
            <p className={SIGNAL.miseDans}>{t("Mise dans")}</p>
            <p
              className={SIGNAL.countdown}
              aria-label={t("Temps restant avant de miser : {x}", { x: fmtRemain(remainingMs) })}
            >
              {remainingMs < GO_THRESHOLD_MS ? "GO !" : fmtRemain(remainingMs)}
            </p>
            <div className={SIGNAL.track} aria-hidden="true">
              <div className={SIGNAL.fill} style={{ width: `${elapsedPct}%` }} />
            </div>
            <Link
              href={`${ROUTES.trader}?${SIGNAL_PARAMS.game}=${game.id}&${SIGNAL_PARAMS.duration}=${duration}&${SIGNAL_PARAMS.sense}=${target.v === "UP" ? SIGNAL_PARAMS.up : SIGNAL_PARAMS.down}&${SIGNAL_PARAMS.slot}=${target.start}&${SIGNAL_PARAMS.prog}=${target.start}`}
              className={SIGNAL.prepareWrap}
            >
              <Btn className={SIGNAL.prepare}>
                {t("Préparer ma mise →")}
              </Btn>
            </Link>
            <p className={SIGNAL.prepareNote}>
              {t("Le jeu, la durée et le bouton sont déjà remplis sur l'écran suivant.")}
            </p>
          </>
        ) : (
          <p className={SIGNAL.idle}>
            {t("Pas de coup jouable pour l'instant : reviens dans une minute.")}
          </p>
        )}
      </div>

      {/* Comment ne pas louper le coup */}
      <div className={SIGNAL.howto}>
        <p className={TEXT.sectionTitle}>{t("Comment ne pas louper le coup")}</p>
        <ol className={SIGNAL.steps}>
          {[
            t("Appuie sur « Préparer ma mise » : tout est déjà rempli."),
            t("Choisis ta mise, puis attends la fin du décompte."),
            t("Dans les 3 dernières secondes, appuie sur le bouton conseillé : ta mise partira toute seule à la seconde pile."),
          ].map((step, i) => (
            <li key={i} className={SIGNAL.step}>
              <span
                className={SIGNAL.stepNum}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className={SIGNAL.stepText}>{step}</span>
            </li>
          ))}
        </ol>
        <p className={SIGNAL.note}>
          {t("Trop tôt ? Attends : le bouton conseillé ne s'arme que dans les 3 dernières secondes. En retard ? Le coup est raté : attends le suivant. Astuce : sur le trader, choisis ton heure dans « Départ » et ta mise partira toute seule, même si tu quittes l'app.")}
        </p>
      </div>

      {/* Choix du jeu et de la durée */}
      <div>
        <p className={SIGNAL.pickTitle}>{t("Quel jeu ?")}</p>
        <div className={SIGNAL.gameGrid} role="group" aria-label={t("Choisir le jeu")}>
          {GAMES.map((g) => {
            const selected = g.id === game.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGameId(g.id)}
                aria-pressed={selected}
                className={selected ? SIGNAL.gameOn : SIGNAL.gameOff}
              >
                <span
                  className={SIGNAL.gameDot}
                  style={{ backgroundColor: g.color }}
                  aria-hidden="true"
                />
                {g.base}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={SIGNAL.pickTitle}>{t("Quelle durée ?")}</p>
        <div className={SIGNAL.durGrid} role="group" aria-label={t("Choisir la durée")}>
          {DURATIONS.map((d) => {
            const selected = d === duration;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                aria-pressed={selected}
                className={selected ? SIGNAL.durOn : SIGNAL.durOff}
              >
                {durationLabel(d)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tous les coups à venir */}
      <div className={SIGNAL.list}>
        <p className={SIGNAL.listHead}>
          {t("Les coups à venir")}
        </p>
        <ul>
          {slots.map((s) => {
            const isTarget = playable && s.start === target.start;
            return (
              <li
                key={s.start}
                className={`${SIGNAL.listRow} ${
                  isTarget ? SIGNAL.listHot : ""
                }`}
              >
                <span className={SIGNAL.slotMain}>
                  <span className={SIGNAL.listTime}>
                    {fmtSlot(s.start)}
                  </span>
                  {isTarget && (
                    <span className={SIGNAL.listPlay}>
                      {t("À JOUER")}
                    </span>
                  )}
                </span>
                <span
                  className={
                    s.v === "UP"
                      ? TONE.badgeUp
                      : s.v === "DOWN"
                        ? TONE.badgeDown
                        : TONE.badgePass
                  }
                >
                  {verdictLabel(s.v, t)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={SIGNAL.listFoot}>
          {t("« Égalité » = le prix ne bougera pas : garde ta mise pour le coup d'après.")}
        </p>
      </div>
    </div>
  );
}
