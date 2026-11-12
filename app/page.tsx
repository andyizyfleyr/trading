"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { CandleChart, type ChartToast } from "@/components/CandleChart";
import { ScheduledTrades, TradeForm, type ReplayOrder, type SignalHint } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { BottomSheet } from "@/components/ui";
import { CheckIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useServerOffset } from "@/hooks/useServerOffset";
import { apiCancelScheduled, apiMyTrades, apiSettle, ApiError } from "@/lib/api";
import {
  DEFAULT_INTERVAL,
  FLOAT_TICK_MS,
  RESULTS_SHOWN,
  SCHEDULED_REFRESH_MS,
  SETTLE_TICK_MS,
  SIGNAL_FRESH_FUTURE_MS,
  SIGNAL_FRESH_PAST_MS,
  SIGNAL_LATE_MS,
  SIGNAL_PARAMS,
  STORE,
  TOAST_MS,
  TRADES_PAGE_LIMIT,
  TRADES_REFRESH_MS,
  VIBRATE,
} from "@/lib/config";
import { ENCOURS, SHEET, TRADER } from "@/lib/design";
import { fmtMoney, fmtRemainShort } from "@/lib/format";
import { SYMBOLS, isDuration, symbolDisplay } from "@/lib/symbols";
import { vibrate } from "@/lib/vibrate";
import type { ApiTrade } from "@/lib/types";

function loadSymbol(): string {
  if (typeof window === "undefined") return SYMBOLS[0].id;
  try {
    const saved = window.localStorage.getItem(STORE.symbol);
    if (saved && SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return SYMBOLS[0].id;
}

export default function TraderPage() {
  const { user, setBalance } = useAuth();
  const [symbol, setSymbol] = useState<string>(() => loadSymbol());
  const [openTrades, setOpenTrades] = useState<ApiTrade[]>([]);
  const [scheduled, setScheduled] = useState<ApiTrade[]>([]);
  const [results, setResults] = useState<ApiTrade[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [signalDuration, setSignalDuration] = useState<number | undefined>(undefined);
  const [signal, setSignal] = useState<SignalHint | null>(null);
  const [progSlot, setProgSlot] = useState<number | null>(null);
  const [toast, setToast] = useState<ChartToast | null>(null);
  const [replay, setReplay] = useState<ReplayOrder | null>(null);

  const { price, tickCandle, online } = useLiveMarket(symbol, DEFAULT_INTERVAL);
  const settlingRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message bref sur le graphique (mise, gain, perte).
  const say = useCallback((msg: string, tone: ChartToast["tone"]) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => {
    setShowGuide(!hasSeenGuide());
    // Signal venant de la page Signaux (?jeu=&duree=&sens=&slot=) :
    // pré-remplit le jeu, la durée et le bouton conseillé.
    try {
      const q = new URLSearchParams(window.location.search);
      const jeu = q.get(SIGNAL_PARAMS.game);
      if (jeu && SYMBOLS.some((s) => s.id === jeu)) {
        setSymbol(jeu);
        window.localStorage.setItem(STORE.symbol, jeu);
      }
      const duree = Number(q.get(SIGNAL_PARAMS.duration));
      if (isDuration(duree)) setSignalDuration(duree);
      const sens = q.get(SIGNAL_PARAMS.sense);
      const atMs = Number(q.get(SIGNAL_PARAMS.slot)) * 1000;
      const fresh = atMs > Date.now() - SIGNAL_FRESH_PAST_MS && atMs < Date.now() + SIGNAL_FRESH_FUTURE_MS;
      if ((sens === SIGNAL_PARAMS.up || sens === SIGNAL_PARAMS.down) && Number.isFinite(atMs) && fresh) {
        setSignal({ direction: sens === SIGNAL_PARAMS.up ? "UP" : "DOWN", atMs });
      }
      // Créneau programmé d'avance (« Préparer ma mise ») : présélectionné
      // dans « Départ » (le panneau vérifie qu'il est encore à venir).
      const prog = Number(q.get(SIGNAL_PARAMS.prog));
      if (Number.isInteger(prog) && prog > 0) setProgSlot(prog);
    } catch {
      /* adresse illisible : trader normal */
    }
  }, []);

  // Horloge pour le compte à rebours du bouton flottant.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), FLOAT_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Même heure serveur partout (pas l'horloge du téléphone, parfois fausse).
  const offsetMs = useServerOffset();
  const serverNow = now + (offsetMs ?? 0);

  // Signal raté : on l'efface après un délai (sinon « Trop tard » reste affiché).
  // Heure serveur partagée : effacé au même moment sur tous les écrans.
  useEffect(() => {
    if (!signal) return;
    const wait = signal.atMs + SIGNAL_LATE_MS - (Date.now() + (offsetMs ?? 0));
    if (wait <= 0) {
      setSignal(null);
      return;
    }
    const t = setTimeout(() => setSignal(null), wait);
    return () => clearTimeout(t);
  }, [signal, offsetMs]);

  const pickSymbol = (id: string) => {
    setSymbol(id);
    setAssetOpen(false);
    try {
      window.localStorage.setItem(STORE.symbol, id);
    } catch {
      /* ignore */
    }
  };

  // Prédictions connues comme en cours + résultats déjà montrés.
  // Servent à retrouver ici les résultats clôturés par une autre page
  // (la synchro globale clôture partout, pas seulement sur le Trader).
  const openIdsRef = useRef<Set<number>>(new Set());
  const shownRef = useRef<Set<number>>(new Set());

  // Charge les prédictions en cours (conservées même si l'app a été fermée).
  // Si certaines ont été clôturées ailleurs, leurs résultats sont affichés.
  const loadOpen = useCallback(async () => {
    try {
      const { trades } = await apiMyTrades("open", TRADES_PAGE_LIMIT);
      setOpenTrades(trades);
      const fresh = new Set(trades.map((t) => t.id));
      const vanished = [...openIdsRef.current].filter(
        (id) => !fresh.has(id) && !shownRef.current.has(id)
      );
      openIdsRef.current = fresh;
      if (vanished.length > 0) {
        try {
          const { trades: settled } = await apiMyTrades("settled", TRADES_PAGE_LIMIT);
          const found = settled.filter((t) => vanished.includes(t.id));
          if (found.length > 0) {
            found.forEach((t) => shownRef.current.add(t.id));
            setResults((prev) => {
              const known = new Set(prev.map((p) => p.id));
              return [...found.filter((t) => !known.has(t.id)), ...prev].slice(0, RESULTS_SHOWN);
            });
          }
        } catch {
          /* réessayé au prochain chargement */
        }
      }
    } catch {
      /* la bannière hors ligne informe déjà l'utilisateur */
    }
  }, []);

  useEffect(() => {
    loadOpen();
    const t = setInterval(loadOpen, TRADES_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadOpen]);

  // Mises programmées sur le serveur (partent même appli fermée) :
  // affichées dans le panneau « En cours ».
  const loadScheduled = useCallback(async () => {
    try {
      const { trades } = await apiMyTrades("scheduled", TRADES_PAGE_LIMIT);
      setScheduled(trades);
    } catch {
      /* non connecté ou hors ligne : on garde la liste connue */
    }
  }, []);

  useEffect(() => {
    loadScheduled();
    const t = setInterval(loadScheduled, SCHEDULED_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadScheduled]);

  const cancelScheduled = useCallback(
    async (id: number) => {
      try {
        const res = await apiCancelScheduled(id);
        setBalance(res.balance);
        loadScheduled();
      } catch (err) {
        say(err instanceof ApiError ? err.message : "Annulation impossible pour le moment.", null);
      }
    },
    [loadScheduled, setBalance, say]
  );

  // Clôture automatique à la fin de chaque compte à rebours.
  useEffect(() => {
    const t = setInterval(async () => {
      if (settlingRef.current || !online) return;
      const current = Date.now();
      const due = openTrades.filter((tr) => new Date(tr.closesAt).getTime() <= current);
      if (due.length === 0) return;
      settlingRef.current = true;
      try {
        const res = await apiSettle(due.map((d) => d.id));
        if (res.settled.length > 0) {
          res.settled.forEach((s) => shownRef.current.add(s.id));
          setOpenTrades((prev) =>
            prev.filter((p) => !res.settled.some((s) => s.id === p.id))
          );
          setResults((prev) => [...res.settled, ...prev].slice(0, RESULTS_SHOWN));
          setBalance(res.balance);
          vibrate(VIBRATE.settle);
          // Un seul message : en boucle, chaque appel écrase le précédent et
          // seul le dernier résultat s'affiche.
          if (res.settled.length === 1) {
            const s = res.settled[0];
            if (s.result === "WIN") say(`Gagné +${fmtMoney((s.payout ?? 0) - s.amount)}`, "win");
            else if (s.result === "LOSS") say(`Perdu −${fmtMoney(s.amount)}`, "loss");
            else say("Égalité : mise rendue", null);
          } else {
            const won = res.settled.filter((s) => s.result === "WIN").length;
            const lost = res.settled.filter((s) => s.result === "LOSS").length;
            say(
              `${res.settled.length} résultats : ${won} gagné${won > 1 ? "s" : ""}, ${lost} perdu${lost > 1 ? "s" : ""}`,
              won > lost ? "win" : lost > won ? "loss" : null
            );
          }
        }
      } catch {
        // Nouvel essai automatique à la prochaine seconde.
      } finally {
        settlingRef.current = false;
      }
    }, SETTLE_TICK_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, online]);

  const handleOpened = useCallback(
    (trade: ApiTrade, balance: number) => {
      openIdsRef.current.add(trade.id);
      setOpenTrades((prev) => [trade, ...prev]);
      setBalance(balance);
      setSignal(null); // Coup joué : le signal a servi, on l'efface.
      setTradesOpen(true); // Affiche aussitôt le compte à rebours.
      say(
        `${trade.direction === "UP" ? "Hausse" : "Baisse"} ${fmtMoney(trade.amount)} · ${trade.durationSec} s`,
        null
      );
    },
    [setBalance, say]
  );

  const sortedOpen = [...openTrades].sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt));
  // Programmées encore à venir (l'horloge serveur les fait basculer vers « En cours »).
  const scheduledUp = scheduled.filter((t) => new Date(t.openedAt).getTime() > serverNow);
  const nearestMs =
    sortedOpen.length === 0
      ? 0
      : Math.max(0, +new Date(sortedOpen[0].closesAt) - serverNow);
  // Prochain départ programmé (pour l'en-tête « En cours »).
  const nextSchedMs =
    scheduledUp.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(...scheduledUp.map((t) => new Date(t.openedAt).getTime())) - serverNow
        );
  const totalStaked = sortedOpen.reduce((s, t) => s + t.amount, 0);
  // Mises programmées : promises au départ, comptées à part.
  const scheduledStaked = scheduledUp.reduce((s, t) => s + t.amount, 0);
  // Prix des autres jeux (trades ouverts ailleurs que sur le jeu affiché).
  const otherSymbols = useMemo(
    () => [...new Set(sortedOpen.map((t) => t.symbol))].filter((s) => s !== symbol),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTrades, symbol]
  );
  const otherPrices = useLivePrices(otherSymbols);
  const priceOf = (t: ApiTrade) =>
    t.symbol === symbol ? price : (otherPrices[t.symbol] ?? null);
  const isDesktop = useIsDesktop();
  // Le panneau se referme tout seul dès qu'il n'y a plus rien dedans.
  // Sur desktop, « En cours » est affiché dans la colonne de droite, pas en panneau.
  const encoursVisible =
    tradesOpen && (sortedOpen.length > 0 || scheduledUp.length > 0) && !isDesktop;

  return (
    <RequireAuth>
      {/* Vue unique : 100 % de la hauteur dispo, aucun scroll de page. */}
      <div className={TRADER.root}>
        {/* Graphique maison en bougies : prend toute la place restante */}
        <div id="guide-chart" className={TRADER.chartBox}>
          <CandleChart
            symbol={symbol}
            interval={DEFAULT_INTERVAL}
            tickCandle={tickCandle}
            livePrice={price}
            toast={toast}
            endsInMs={sortedOpen.length > 0 ? nearestMs : null}
          />
          {/* Pastille « N en cours » en bas à gauche du graphique (maquette). */}
          {openTrades.length > 0 && (
            <button
              type="button"
              onClick={() => setTradesOpen(true)}
              aria-label={`Voir les ${openTrades.length} prédictions en cours`}
              className={TRADER.pill}
            >
              <span className={TRADER.pillDot} aria-hidden="true" />
              {openTrades.length} en cours
            </button>
          )}
        </div>

        {/* Paris + En cours (colonne de droite sur desktop) */}
        <div className={TRADER.sideCol}>
          <div className={TRADER.formWrap}>
            <TradeForm
              balance={user?.balance ?? 0}
              symbol={symbol}
              online={online}
              onOpened={handleOpened}
              initialDuration={signalDuration}
              signal={signal}
              onBalance={setBalance}
              replay={replay}
              progSlot={progSlot}
              onScheduledChange={() => {
                void loadScheduled();
                setTradesOpen(true); // Montre aussitôt la mise programmée.
              }}
              onPickAsset={() => setAssetOpen(true)}
            />
          </div>

          {/* En cours affiché directement sur desktop (panneau sur mobile). */}
          {(sortedOpen.length > 0 || scheduledUp.length > 0) && (
            <div className={TRADER.onlyDesktop}>
              <div className={TRADER.openPanel}>
                {(sortedOpen.length > 0 || scheduledUp.length > 0) && (
                  <>
                    <div className={TRADER.openHead}>
                      <p className={TRADER.openTitle}>
                        {sortedOpen.length > 0
                          ? `En cours (${sortedOpen.length})`
                          : `Programmé(es) (${scheduledUp.length})`}
                      </p>
                      <p className={TRADER.openSoon}>
                        {sortedOpen.length > 0
                          ? `Fin dans ${fmtRemainShort(nearestMs)}`
                          : `Départ dans ${fmtRemainShort(nextSchedMs)}`}
                      </p>
                    </div>
                    <p className={TRADER.openStaked}>
                      {sortedOpen.length > 0 && <>Mises {fmtMoney(totalStaked)}</>}
                      {sortedOpen.length > 0 && scheduledUp.length > 0 && " · "}
                      {scheduledUp.length > 0 && (
                        <>Programmé(es) {fmtMoney(scheduledStaked)}</>
                      )}
                    </p>
                    {sortedOpen.map((trade) => (
                      <ActiveTradeCard
                        key={trade.id}
                        trade={trade}
                        price={priceOf(trade)}
                      />
                    ))}
                  </>
                )}
                <ScheduledTrades trades={scheduledUp} onCancel={cancelScheduled} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panneau : choix de l'actif */}
      <BottomSheet open={assetOpen} onClose={() => setAssetOpen(false)} title="Choisir un jeu">
        <div className={SHEET.list1}>
          {SYMBOLS.map((s) => {
            const active = s.id === symbol;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSymbol(s.id)}
                aria-pressed={active}
                className={`${SHEET.row} ${active ? SHEET.rowOn : ""}`}
              >
                <span
                  className={SHEET.dot}
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className={SHEET.rowName}>
                  {symbolDisplay(s.id)}
                </span>
                {s.kind === "otc" && (
                  <span className={TRADER.tag}>
                    JEU
                  </span>
                )}
                {active && <CheckIcon className={SHEET.rowCheck} />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Panneau : prédictions en cours + programmées (résumé dans l'en-tête) */}
      <BottomSheet
        open={encoursVisible}
        onClose={() => setTradesOpen(false)}
        title={
          sortedOpen.length > 0
            ? `En cours (${openTrades.length})`
            : `Programmé(es) (${scheduledUp.length})`
        }
        header={
          <div className={ENCOURS.head}>
            <h2 className={ENCOURS.title}>
              {sortedOpen.length > 0 ? "En cours" : "Programmé(es)"}
            </h2>
            {(sortedOpen.length > 0 || scheduledUp.length > 0) && (
              <>
                <span className={ENCOURS.badge}>
                  {sortedOpen.length > 0 ? sortedOpen.length : scheduledUp.length}
                </span>
                <p className={ENCOURS.sum}>
                  {sortedOpen.length > 0 && (
                    <>
                      Mises <b className={ENCOURS.sumB}>{fmtMoney(totalStaked)}</b> · Fin dans{" "}
                      <b className={ENCOURS.sumB}>{fmtRemainShort(nearestMs)}</b>
                    </>
                  )}
                  {sortedOpen.length > 0 && scheduledUp.length > 0 && " · "}
                  {scheduledUp.length > 0 && (
                    <>
                      Programmé(es){" "}
                      <b className={ENCOURS.sumB}>{fmtMoney(scheduledStaked)}</b>
                      {sortedOpen.length === 0 && (
                        <>
                          {" "}· Départ dans{" "}
                          <b className={ENCOURS.sumB}>{fmtRemainShort(nextSchedMs)}</b>
                        </>
                      )}
                    </>
                  )}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => setTradesOpen(false)}
              aria-label="Fermer"
              className={ENCOURS.close}
            >
              ✕
            </button>
          </div>
        }
      >
        <div className={ENCOURS.list}>
          {sortedOpen.map((trade) => (
            <ActiveTradeCard
              key={trade.id}
              trade={trade}
              price={priceOf(trade)}
            />
          ))}
          <ScheduledTrades trades={scheduledUp} onCancel={cancelScheduled} />
          {sortedOpen.length === 0 && scheduledUp.length === 0 && (
            <p className={ENCOURS.empty}>Aucun trade en cours</p>
          )}
        </div>
      </BottomSheet>

      {/* Panneau : résultat, un à la fois (maquette : solde + Rejouer) */}
      <BottomSheet
        open={results.length > 0}
        onClose={() => setResults((prev) => prev.slice(1))}
        title="Résultat"
        header={
          <div className={ENCOURS.head}>
            <h2 className={ENCOURS.title}>Résultat</h2>
            <p className={ENCOURS.sum}>
              Solde <b className={ENCOURS.sumB}>{fmtMoney(user?.balance ?? 0)}</b>
            </p>
            <button
              type="button"
              onClick={() => setResults((prev) => prev.slice(1))}
              aria-label="Fermer"
              className={ENCOURS.close}
            >
              ✕
            </button>
          </div>
        }
      >
        <div className={SHEET.list2}>
          {results.length > 1 && (
            <p className={TRADER.moreResults}>
              +{results.length - 1} autre{results.length > 2 ? "s" : ""} résultat
              {results.length > 2 ? "s" : ""} après celui-ci
            </p>
          )}
          {results[0] && (
            <ResultCard
              trade={results[0]}
              onReplay={() => {
                const t = results[0];
                setResults((prev) => prev.slice(1));
                if (t.symbol !== symbol) pickSymbol(t.symbol);
                setReplay({
                  direction: t.direction,
                  amount: t.amount,
                  durationSec: t.durationSec,
                  nonce: Date.now(),
                });
              }}
            />
          )}
        </div>
      </BottomSheet>

      {showGuide && <GuideBubbles onDone={() => setShowGuide(false)} />}
    </RequireAuth>
  );
}
