"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiCancelScheduled, apiMyTrades, apiOpenTrade, apiScheduleTrade, apiServerTime, ApiError } from "@/lib/api";
import {
  BAD_TIME,
  CLOCK_SYNC_MS,
  DEFAULT_BET,
  DEFAULT_DURATION_SEC,
  PENDING_TICK_MS,
  QUICK_AMOUNTS,
  SCHEDULED_REFRESH_MS,
  SHOT_DELAY_MS,
  SIGNAL_TICK_MS,
  TRADES_PAGE_LIMIT,
  VIBRATE,
} from "@/lib/config";
import { BTN, FLEX, SHEET, TRADER } from "@/lib/design";
import { fmtHM, fmtMoney, fmtRemain, fmtSlot } from "@/lib/format";
import { vibrate } from "@/lib/vibrate";
import { DURATIONS, RULES, durationLabel, isOtc, symbolDisplay } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";
import { BottomSheet, Btn, HelpTip } from "./ui";
import { TimePickerPanel } from "./TimePicker";

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
  /** Solde après programmation/annulation d'une mise. */
  onBalance?: (balance: number) => void;
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
function slotFromTime(v: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const day = new Date();
  day.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let slot = Math.floor(day.getTime() / 1000);
  if (slot * 1000 <= Date.now()) slot += 24 * 3600; // heure passée → demain
  return slot;
}

/** Formulaire ultra-compact : durée + mise + heure + boutons, tout sur une vue. */
export function TradeForm({ balance, symbol, online, onOpened, initialDuration, signal, onBalance }: Props) {
  const [durationSec, setDurationSec] = useState<number>(initialDuration ?? DEFAULT_DURATION_SEC);
  const [amountStr, setAmountStr] = useState(String(DEFAULT_BET));
  const [placing, setPlacing] = useState<"UP" | "DOWN" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signalNow, setSignalNow] = useState(() => Date.now());
  const [quand, setQuand] = useState<string>("now"); // "now" | secondes | BAD_TIME
  const [customTime, setCustomTime] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("");
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [serverPending, setServerPending] = useState<ApiTrade | null>(null);
  const [scheduledList, setScheduledList] = useState<ApiTrade[]>([]);
  const [tick, setTick] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const firedRef = useRef(false);

  // Mises programmées sur le serveur (partent même appli fermée).
  const refreshScheduled = useCallback(async () => {
    try {
      const { trades } = await apiMyTrades("scheduled", TRADES_PAGE_LIMIT);
      setScheduledList(trades);
    } catch {
      /* non connecté ou hors ligne : pas de bandeau */
    }
  }, []);

  useEffect(() => {
    refreshScheduled();
    const t = setInterval(refreshScheduled, SCHEDULED_REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshScheduled]);

  // Durée imposée par le signal (arrive après le premier affichage).
  useEffect(() => {
    if (initialDuration != null) setDurationSec(initialDuration);
  }, [initialDuration]);

  // Décompte du signal : quand appuyer sur le bouton conseillé.
  useEffect(() => {
    if (!signal) return;
    setSignalNow(Date.now());
    const t = setInterval(() => setSignalNow(Date.now()), SIGNAL_TICK_MS);
    return () => clearInterval(t);
  }, [signal]);

  // Écart d'horloge avec le serveur (pour tirer à la seconde pile).
  useEffect(() => {
    let stopped = false;
    const sync = async () => {
      const t0 = Date.now();
      try {
        const serverTime = await apiServerTime();
        if (!stopped && Number.isFinite(serverTime)) {
          setOffsetMs(serverTime - (t0 + Date.now()) / 2);
        }
      } catch {
        /* horloge locale en secours */
      }
    };
    sync();
    const t = setInterval(sync, CLOCK_SYNC_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

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

  const signalRemainMs = signal ? signal.atMs - signalNow : 0;
  const signalLive = signal != null && signalRemainMs > 0;
  const signalLabel = signal?.direction === "DOWN" ? "VENTE ▼" : "ACHAT ▲";

  const serverNowMs = Date.now() + (offsetMs ?? 0);
  const firstSlot = Math.ceil(serverNowMs / 60000) * 60;
  const quickSlots = [firstSlot, firstSlot + 60];

  // Heure tapée : à venir ou non.
  const typedSlot = customTime === "" ? null : slotFromTime(customTime);
  const typedPassed = typedSlot != null && typedSlot * 1000 <= serverNowMs;

  // Choix effectif (nul = immédiat ou invalide).
  let chosenSlot: number | null = null;
  let quandStale = false;
  if (quand !== "now" && quand !== BAD_TIME) {
    const slot = Number(quand);
    if (Number.isFinite(slot) && slot * 1000 > serverNowMs) chosenSlot = slot;
    else quandStale = true;
  }

  const pickNow = () => {
    setQuand("now");
    setCustomTime("");
  };
  const pickSlot = (s: number) => {
    setQuand(String(s));
    setCustomTime("");
  };
  const openTimeSheet = () => {
    setDraftTime(customTime);
    setSheetOpen(true);
  };
  const onCustomTime = (v: string) => {
    setCustomTime(v);
    if (v === "") {
      setQuand("now");
      return;
    }
    const slot = slotFromTime(v);
    setQuand(slot != null && slot * 1000 > Date.now() + (offsetMs ?? 0) ? String(slot) : BAD_TIME);
  };

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
  const gain = amount != null && amount > 0 ? Math.round(amount * RULES.WIN_PAYOUT_RATIO * 100) / 100 : 0;

  // Programmées à venir (les parties rejoignent « En cours » toutes seules).
  const upcoming = scheduledList.filter((t) => new Date(t.openedAt).getTime() > Date.now());

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
      onOpened(trade, newBalance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Prédiction impossible pour le moment.");
    } finally {
      setPlacing(null);
    }
  };

  /**
   * ACHAT/VENTE : immédiat avec « Maintenant », programmé sinon.
   * Jeux casino → programmation serveur (part même appli fermée).
   * Marchés réels → programmation sur l'appareil (page à garder ouverte).
   */
  const schedule = async (direction: "UP" | "DOWN") => {
    if (quand === "now") {
      await place(direction);
      return;
    }
    if (quand === BAD_TIME) {
      setError(
        typedPassed
          ? "Heure passée : choisis une heure à venir."
          : "Choisis une heure à venir dans la liste."
      );
      return;
    }
    const slot = Number(quand);
    if (!Number.isFinite(slot) || slot * 1000 <= Date.now() + (offsetMs ?? 0)) {
      setError("Heure passée : choisis une autre heure.");
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
        setServerPending(res.scheduled);
        void refreshScheduled();
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

  const cancelScheduled = async (id: number) => {
    setError(null);
    try {
      const res = await apiCancelScheduled(id);
      onBalance?.(res.balance);
      setServerPending((p) => (p?.id === id ? null : p));
      await refreshScheduled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Annulation impossible pour le moment.");
    }
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

  const pendingRemainMs = pending
    ? Math.max(0, pending.slot * 1000 + SHOT_DELAY_MS - (tick + (offsetMs ?? 0)))
    : 0;

  return (
    <div className={TRADER.panel}>
      {pending ? (
        /* Mise programmée sur l'appareil : attente de l'heure choisie */
        <div role="status" className={TRADER.waitBox}>
          <p className={TRADER.waitTitle}>
            {pending.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"} {fmtMoney(pending.amount)} à{" "}
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
      ) : serverPending ? (
        /* Mise programmée sur le serveur : part même appli fermée */
        <div role="status" className={TRADER.doneBox}>
          <p className={TRADER.doneTitle}>Programmé ✓</p>
          <p className={TRADER.doneText}>
            {serverPending.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"}{" "}
            {fmtMoney(serverPending.amount)} {symbolDisplay(serverPending.symbol)} à{" "}
            {fmtSlot(slotOf(serverPending))}
          </p>
          <p className={TRADER.doneNote}>
            Partira tout seul à l&apos;heure, même si tu quittes l&apos;app.
          </p>
          <div className={TRADER.doneBtns}>
            <Btn variant="ghost" onClick={() => setServerPending(null)} className={BTN.block}>
              OK
            </Btn>
            <Btn variant="red" onClick={() => cancelScheduled(serverPending.id)} className={BTN.block}>
              Annuler
            </Btn>
          </div>
          <p className={TRADER.waitNote}>Annuler = mise remboursée.</p>
        </div>
      ) : (
        <>
          {/* Mises programmées : partent toutes seules, annulables */}
          {upcoming.length > 0 && (
            <div className={TRADER.soonBox}>
              <p className={TRADER.soonTitle}>
                Programmé{upcoming.length > 1 ? "es" : ""} ({upcoming.length})
              </p>
              <ul className={TRADER.soonList}>
                {upcoming.map((t) => (
                  <li key={t.id} className={TRADER.soonRow}>
                    <span className={TRADER.soonMain}>
                      {t.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"} {fmtMoney(t.amount)}{" "}
                      <span className={TRADER.soonSub}>
                        {symbolDisplay(t.symbol)} à {fmtHM(slotOf(t))}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelScheduled(t.id)}
                      aria-label={`Annuler la mise programmée à ${fmtSlot(slotOf(t))} (remboursée)`}
                      className={TRADER.soonX}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Durée */}
          <div id="guide-duration" className={TRADER.row}>
            <span className={TRADER.label}>
              Durée
              <HelpTip
                label="Durée"
                text="Le temps que dure ta prédiction. À la fin du compte à rebours, on compare le prix de fin au prix de départ."
              />
            </span>
            <div className={TRADER.chipsBox} role="group" aria-label="Choisir la durée">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationSec(d)}
                  aria-pressed={durationSec === d}
                  className={`${durationSec === d ? TRADER.chipOn : TRADER.chipOff} ${FLEX.fill}`}
                >
                  {durationLabel(d)}
                </button>
              ))}
            </div>
          </div>

          {/* Mise : montant + raccourcis sur une ligne */}
          <div id="guide-amount" className={TRADER.row}>
            <span className={TRADER.label}>
              Mise
              <HelpTip
                label="Mise"
                text={`La somme jouée, de ${RULES.MIN_BET} jusqu'à tout ton solde. Bonne prédiction = mise + ${Math.round(RULES.WIN_PAYOUT_RATIO * 100)} % de gain. Égalité = mise rendue.`}
              />
            </span>
            <div className={TRADER.chipsBox}>
              <input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-label="Montant de la mise"
                className={`${TRADER.amount} ${FLEX.input}`}
              />
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmountStr(String(v))}
                  className={`${TRADER.chipOff} ${FLEX.fill}`}
                >
                  {v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountStr(String(Math.floor(maxBet)))}
                className={`${TRADER.chipOff} ${FLEX.fill}`}
                aria-label={`Miser le maximum : ${fmtMoney(Math.floor(maxBet))}`}
              >
                Max
              </button>
            </div>
          </div>

          {/* Quand : un appui sur l'heure, ou « Autre » pour la choisir (caché pendant un signal guidé) */}
          {!signalLive && (
            <div className={TRADER.row} role="group" aria-label="Choisir l'heure de la mise">
              <span className={TRADER.label}>
                Quand
                <HelpTip
                  label="Quand"
                  text="« Maintenant » mise aussitôt. Appuie sur une heure (ou « Autre » pour la choisir) : ta mise partira toute seule à la seconde pile."
                />
              </span>
              <div className={TRADER.chipsBox}>
                <button
                  type="button"
                  onClick={pickNow}
                  aria-pressed={quand === "now"}
                  className={`${quand === "now" ? TRADER.chipOn : TRADER.chipOff} ${FLEX.now}`}
                >
                  Maintenant
                </button>
                {quickSlots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSlot(s)}
                    aria-pressed={quand === String(s)}
                    className={`${quand === String(s) ? TRADER.chipOn : TRADER.chipOff} ${FLEX.fill}`}
                  >
                    {fmtHM(s)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openTimeSheet}
                  aria-pressed={customTime !== ""}
                  aria-haspopup="dialog"
                  className={`${customTime !== "" ? TRADER.chipOn : TRADER.chipOff} ${FLEX.fill}`}
                >
                  Autre
                </button>
              </div>
            </div>
          )}

          {/* Signal : dans combien de temps appuyer, et sur quel bouton */}
          {signalLive && (
            <div role="status" className={TRADER.signalBox}>
              <p className={TRADER.signalText}>
                Dans{" "}
                <span className={TRADER.signalClock}>
                  {fmtRemain(signalRemainMs)}
                </span>
                , appuie sur{" "}
                <span className={TRADER.signalClock}>{signalLabel}</span>
              </p>
            </div>
          )}
          {signal && !signalLive && (
            <div role="alert" className={TRADER.lateBox}>
              <p className={TRADER.lateText}>
                Trop tard : ce coup est passé. Choisis une autre heure dans « Quand ».
              </p>
            </div>
          )}

          {chosenSlot != null && (
            <p className={TRADER.hintOk}>
              Appuie sur ACHAT ou VENTE : la mise partira toute seule à {fmtSlot(chosenSlot)}
              {isOtc(symbol) ? ", même si tu quittes l'app." : "."}
            </p>
          )}
          {chosenSlot == null && (quand === BAD_TIME || quandStale) && (
            <p className={TRADER.hintErr}>
              {quand === BAD_TIME
                ? typedPassed
                  ? "Heure passée : choisis une heure à venir."
                  : "Choisis une heure à venir dans la liste."
                : "Heure passée : choisis une autre heure."}
            </p>
          )}

          {/* Prédiction */}
          <div id="guide-buttons" className={TRADER.goRow}>
            <button
              type="button"
              onClick={() => schedule("UP")}
              disabled={placing !== null}
              aria-label="ACHAT : je prédis que le prix va monter"
              className={`${TRADER.go} ${TRADER.buy} ${
                signalLive && signal?.direction === "UP" ? TRADER.advised : ""
              }`}
            >
              {placing === "UP" ? (
                "…"
              ) : (
                <>
                  ACHAT ▲<small className={TRADER.goGain}>Gain +{fmtMoney(gain)}</small>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => schedule("DOWN")}
              disabled={placing !== null}
              aria-label="VENTE : je prédis que le prix va descendre"
              className={`${TRADER.go} ${TRADER.sell} ${
                signalLive && signal?.direction === "DOWN" ? TRADER.advised : ""
              }`}
            >
              {placing === "DOWN" ? (
                "…"
              ) : (
                <>
                  VENTE ▼<small className={TRADER.goGain}>Gain +{fmtMoney(gain)}</small>
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

      {/* Panneau : choisir son heure (liste des prochaines heures) */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Choisir l'heure" hideTitle>
        <div className={SHEET.list2}>
          <TimePickerPanel
            value={draftTime}
            onChange={setDraftTime}
            onConfirm={() => {
              onCustomTime(draftTime);
              setSheetOpen(false);
            }}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
