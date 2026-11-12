"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiOpenTrade, apiScheduleTrade, ApiError } from "@/lib/api";
import { useServerOffset } from "@/hooks/useServerOffset";
import {
  BAD_TIME,
  DEFAULT_BET,
  DEFAULT_DURATION_SEC,
  PENDING_TICK_MS,
  SHOT_DELAY_MS,
  SIGNAL_PRESS_WINDOW_MS,
  SIGNAL_TICK_MS,
  STORE,
  TIME_SLOT_BOOK_MARGIN_MS,
  TIME_SLOT_COUNT,
  VIBRATE,
} from "@/lib/config";
import { ORDER, SHEET, TRADER } from "@/lib/design";
import { fmtDurMS, fmtHM, fmtMoney, fmtRemain, fmtSlot } from "@/lib/format";
import { vibrate } from "@/lib/vibrate";
import { DURATIONS, RULES, SYMBOLS, isDuration, isOtc, symbolDisplay } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";
import { BottomSheet, Btn } from "./ui";
import { TimePickerPanel } from "./TimePicker";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, MinusIcon, PlusIcon } from "./Icons";

/** Signal venant de la page Signaux : quoi appuyer, et à quel moment exact. */
export interface SignalHint {
  direction: "UP" | "DOWN";
  atMs: number;
}

/** Ordre « Rejouer » : rejoue aussitôt la même mise (panneau résultat). */
export interface ReplayOrder {
  direction: "UP" | "DOWN";
  amount: number;
  durationSec: number;
  /** Change à chaque demande (rejoue même le même trade deux fois). */
  nonce: number;
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
  /** Solde après programmation/annulation d'une mise. */
  onBalance?: (balance: number) => void;
  /** Rejoue un trade terminé dès que l'ordre change. */
  replay?: ReplayOrder | null;
  /** Créneau pré-choisi par la page Signaux (« Préparer ma mise »). */
  progSlot?: number | null;
  /** Une mise vient d'être programmée (rafraîchit la liste « En cours »). */
  onScheduledChange?: () => void;
  /** Ouvre le choix du jeu (ligne actif du panneau). */
  onPickAsset: () => void;
}

/** Mises programmées : partent toutes seules, annulables (panneau « En cours »). */
export function ScheduledTrades({
  trades,
  onCancel,
}: {
  trades: ApiTrade[];
  onCancel: (id: number) => void;
}) {
  if (trades.length === 0) return null;
  return (
    <div className={TRADER.soonBox}>
      <p className={TRADER.soonTitle}>
        Programmé{trades.length > 1 ? "es" : ""} ({trades.length}/{RULES.MAX_SCHEDULED})
      </p>
      <ul className={TRADER.soonList}>
        {trades.map((t) => (
          <li key={t.id} className={TRADER.soonRow}>
            <span className={TRADER.soonMain}>
              {t.direction === "UP" ? "HAUSSE ▲" : "BAISSE ▼"} {fmtMoney(t.amount)}{" "}
              <span className={TRADER.soonSub}>
                {symbolDisplay(t.symbol)} à {fmtHM(slotOf(t))}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onCancel(t.id)}
              aria-label={`Annuler la mise programmée à ${fmtSlot(slotOf(t))} (remboursée)`}
              className={TRADER.soonX}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mise programmée sur l'appareil (marchés réels : la page doit rester ouverte). */
interface Pending {
  direction: "UP" | "DOWN";
  amount: number;
  durationSec: number;
  symbol: string;
  slot: number;
}

/** Seconde pile d'ouverture d'une mise programmée. */
function slotOf(t: ApiTrade): number {
  return Math.floor(new Date(t.openedAt).getTime() / 1000);
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** « HH:MM » → prochaine occurrence (aujourd'hui, ou demain si l'heure est passée). */
function slotFromTime(v: string, fromMs: number): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const day = new Date(fromMs);
  day.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let slot = Math.floor(day.getTime() / 1000);
  if (slot * 1000 <= fromMs) slot += 24 * 3600; // heure passée → demain
  return slot;
}

/** Durée + Investissement sauvegardés (survivent au refresh, à la déconnexion, à la fermeture). */
function loadOrderPrefs(): { durationSec: number; amountStr: string } {
  const fallback = { durationSec: DEFAULT_DURATION_SEC, amountStr: String(DEFAULT_BET) };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE.order);
    if (!raw) return fallback;
    const prefs = JSON.parse(raw) as { durationSec?: unknown; amountStr?: unknown };
    const durationSec = isDuration(prefs.durationSec) ? prefs.durationSec : DEFAULT_DURATION_SEC;
    const saved = typeof prefs.amountStr === "string" ? prefs.amountStr.trim() : "";
    const amountStr =
      saved !== "" && Number.isFinite(Number(saved.replace(",", ".")))
        ? prefs.amountStr as string
        : String(DEFAULT_BET);
    return { durationSec, amountStr };
  } catch {
    return fallback;
  }
}

/** Panneau d'ordres façon Quotex : jeu + programmation, Durée, Investissement, gains, HAUSSE/BAISSE. */
export function TradeForm({ balance, symbol, online, onOpened, initialDuration, signal, onBalance, replay, progSlot, onScheduledChange, onPickAsset }: Props) {
  const [prefs] = useState(loadOrderPrefs);
  const [durationSec, setDurationSec] = useState<number>(initialDuration ?? prefs.durationSec);
  const [amountStr, setAmountStr] = useState(prefs.amountStr);
  const [placing, setPlacing] = useState<"UP" | "DOWN" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signalNow, setSignalNow] = useState(() => Date.now());
  const [quand, setQuand] = useState<string>("now"); // "now" | secondes | BAD_TIME
  const [customTime, setCustomTime] = useState("");
  const [durSheetOpen, setDurSheetOpen] = useState(false);
  const [durTab, setDurTab] = useState<"min" | "time">("min");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  // Écart téléphone ↔ serveur, partagé avec le reste de l'app : même heure partout.
  const offsetMs = useServerOffset();
  const [tick, setTick] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const firedRef = useRef(false);

  // Durée imposée par le signal (arrive après le premier affichage).
  useEffect(() => {
    if (initialDuration != null) setDurationSec(initialDuration);
  }, [initialDuration]);

  // Chaque choix (Durée, Investissement) est sauvegardé aussitôt :
  // on le retrouve après un refresh, une déconnexion ou la fermeture.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE.order, JSON.stringify({ durationSec, amountStr }));
    } catch {
      /* stockage indisponible : choix perdu à la fermeture */
    }
  }, [durationSec, amountStr]);

  // Décompte du signal : quand appuyer sur le bouton conseillé.
  useEffect(() => {
    if (!signal) return;
    setSignalNow(Date.now());
    const t = setInterval(() => setSignalNow(Date.now()), SIGNAL_TICK_MS);
    return () => clearInterval(t);
  }, [signal]);

  // Horloge pendant l'attente d'une mise programmée.
  useEffect(() => {
    if (!pending) return;
    setTick(Date.now());
    const t = setInterval(() => setTick(Date.now()), PENDING_TICK_MS);
    return () => clearInterval(t);
  }, [pending]);

  // Onglet caché = mise ratée : on prévient.
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Écran allumé pendant l'attente sur l'appareil (sinon les minuteurs ralentissent).
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let sentinel: { release?: () => Promise<void> } | null = null;
    const lock = async () => {
      try {
        const wl = (
          navigator as unknown as {
            wakeLock?: { request: (kind: string) => Promise<unknown> };
          }
        ).wakeLock;
        if (!wl) return;
        const s = (await wl.request("screen")) as { release?: () => Promise<void> };
        if (cancelled) await s.release?.();
        else sentinel = s;
      } catch {
        /* verrou refusé : l'utilisateur garde l'écran allumé */
      }
    };
    lock();
    const onVis = () => {
      if (document.visibilityState === "visible") lock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release?.().catch(() => {});
    };
  }, [pending]);

  // Le signal vise une seconde SERVEUR : le décompte utilise l'heure serveur
  // (horloge locale + écart mesuré), sinon il sonne trop tôt ou trop tard.
  const signalRemainMs = signal ? signal.atMs - (signalNow + (offsetMs ?? 0)) : 0;
  const signalLive = signal != null && signalRemainMs > 0;
  const signalLabel = signal?.direction === "DOWN" ? "BAISSE ▼" : "HAUSSE ▲";
  // Dans les 3 dernières secondes, le bouton conseillé arme le tir :
  // la mise part toute seule à la seconde pile (entrée exacte, verdict juste).
  const signalArmed = signalLive && signalRemainMs <= SIGNAL_PRESS_WINDOW_MS;

  const serverNowMs = Date.now() + (offsetMs ?? 0);
  // Premier créneau à plus de 8 s : sans marge, la première case tombe
  // parfois dans 2-3 s et la programmation échoue (« Heure passée »).
  const firstSlot = Math.ceil((serverNowMs + TIME_SLOT_BOOK_MARGIN_MS) / 60000) * 60;
  // Grille DÉPART : les prochaines minutes (avec « Maintenant » et « Autre », 12 cases).
  const timeSlots = Array.from({ length: Math.max(0, TIME_SLOT_COUNT - 2) }, (_, i) => firstSlot + i * 60);

  // Heure tapée : passée, trop proche (< 8 s) ou bonne.
  const typedSlot = customTime === "" ? null : slotFromTime(customTime, serverNowMs);
  const typedPassed = typedSlot != null && typedSlot * 1000 <= serverNowMs;
  const typedTooSoon =
    typedSlot != null &&
    typedSlot * 1000 > serverNowMs &&
    typedSlot * 1000 <= serverNowMs + TIME_SLOT_BOOK_MARGIN_MS;

  // Choix effectif (nul = immédiat ou invalide).
  let chosenSlot: number | null = null;
  let quandStale = false;
  if (quand !== "now" && quand !== BAD_TIME) {
    const slot = Number(quand);
    if (Number.isFinite(slot) && slot * 1000 > serverNowMs) chosenSlot = slot;
    else quandStale = true;
  }

  // Programmation effective : une heure choisie = mise programmée.
  // Pendant un signal guidé, on mise toujours aussitôt.
  const scheduling = !signalLive;
  const effectiveSlot = scheduling ? chosenSlot : null;
  const slotInvalid = scheduling && (quand === BAD_TIME || quandStale);

  const pickNow = () => {
    setQuand("now");
    setCustomTime("");
  };
  const pickSlot = (s: number) => {
    setQuand(String(s));
    setCustomTime("");
  };
  const pickTimeSlot = (s: number) => {
    pickSlot(s);
    setDurSheetOpen(false);
  };
  const openTimeSheet = () => {
    setDraftTime(customTime);
    setSheetOpen(true);
  };
  const openDurSheet = () => {
    setDurTab(effectiveSlot != null ? "time" : "min");
    setDurSheetOpen(true);
  };
  const onCustomTime = (v: string) => {
    setCustomTime(v);
    if (v === "") {
      setQuand("now");
      return;
    }
    const slot = slotFromTime(v, Date.now() + (offsetMs ?? 0));
    const ok =
      slot != null && slot * 1000 > Date.now() + (offsetMs ?? 0) + TIME_SLOT_BOOK_MARGIN_MS;
    setQuand(ok ? String(slot) : BAD_TIME);
  };

  // Créneau pré-choisi par la page Signaux : on le présélectionne tel quel
  // (l'utilisateur choisit sa mise puis appuie une fois sur HAUSSE/BAISSE).
  useEffect(() => {
    if (progSlot == null || !Number.isInteger(progSlot)) return;
    if (progSlot * 1000 > Date.now() + (offsetMs ?? 0) + TIME_SLOT_BOOK_MARGIN_MS) {
      setQuand(String(progSlot));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progSlot]);

  // Jeu changé pendant l'attente sur l'appareil : la programmation ne veut plus rien dire.
  // (Les programmations serveur, elles, survivent : le serveur s'en occupe.)
  useEffect(() => {
    if (pending && pending.symbol !== symbol) {
      setPending(null);
      firedRef.current = false;
      setError("Jeu changé : programmation annulée.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Pas de plafond : on peut miser jusqu'à tout le solde.
  const maxBet = Math.max(0, balance);
  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);
  // Ce qu'on touche si ça gagne (mise + 85 %), et le vrai bénéfice (85 % seul).
  const payout =
    amount != null && amount > 0 ? Math.round(amount * (1 + RULES.WIN_PAYOUT_RATIO) * 100) / 100 : 0;
  const netWin = Math.round((payout - (amount ?? 0)) * 100) / 100;

  // Pas des boutons − / + : la mise minimum.
  const stepBet = (dir: 1 | -1) => {
    const cur = amount != null && amount > 0 ? Math.round(amount) : DEFAULT_BET;
    const next =
      dir > 0
        ? Math.min(Math.floor(maxBet), cur + RULES.MIN_BET)
        : Math.max(RULES.MIN_BET, cur - RULES.MIN_BET);
    setAmountStr(String(Math.max(0, next)));
  };

  // Jeu affiché dans le panneau (pastille + nom + gain).
  const asset = SYMBOLS.find((s) => s.id === symbol) ?? SYMBOLS[0];
  const payoutPct = Math.round(RULES.WIN_PAYOUT_RATIO * 100);

  const place = async (
    direction: "UP" | "DOWN",
    ov?: { amount?: number; durationSec?: number; symbol?: string }
  ) => {
    const amt = ov?.amount ?? amount;
    setError(null);
    if (!online) {
      setError("Hors ligne : reconnectez-vous pour jouer.");
      return;
    }
    if (amt == null || amt <= 0) {
      setError("Entrez un montant de mise.");
      return;
    }
    if (amt < RULES.MIN_BET) {
      setError(`La mise minimum est de ${RULES.MIN_BET}.`);
      return;
    }
    if (amt > maxBet) {
      setError("Solde insuffisant pour cette mise.");
      return;
    }
    setPlacing(direction);
    try {
      const { trade, balance: newBalance } = await apiOpenTrade({
        symbol: ov?.symbol ?? symbol,
        direction,
        amount: amt,
        durationSec: ov?.durationSec ?? durationSec,
      });
      vibrate(VIBRATE.action);
      pickNow(); // On repart sur « Maintenant » : pas de programmation surprise au prochain appui.
      onOpened(trade, newBalance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Prédiction impossible pour le moment.");
    } finally {
      setPlacing(null);
    }
  };

  /**
   * HAUSSE/BAISSE pendant un signal : le bouton conseillé, appuyé dans les
   * 3 dernières secondes, arme la mise qui part toute seule à la seconde
   * pile (même entrée que le signal : le verdict dit vrai). Appuyé trop
   * tôt, on le dit au lieu de miser à un mauvais moment.
   */
  const press = async (direction: "UP" | "DOWN") => {
    if (signalLive && signal && direction === signal.direction) {
      if (!signalArmed) {
        setError("Trop tôt : attends la fin du compte à rebours, le coup part à la seconde pile.");
        return;
      }
      setError(null);
      if (!online) {
        setError("Hors ligne : reconnectez-vous pour jouer.");
        return;
      }
      if (amount == null || amount <= 0) {
        setError("Entrez un montant de mise.");
        return;
      }
      if (amount < RULES.MIN_BET) {
        setError(`La mise minimum est de ${RULES.MIN_BET}.`);
        return;
      }
      if (amount > maxBet) {
        setError("Solde insuffisant pour cette mise.");
        return;
      }
      firedRef.current = false;
      setPending({ direction, amount, durationSec, symbol, slot: Math.floor(signal.atMs / 1000) });
      return;
    }
    await schedule(direction);
  };

  /**
   * HAUSSE/BAISSE : immédiat sauf heure programmée (contact activé).
   * Jeux casino → programmation serveur (part même appli fermée).
   * Marchés réels → programmation sur l'appareil (page à garder ouverte).
   */
  const schedule = async (direction: "UP" | "DOWN") => {
    if (!scheduling || quand === "now") {
      await place(direction);
      return;
    }
    if (quand === BAD_TIME) {
      setError(
        typedPassed
          ? "Heure passée : choisis une heure à venir."
          : typedTooSoon
            ? "Heure trop proche : choisis une heure plus tardive."
            : "Choisis une heure à venir dans la liste."
      );
      return;
    }
    const slot = Number(quand);
    const bookAfter = Date.now() + (offsetMs ?? 0) + TIME_SLOT_BOOK_MARGIN_MS;
    if (!Number.isFinite(slot) || slot * 1000 <= Date.now() + (offsetMs ?? 0)) {
      setError("Heure passée : choisis une autre heure.");
      return;
    }
    if (slot * 1000 <= bookAfter) {
      setError("Heure trop proche : choisis une heure plus tardive.");
      return;
    }
    setError(null);
    if (!online) {
      setError("Hors ligne : reconnectez-vous pour jouer.");
      return;
    }
    if (amount == null || amount <= 0) {
      setError("Entrez un montant de mise.");
      return;
    }
    if (amount < RULES.MIN_BET) {
      setError(`La mise minimum est de ${RULES.MIN_BET}.`);
      return;
    }
    if (amount > maxBet) {
      setError("Solde insuffisant pour cette mise.");
      return;
    }
    if (isOtc(symbol)) {
      setPlacing(direction);
      try {
        const res = await apiScheduleTrade({
          symbol,
          direction,
          amount,
          durationSec,
          slot,
        });
        vibrate(VIBRATE.action);
        onBalance?.(res.balance);
        pickNow(); // La mise rejoint la liste « En cours ».
        onScheduledChange?.();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Programmation impossible pour le moment.");
      } finally {
        setPlacing(null);
      }
      return;
    }
    firedRef.current = false;
    setPending({ direction, amount, durationSec, symbol, slot });
  };

  // Envoi précis sur l'appareil : dès que l'heure pile (+150 ms) arrive, la mise part.
  useEffect(() => {
    if (!pending || firedRef.current) return;
    if (tick + (offsetMs ?? 0) < pending.slot * 1000 + SHOT_DELAY_MS) return;
    firedRef.current = true;
    void (async () => {
      await place(pending.direction, {
        amount: pending.amount,
        durationSec: pending.durationSec,
        symbol: pending.symbol,
      });
      setPending(null);
      firedRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pending, offsetMs]);

  // « Rejouer » : reprend durée + mise + sens, puis mise aussitôt (maquette).
  const replayNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!replay || replay.nonce === replayNonceRef.current) return;
    replayNonceRef.current = replay.nonce;
    setDurationSec(replay.durationSec);
    setAmountStr(String(replay.amount));
    pickNow();
    void place(replay.direction, { amount: replay.amount, durationSec: replay.durationSec });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const pendingRemainMs = pending
    ? Math.max(0, pending.slot * 1000 + SHOT_DELAY_MS - (tick + (offsetMs ?? 0)))
    : 0;

  return (
    <div className={TRADER.panel}>
      {pending ? (
        /* Mise programmée sur l'appareil : attente de l'heure choisie */
        <div role="status" className={TRADER.waitBox}>
          <p className={TRADER.waitTitle}>
            {pending.direction === "UP" ? "HAUSSE ▲" : "BAISSE ▼"} {fmtMoney(pending.amount)} à{" "}
            {fmtSlot(pending.slot)}
          </p>
          <p className={TRADER.waitClock}>
            {fmtRemain(pendingRemainMs)}
          </p>
          {hidden && (
            <p role="alert" className={TRADER.waitWarn}>
              Reviens vite sur cette page, sinon la mise ne partira pas !
            </p>
          )}
          <Btn variant="ghost" onClick={() => setPending(null)} className={TRADER.waitBtn}>
            Annuler
          </Btn>
          <p className={TRADER.waitNote}>
            Reste sur cette page jusqu&apos;au départ.
          </p>
        </div>
      ) : (
        <>
          {/* Jeu + contact de programmation */}
          <div className={ORDER.assetRow}>
            <button
              id="guide-symbol"
              type="button"
              onClick={onPickAsset}
              aria-haspopup="dialog"
              aria-label={`Jeu : ${symbolDisplay(symbol)}. Changer de jeu.`}
              className={ORDER.assetBtn}
            >
              <span
                className={ORDER.assetDot}
                style={{ backgroundColor: asset.color }}
                aria-hidden="true"
              />
              <span className={ORDER.assetName}>{symbolDisplay(symbol)}</span>
              <span className={ORDER.payout}>{payoutPct}%</span>
              <ChevronDownIcon className={ORDER.assetChev} />
            </button>
          </div>

          {/* Durée + Investissement */}
          <div className={ORDER.boxes}>
            <div id="guide-duration" className={ORDER.box}>
              <span className={ORDER.boxLabel}>{effectiveSlot != null ? "Départ" : "Durée"}</span>
              <button
                type="button"
                onClick={openDurSheet}
                aria-haspopup="dialog"
                aria-label={
                  effectiveSlot != null
                    ? `Départ à ${fmtHM(effectiveSlot)}, durée ${fmtDurMS(durationSec)}. Changer.`
                    : `Durée ${fmtDurMS(durationSec)}. Changer.`
                }
                className={ORDER.minBtn}
              >
                <span className={ORDER.minVal}>
                  {effectiveSlot != null ? fmtHM(effectiveSlot) : fmtDurMS(durationSec)}
                </span>
                {effectiveSlot != null && (
                  <span className={ORDER.minSub}>durée {fmtDurMS(durationSec)}</span>
                )}
              </button>
            </div>
            <div id="guide-amount" className={ORDER.box}>
              <span className={ORDER.boxLabel}>Investissement</span>
              <div className={ORDER.invRow}>
                <button
                  type="button"
                  onClick={() => stepBet(-1)}
                  aria-label="Diminuer la mise"
                  className={ORDER.step}
                >
                  <MinusIcon className={ORDER.stepIcon} />
                </button>
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Montant de la mise"
                  className={ORDER.invInput}
                />
                <button
                  type="button"
                  onClick={() => stepBet(1)}
                  aria-label="Augmenter la mise"
                  className={ORDER.step}
                >
                  <PlusIcon className={ORDER.stepIcon} />
                </button>
              </div>
            </div>
          </div>

          {/* Ce qu'on touche si ça gagne (mise + bénéfice), bénéfice seul en dessous */}
          <div className={ORDER.debRow}>
            <span className={ORDER.debLabel}>Tu touches si tu gagnes</span>
            <span className={ORDER.debDots} aria-hidden="true" />
            <span className={ORDER.debVal}>{fmtMoney(payout)}</span>
          </div>
          <p className={ORDER.netNote}>
            Mise {fmtMoney(amount ?? 0)} rendue + {fmtMoney(netWin)} de bénéfice
          </p>
          <p className={ORDER.netNote}>
            {RULES.MAX_TRADES_PER_MINUTE} coups par minute maximum
          </p>

          {/* Signal : dans combien de temps appuyer, et sur quel bouton */}
          {signalLive && (
            <div role="status" className={TRADER.signalBox}>
              <p className={TRADER.signalText}>
                {signalArmed ? (
                  <>
                    C&apos;est le moment : appuie sur{" "}
                    <span className={TRADER.signalClock}>{signalLabel}</span>
                  </>
                ) : (
                  <>
                    Dans{" "}
                    <span className={TRADER.signalClock}>
                      {fmtRemain(signalRemainMs)}
                    </span>
                    , appuie sur{" "}
                    <span className={TRADER.signalClock}>{signalLabel}</span>
                  </>
                )}
              </p>
            </div>
          )}
          {signal && !signalLive && (
            <div role="alert" className={TRADER.lateBox}>
              <p className={TRADER.lateText}>
                Trop tard : ce coup est passé. Choisis une autre heure dans « Départ ».
              </p>
            </div>
          )}
          {slotInvalid && (
            <p className={TRADER.hintErr}>
              {quand === BAD_TIME
                ? typedPassed
                  ? "Heure passée : choisis une heure à venir."
                  : typedTooSoon
                    ? "Heure trop proche : choisis une heure plus tardive."
                    : "Choisis une heure à venir dans la liste."
                : "Heure passée : choisis une autre heure."}
            </p>
          )}

          {/* Prédiction */}
          <div id="guide-buttons" className={ORDER.goRow}>
            <button
              type="button"
              onClick={() => press("UP")}
              disabled={placing !== null}
              aria-label="HAUSSE : je prédis que le prix va monter"
              className={`${ORDER.go} ${ORDER.buy} ${
                signalLive && signal?.direction === "UP" ? TRADER.advised : ""
              }`}
            >
              {placing === "UP" ? (
                "…"
              ) : (
                <>
                  <span>HAUSSE</span>
                  <span className={ORDER.arrowDot} aria-hidden="true">
                    <ArrowUpIcon className={ORDER.arrowIcon} />
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => press("DOWN")}
              disabled={placing !== null}
              aria-label="BAISSE : je prédis que le prix va descendre"
              className={`${ORDER.go} ${ORDER.sell} ${
                signalLive && signal?.direction === "DOWN" ? TRADER.advised : ""
              }`}
            >
              {placing === "DOWN" ? (
                "…"
              ) : (
                <>
                  <span>BAISSE</span>
                  <span className={ORDER.arrowDot} aria-hidden="true">
                    <ArrowDownIcon className={ORDER.arrowIcon} />
                  </span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className={TRADER.error}>
          {error}
        </p>
      )}

      {/* Panneau : Durée (combien de temps) ou Départ (à quelle heure) */}
      <BottomSheet open={durSheetOpen} onClose={() => setDurSheetOpen(false)} title="Durée ou départ" hideTitle>
        <div className={SHEET.list2}>
          <div className={ORDER.tabs} role="tablist" aria-label="Durée ou départ">
            <button
              type="button"
              role="tab"
              aria-selected={durTab === "min"}
              onClick={() => setDurTab("min")}
              className={durTab === "min" ? ORDER.tabOn : ORDER.tabOff}
            >
              DURÉE
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={durTab === "time"}
              onClick={() => setDurTab("time")}
              className={durTab === "time" ? ORDER.tabOn : ORDER.tabOff}
            >
              DÉPART
            </button>
          </div>
          {durTab === "min" ? (
            <div className={ORDER.grid} role="group" aria-label="Choisir la durée">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDurationSec(d);
                    setDurSheetOpen(false);
                  }}
                  aria-pressed={durationSec === d}
                  className={durationSec === d ? ORDER.cellOn : ORDER.cellOff}
                >
                  {fmtDurMS(d)}
                </button>
              ))}
            </div>
          ) : (
            <div className={ORDER.grid} role="group" aria-label="Choisir l'heure de la mise">
              <button
                type="button"
                onClick={() => {
                  pickNow();
                  setDurSheetOpen(false);
                }}
                aria-pressed={quand === "now"}
                className={quand === "now" ? ORDER.cellOn : ORDER.cellOff}
              >
                Maintenant
              </button>
              {timeSlots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickTimeSlot(s)}
                  aria-pressed={quand === String(s)}
                  className={quand === String(s) ? ORDER.cellOn : ORDER.cellOff}
                >
                  {fmtHM(s)}
                </button>
              ))}
              <button
                type="button"
                onClick={openTimeSheet}
                aria-haspopup="dialog"
                aria-pressed={customTime !== ""}
                className={customTime !== "" ? ORDER.cellOn : ORDER.cellOff}
              >
                Autre
              </button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Panneau : choisir son heure (liste des prochaines heures) */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Choisir l'heure" hideTitle>
        <div className={SHEET.list2}>
          <TimePickerPanel
            value={draftTime}
            nowMs={serverNowMs}
            onChange={setDraftTime}
            onConfirm={() => {
              onCustomTime(draftTime);
              setSheetOpen(false);
              setDurSheetOpen(false);
            }}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
