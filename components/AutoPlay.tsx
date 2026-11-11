"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { otcPriceAt } from "@/lib/otc";
import { apiOpenTrade, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fmtMoney } from "@/lib/format";
import { Btn } from "./ui";

type RoundStatus = "pending" | "firing" | "ok" | "decale" | "erreur" | "annule";

interface Round {
  slot: number;
  direction: "UP" | "DOWN";
  status: RoundStatus;
  detail?: string;
}

interface Plan {
  gameId: string;
  gameBase: string;
  duration: number;
  amount: number;
  rounds: Round[];
}

const SHOT_DELAY_MS = 150; // on tire juste après la seconde pile (réseau)
const ROUND_CHOICES = [1, 3, 5, 10, 20];
const STAKE_CHOICES = [10, 50, 100];

function signalAt(gameId: string, slot: number, duration: number): "UP" | "DOWN" | "TIE" {
  const from = otcPriceAt(gameId, slot);
  const to = otcPriceAt(gameId, slot + duration);
  return to > from ? "UP" : to < from ? "DOWN" : "TIE";
}

/** Les N prochains coups jouables (les « PASSE » sont sautés). */
function planRounds(gameId: string, duration: number, serverNowMs: number, n: number): Round[] {
  const rounds: Round[] = [];
  let m = Math.ceil(serverNowMs / 60000) * 60;
  for (let guard = 0; rounds.length < n && guard < 180; guard++, m += 60) {
    const v = signalAt(gameId, m, duration);
    if (v !== "TIE") rounds.push({ slot: m, direction: v, status: "pending" });
  }
  return rounds;
}

/** « 14:33 » */
function fmtHM(slot: number): string {
  const d = new Date(slot * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Jeu automatique : mise tout seul sur les signaux à l'heure pile.
 * La page doit rester ouverte (l'app empêche la mise en veille).
 * Chaque coup est vérifié : prix d'ouverture exact = signal respecté.
 */
export function AutoPlay({
  gameId,
  gameBase,
  duration,
  offsetMs,
}: {
  gameId: string;
  gameBase: string;
  duration: number;
  offsetMs: number | null;
}) {
  const { user, loading, setBalance, refresh } = useAuth();
  const [amountStr, setAmountStr] = useState("50");
  const [count, setCount] = useState(5);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const firingRef = useRef<Set<number>>(new Set());
  const failsRef = useRef(0);

  // Horloge pour l'envoi précis + les décomptes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Onglet caché = coups ratés : on prévient.
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Écran allumé pendant le jeu auto (sinon les minuteurs ralentissent).
  useEffect(() => {
    if (!active) return;
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
  }, [active]);

  const serverNowMs = now + (offsetMs ?? 0);
  const amount = parseAmount(amountStr);
  const balance = user?.balance ?? 0;

  // Aperçu du programme (figé au lancement).
  const preview =
    plan || offsetMs == null
      ? null
      : planRounds(gameId, duration, serverNowMs, count);

  const start = () => {
    if (!user || offsetMs == null) return;
    if (amount == null || amount < 10) {
      setMessage("La mise minimum est de 10.");
      return;
    }
    if (amount > balance) {
      setMessage("Solde insuffisant pour cette mise.");
      return;
    }
    const rounds = planRounds(gameId, duration, Date.now() + offsetMs, count);
    if (rounds.length === 0) {
      setMessage("Aucun coup jouable pour l'instant, réessaie dans une minute.");
      return;
    }
    if (rounds.length * amount > balance) {
      setMessage(
        `Il faut ${fmtMoney(rounds.length * amount)} au total, ton solde est de ${fmtMoney(balance)}.`
      );
      return;
    }
    firingRef.current = new Set();
    failsRef.current = 0;
    setPlan({ gameId, gameBase, duration, amount, rounds });
    setMessage(null);
    setActive(true);
  };

  const stop = (msg: string) => {
    setPlan((p) =>
      p
        ? {
            ...p,
            rounds: p.rounds.map((r) =>
              r.status === "pending" || r.status === "firing"
                ? { ...r, status: "annule" as const }
                : r
            ),
          }
        : p
    );
    setActive(false);
    setMessage(msg);
    refresh().catch(() => {});
  };

  // Envoi précis : dès que l'heure pile (+150 ms) est arrivée, on mise.
  useEffect(() => {
    if (!active || !plan || offsetMs == null) return;
    const serverNow = Date.now() + offsetMs;
    for (const r of plan.rounds) {
      if (
        r.status === "pending" &&
        !firingRef.current.has(r.slot) &&
        serverNow >= r.slot * 1000 + SHOT_DELAY_MS
      ) {
        firingRef.current.add(r.slot);
        void (async () => {
          setPlan((p) =>
            p
              ? {
                  ...p,
                  rounds: p.rounds.map((x) =>
                    x.slot === r.slot ? { ...x, status: "firing" as const } : x
                  ),
                }
              : p
          );
          try {
            const res = await apiOpenTrade({
              symbol: plan.gameId,
              direction: r.direction,
              amount: plan.amount,
              durationSec: plan.duration,
            });
            setBalance(res.balance);
            failsRef.current = 0;
            // Vérifié : le prix d'ouverture doit être celui de la seconde pile.
            const exact = res.trade.openPrice === otcPriceAt(plan.gameId, r.slot);
            setPlan((p) =>
              p
                ? {
                    ...p,
                    rounds: p.rounds.map((x) =>
                      x.slot === r.slot
                        ? {
                            ...x,
                            status: exact ? ("ok" as const) : ("decale" as const),
                            detail: exact
                              ? undefined
                              : "Prix décalé : le réseau était trop lent.",
                          }
                        : x
                    ),
                  }
                : p
            );
          } catch (err) {
            failsRef.current += 1;
            const detail =
              err instanceof ApiError ? err.message : "Envoi impossible pour le moment.";
            setPlan((p) =>
              p
                ? {
                    ...p,
                    rounds: p.rounds.map((x) =>
                      x.slot === r.slot ? { ...x, status: "erreur" as const, detail } : x
                    ),
                  }
                : p
            );
            if (failsRef.current >= 2) stop("Connexion perdue : jeu auto arrêté.");
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, active, plan, offsetMs]);

  // Fin : tous les coups sont traités.
  useEffect(() => {
    if (!active || !plan) return;
    if (plan.rounds.every((r) => r.status !== "pending" && r.status !== "firing")) {
      const ok = plan.rounds.filter((r) => r.status === "ok").length;
      setActive(false);
      setMessage(
        ok === plan.rounds.length
          ? `Terminé : ${ok} coup${ok > 1 ? "s" : ""} joué${ok > 1 ? "s" : ""} à l'heure pile.`
          : `Terminé : ${ok} coup${ok > 1 ? "s" : ""} sur ${plan.rounds.length} à l'heure pile.`
      );
      refresh().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, active]);

  const reset = () => {
    setPlan(null);
    setActive(false);
    setMessage(null);
  };

  const nextPending = plan?.rounds.find((r) => r.status === "pending" || r.status === "firing");
  const played = plan?.rounds.filter((r) => r.status === "ok" || r.status === "decale").length ?? 0;

  return (
    <div className="rounded-2xl border border-ligne bg-carte p-3">
      <p className="text-base font-extrabold">Jouer en auto</p>
      <p className="mt-0.5 text-sm text-doux">
        L&apos;app mise toute seule à l&apos;heure pile, sans que tu touches. Les coups
        « PASSE » sont sautés.
      </p>

      {loading ? (
        <p className="mt-2 text-sm text-doux">Chargement…</p>
      ) : !user ? (
        <div className="mt-2 rounded-xl bg-fond p-3 text-center">
          <p className="text-sm font-bold">Connecte-toi pour jouer en auto.</p>
          <Link href="/connexion" className="mt-2 block">
            <Btn className="min-h-[48px] w-full">Se connecter</Btn>
          </Link>
        </div>
      ) : !plan ? (
        <>
          <div className="mt-2">
            <p className="mb-1 text-sm font-extrabold">Mise par coup (solde {fmtMoney(balance)})</p>
            <div className="flex gap-1.5">
              <input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-label="Mise par coup"
                className="h-11 w-[84px] shrink-0 rounded-xl border border-ligne bg-fond px-2 text-center text-base font-extrabold tabular-nums outline-none focus:border-action"
              />
              <div className="grid flex-1 grid-cols-3 gap-1.5" role="group" aria-label="Mises rapides">
                {STAKE_CHOICES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountStr(String(v))}
                    className="h-11 rounded-xl border border-ligne bg-fond text-sm font-bold tabular-nums active:bg-ligne"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2">
            <p className="mb-1 text-sm font-extrabold">Nombre de coups</p>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Nombre de coups">
              {ROUND_CHOICES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className={`min-h-[44px] rounded-xl border text-sm font-extrabold tabular-nums ${
                    count === n
                      ? "border-action bg-action/15 text-texte"
                      : "border-ligne bg-fond text-doux"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {preview && preview.length > 0 && (
            <div className="mt-2 rounded-xl bg-fond px-3 py-2">
              <p className="text-sm font-bold">
                {preview.length} coup{preview.length > 1 ? "s" : ""} · {gameBase} ·{" "}
                {amount != null && amount > 0 ? `${fmtMoney(amount)} par coup` : "mise à choisir"}
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-doux">
                {preview.map((r) => `${fmtHM(r.slot)} ${r.direction === "UP" ? "ACHAT" : "VENTE"}`).join(" · ")}
              </p>
            </div>
          )}

          {message && (
            <p role="alert" className="anim-in mt-2 rounded-xl bg-baisse/10 px-3 py-2 text-center text-sm font-medium text-baisse">
              {message}
            </p>
          )}

          <Btn
            onClick={start}
            disabled={offsetMs == null}
            className="mt-2 min-h-[56px] w-full text-lg font-extrabold"
          >
            {offsetMs == null ? "Synchronisation…" : "Lancer le jeu auto"}
          </Btn>
          <p className="mt-1.5 text-center text-xs text-doux">
            Laisse cette page ouverte : si tu quittes, les coups sont ratés.
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-fond px-3 py-2">
            <p className="text-sm font-extrabold">
              {played}/{plan.rounds.length} joués · {plan.gameBase} · {fmtMoney(plan.amount)}/coup
            </p>
            {active && nextPending && (
              <p className="text-sm font-bold tabular-nums text-action">
                Prochain dans {fmtCountdown(nextPending.slot * 1000 + SHOT_DELAY_MS - serverNowMs)}
              </p>
            )}
          </div>

          {active && hidden && (
            <p role="alert" className="anim-in mt-2 rounded-xl bg-baisse/10 px-3 py-2 text-center text-sm font-bold text-baisse">
              Reviens sur cette page, sinon les coups seront ratés !
            </p>
          )}

          <ul className="mt-2 flex flex-col gap-1.5">
            {plan.rounds.map((r) => (
              <li
                key={r.slot}
                className="flex items-center justify-between gap-2 rounded-xl bg-fond px-3 py-2"
              >
                <span className="text-sm font-extrabold tabular-nums">
                  {fmtHM(r.slot)}{" "}
                  <span className="font-bold text-doux">
                    {r.direction === "UP" ? "ACHAT ▲" : "VENTE ▼"}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold ${
                    r.status === "ok"
                      ? "bg-hausse/15 text-hausse"
                      : r.status === "pending" || r.status === "firing"
                        ? "bg-action/15 text-action"
                        : r.status === "decale"
                          ? "bg-action/15 text-action"
                          : r.status === "annule"
                            ? "bg-fond text-doux"
                            : "bg-baisse/15 text-baisse"
                  }`}
                >
                  {r.status === "ok"
                    ? "JOUÉ ✓"
                    : r.status === "firing"
                      ? "ENVOI…"
                      : r.status === "pending"
                        ? "ATTENTE"
                        : r.status === "decale"
                          ? "DÉCALÉ"
                          : r.status === "annule"
                            ? "ANNULÉ"
                            : "ÉCHEC"}
                </span>
                {r.detail && <span className="sr-only">{r.detail}</span>}
              </li>
            ))}
          </ul>
          {plan.rounds.some((r) => r.detail) && (
            <p className="mt-1.5 text-sm text-doux">
              « DÉCALÉ » = la mise est partie trop tard à cause du réseau : le signal ne
              s&apos;applique plus, le résultat est incertain.
            </p>
          )}

          {message && (
            <p role="status" className="anim-in mt-2 rounded-xl bg-action/10 px-3 py-2 text-center text-sm font-bold">
              {message}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {active ? (
              <Btn onClick={() => stop("Jeu auto arrêté.")} className="min-h-[52px] w-full font-extrabold">
                Arrêter
              </Btn>
            ) : (
              <Btn onClick={reset} className="min-h-[52px] w-full font-extrabold">
                Nouveau jeu
              </Btn>
            )}
            <Link href="/historique" className="block">
              <Btn variant="card" className="min-h-[52px] w-full font-extrabold">
                Résultats
              </Btn>
            </Link>
          </div>
          {active && (
            <p className="mt-1.5 text-center text-xs text-doux">
              Garde cet écran allumé jusqu&apos;à la fin.
            </p>
          )}
        </>
      )}
    </div>
  );
}
