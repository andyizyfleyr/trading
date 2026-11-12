"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiCancelScheduled, apiMyTrades, apiOpenTrade, apiScheduleTrade, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { vibrate } from "@/lib/vibrate";
import { DURATIONS } from "@/lib/symbols";
import { durationLabel, isOtc, symbolDisplay } from "@/lib/symbols";
import type { ApiTrade } from "@/lib/types";
import { BottomSheet, Btn, Card, HelpTip } from "./ui";
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

const SHOT_DELAY_MS = 150; // on tire juste après la seconde pile (réseau)
/** Choix d'heure invalide (saisie incomplète ou passée) : jamais de mise surprise. */
const BAD_TIME = "__bad";

function formatRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Heure locale avec la seconde exacte : « 14:33:00 ». */
function fmtSlot(slot: number): string {
  const d = new Date(slot * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

/** Heure courte pour les boutons : « 14:33 ». */
function fmtHM(slot: number): string {
  const d = new Date(slot * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [durationSec, setDurationSec] = useState<number>(initialDuration ?? 60);
  const [amountStr, setAmountStr] = useState("50");
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
      const { trades } = await apiMyTrades("scheduled", 50);
      setScheduledList(trades);
    } catch {
      /* non connecté ou hors ligne : pas de bandeau */
    }
  }, []);

  useEffect(() => {
    refreshScheduled();
    const t = setInterval(refreshScheduled, 30000);
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
    const t = setInterval(() => setSignalNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [signal]);

  // Écart d'horloge avec le serveur (pour tirer à la seconde pile).
  useEffect(() => {
    let stopped = false;
    const sync = async () => {
      const t0 = Date.now();
      try {
        const res = await fetch("/api/price?symbol=BTCUSDT", { cache: "no-store" });
        const json = (await res.json()) as { data?: { time?: unknown } };
        const serverTime = Number(json?.data?.time);
        if (!stopped && Number.isFinite(serverTime)) {
          setOffsetMs(serverTime - (t0 + Date.now()) / 2);
        }
      } catch {
        /* horloge locale en secours */
      }
    };
    sync();
    const t = setInterval(sync, 30000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  // Horloge pendant l'attente d'une mise programmée.
  useEffect(() => {
    if (!pending) return;
    setTick(Date.now());
    const t = setInterval(() => setTick(Date.now()), 250);
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
  const gain = amount != null && amount > 0 ? Math.round(amount * 0.85 * 100) / 100 : 0;

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
    if (amt < 10) {
      setError("La mise minimum est de 10.");
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
      vibrate(20);
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
    if (amount < 10) {
      setError("La mise minimum est de 10.");
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
        vibrate(20);
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

  const chipClass = (active: boolean, flex: string) =>
    `h-10 min-w-0 ${flex} rounded-xl text-sm font-bold transition-colors duration-200 ${
      active ? "bg-primary text-white" : "border border-ligne bg-fond text-doux active:text-texte"
    }`;

  return (
    <Card className="flex flex-col gap-1.5 p-2">
      {pending ? (
        /* Mise programmée sur l'appareil : attente de l'heure choisie */
        <div role="status" className="anim-in rounded-xl bg-action/15 px-3 py-2">
          <p className="text-center text-base font-extrabold">
            {pending.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"} {fmtMoney(pending.amount)} à{" "}
            <span className="tabular-nums">{fmtSlot(pending.slot)}</span>
          </p>
          <p className="text-center text-3xl font-extrabold tabular-nums">
            {formatRemain(pendingRemainMs)}
          </p>
          {hidden && (
            <p role="alert" className="mt-1 rounded-lg bg-baisse/10 px-2 py-1 text-center text-sm font-bold text-baisse">
              Reviens vite sur cette page, sinon la mise ne partira pas !
            </p>
          )}
          <Btn variant="ghost" onClick={() => setPending(null)} className="mt-1.5 min-h-[48px] w-full font-extrabold">
            Annuler
          </Btn>
          <p className="mt-1 text-center text-xs text-doux">
            Reste sur cette page jusqu&apos;au départ.
          </p>
        </div>
      ) : serverPending ? (
        /* Mise programmée sur le serveur : part même appli fermée */
        <div role="status" className="anim-in rounded-xl bg-hausse/15 px-3 py-2">
          <p className="text-center text-base font-extrabold text-hausse">Programmé ✓</p>
          <p className="mt-0.5 text-center text-sm font-bold">
            {serverPending.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"}{" "}
            {fmtMoney(serverPending.amount)} {symbolDisplay(serverPending.symbol)} à{" "}
            <span className="tabular-nums">{fmtSlot(slotOf(serverPending))}</span>
          </p>
          <p className="mt-0.5 text-center text-xs text-doux">
            Partira tout seul à l&apos;heure, même si tu quittes l&apos;app.
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Btn variant="ghost" onClick={() => setServerPending(null)} className="min-h-[48px] w-full font-extrabold">
              OK
            </Btn>
            <Btn variant="red" onClick={() => cancelScheduled(serverPending.id)} className="min-h-[48px] w-full font-extrabold">
              Annuler
            </Btn>
          </div>
          <p className="mt-1 text-center text-xs text-doux">Annuler = mise remboursée.</p>
        </div>
      ) : (
        <>
          {/* Mises programmées : partent toutes seules, annulables */}
          {upcoming.length > 0 && (
            <div className="rounded-xl bg-fond px-2.5 py-2">
              <p className="text-sm font-extrabold">
                Programmé{upcoming.length > 1 ? "es" : ""} ({upcoming.length})
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-bold tabular-nums">
                      {t.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"} {fmtMoney(t.amount)}{" "}
                      <span className="font-medium text-doux">
                        {symbolDisplay(t.symbol)} à {fmtHM(slotOf(t))}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelScheduled(t.id)}
                      aria-label={`Annuler la mise programmée à ${fmtSlot(slotOf(t))} (remboursée)`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ligne bg-carte text-base font-extrabold text-doux active:text-texte"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {/* Quand : un appui sur l'heure, ou « Autre » pour la choisir (caché pendant un signal guidé) */}
          {!signalLive && (
            <div>
              <div className="mb-0.5 flex items-center gap-1 text-xs font-medium text-doux">
                Quand
                <HelpTip
                  label="Quand"
                  text="« Maintenant » mise aussitôt. Appuie sur une heure (ou « Autre » pour la choisir) : ta mise partira toute seule à la seconde pile."
                />
              </div>
              <div className="flex gap-1.5" role="group" aria-label="Choisir l'heure de la mise">
                <button
                  type="button"
                  onClick={pickNow}
                  aria-pressed={quand === "now"}
                  className={chipClass(quand === "now", "flex-[1.5]")}
                >
                  Maintenant
                </button>
                {quickSlots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSlot(s)}
                    aria-pressed={quand === String(s)}
                    className={`${chipClass(quand === String(s), "flex-1")} tabular-nums`}
                  >
                    {fmtHM(s)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openTimeSheet}
                  aria-pressed={customTime !== ""}
                  aria-haspopup="dialog"
                  className={chipClass(customTime !== "", "flex-1")}
                >
                  Autre
                </button>
              </div>
            </div>
          )}

          {/* Signal : dans combien de temps appuyer, et sur quel bouton */}
          {signalLive && (
            <div role="status" className="anim-in rounded-xl bg-action/15 px-3 py-2 text-center">
              <p className="text-sm font-bold">
                Dans{" "}
                <span className="text-lg font-extrabold tabular-nums">
                  {formatRemain(signalRemainMs)}
                </span>
                , appuie sur{" "}
                <span className="font-extrabold">{signalLabel}</span>
              </p>
            </div>
          )}
          {signal && !signalLive && (
            <div role="alert" className="anim-in rounded-xl bg-baisse/10 px-3 py-2 text-center">
            <p className="text-sm font-bold text-baisse">
              Trop tard : ce coup est passé. Choisis une autre heure dans « Quand ».
            </p>
            </div>
          )}

          {chosenSlot != null && (
            <p className="text-center text-xs font-bold text-action">
              Appuie sur ACHAT ou VENTE : la mise partira toute seule à {fmtSlot(chosenSlot)}
              {isOtc(symbol) ? ", même si tu quittes l'app." : "."}
            </p>
          )}
          {chosenSlot == null && (quand === BAD_TIME || quandStale) && (
            <p className="text-center text-xs font-bold text-baisse">
              {quand === BAD_TIME
                ? typedPassed
                  ? "Heure passée : choisis une heure à venir."
                  : "Choisis une heure à venir dans la liste."
                : "Heure passée : choisis une autre heure."}
            </p>
          )}

          {/* Prédiction */}
          <div id="guide-buttons" className="grid grid-cols-2 gap-1.5">
            <Btn
              variant="green"
              onClick={() => schedule("UP")}
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
              onClick={() => schedule("DOWN")}
              disabled={placing !== null}
              aria-label="VENTE : je prédis que le prix va descendre"
              className={`min-h-[56px] text-lg font-extrabold ${
                signalLive && signal?.direction === "DOWN" ? "animate-pulse ring-4 ring-white" : ""
              }`}
            >
              {placing === "DOWN" ? "…" : "VENTE ▼"}
            </Btn>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="anim-in rounded-xl bg-baisse/10 px-3 py-1.5 text-center text-sm font-medium text-baisse">
          {error}
        </p>
      )}

      {/* Panneau : choisir son heure (liste des prochaines heures) */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Choisir l'heure" hideTitle>
        <div className="flex flex-col gap-2 pb-2">
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
    </Card>
  );
}
