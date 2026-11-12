"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { CandleChart, type ChartToast } from "@/components/CandleChart";
import { TradeForm, type SignalHint } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { BottomSheet } from "@/components/ui";
import { CheckIcon, ChevronDownIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { apiMyTrades, apiSettle } from "@/lib/api";
import {
  DEFAULT_INTERVAL,
  FLOAT_TICK_MS,
  RESULTS_SHOWN,
  SETTLE_TICK_MS,
  SIGNAL_FRESH_FUTURE_MS,
  SIGNAL_FRESH_PAST_MS,
  SIGNAL_PARAMS,
  STORE,
  TOAST_MS,
  TRADES_PAGE_LIMIT,
  TRADES_REFRESH_MS,
  VIBRATE,
} from "@/lib/config";
import { ENCOURS, SHEET, STACK, TRADER } from "@/lib/design";
import { fmtMoney, fmtPrice, fmtRemainShort } from "@/lib/format";
import { SYMBOLS, isDuration, isOtc, symbolDisplay } from "@/lib/symbols";
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
  const [results, setResults] = useState<ApiTrade[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [signalDuration, setSignalDuration] = useState<number | undefined>(undefined);
  const [signal, setSignal] = useState<SignalHint | null>(null);
  const [toast, setToast] = useState<ChartToast | null>(null);

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
    } catch {
      /* adresse illisible : trader normal */
    }
  }, []);

  // Horloge pour le compte à rebours du bouton flottant.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), FLOAT_TICK_MS);
    return () => clearInterval(t);
  }, []);

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
          for (const s of res.settled) {
            if (s.result === "WIN") say(`Gagné +${fmtMoney((s.payout ?? 0) - s.amount)}`, "win");
            else if (s.result === "LOSS") say(`Perdu −${fmtMoney(s.amount)}`, "loss");
            else say("Égalité : mise rendue", null);
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
        `${trade.direction === "UP" ? "Achat" : "Vente"} ${fmtMoney(trade.amount)} · ${trade.durationSec} s`,
        null
      );
    },
    [setBalance, say]
  );

  const sortedOpen = [...openTrades].sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt));
  const nearestMs =
    sortedOpen.length === 0
      ? 0
      : Math.max(0, +new Date(sortedOpen[0].closesAt) - now);
  const totalStaked = sortedOpen.reduce((s, t) => s + t.amount, 0);
  const isDesktop = useIsDesktop();
  // Le panneau se referme tout seul dès qu'il n'y a plus rien dedans.
  // Sur desktop, « En cours » est affiché dans la colonne de droite, pas en panneau.
  const encoursVisible = tradesOpen && sortedOpen.length > 0 && !isDesktop;
  const current = SYMBOLS.find((s) => s.id === symbol) ?? SYMBOLS[0];

  return (
    <RequireAuth>
      {/* Vue unique : 100 % de la hauteur dispo, aucun scroll de page. */}
      <div className={TRADER.root}>
        {/* Sélecteur d'actif (liste déroulante) + prix en direct */}
        <button
          id="guide-symbol"
          type="button"
          onClick={() => setAssetOpen(true)}
          aria-haspopup="dialog"
          className={TRADER.assetBtn}
        >
          <span className={TRADER.assetMain}>
            <span
              className={TRADER.dot}
              style={{ backgroundColor: current.color }}
              aria-hidden="true"
            />
            {symbolDisplay(current.id)}
            {current.kind === "otc" && (
              <span className={TRADER.tag}>
                JEU
              </span>
            )}
          </span>
          <span className={TRADER.assetRight}>
            <span className={TRADER.assetPrice}>
              {price != null ? fmtPrice(price) : "…"}
            </span>
            <ChevronDownIcon className={TRADER.chevron} />
          </span>
        </button>

        {/* Graphique maison en bougies : prend toute la place restante */}
        <div id="guide-chart" className={TRADER.chartBox}>
          <CandleChart
            symbol={symbol}
            interval={DEFAULT_INTERVAL}
            tickCandle={tickCandle}
            livePrice={isOtc(symbol) ? price : null}
            toast={toast}
          />
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
            />
          </div>

          {/* En cours affiché directement sur desktop (panneau sur mobile). */}
          {sortedOpen.length > 0 && (
            <div className={TRADER.onlyDesktop}>
              <div className={TRADER.openPanel}>
                <div className={TRADER.openHead}>
                  <p className={TRADER.openTitle}>
                    En cours ({sortedOpen.length})
                  </p>
                  <p className={TRADER.openSoon}>
                    Fin dans {fmtRemainShort(nearestMs)}
                  </p>
                </div>
                <p className={TRADER.openStaked}>
                  Mises {fmtMoney(totalStaked)}
                </p>
                {sortedOpen.map((trade) => (
                  <ActiveTradeCard
                    key={trade.id}
                    trade={trade}
                    price={trade.symbol === symbol ? price : null}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bouton flottant : prédictions en cours (masqué si aucune) */}
      {openTrades.length > 0 && !encoursVisible && results.length === 0 && (
        <button
          type="button"
          onClick={() => setTradesOpen(true)}
          aria-label={`Voir les ${openTrades.length} prédictions en cours`}
          className={TRADER.floatBtn}
        >
          <span className={TRADER.floatDot} aria-hidden="true" />
          {openTrades.length} · {fmtRemainShort(nearestMs)}
        </button>
      )}

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

      {/* Panneau : prédictions en cours (compact : résumé dans l'en-tête) */}
      <BottomSheet
        open={encoursVisible}
        onClose={() => setTradesOpen(false)}
        title={`En cours (${openTrades.length})`}
        header={
          <div className={ENCOURS.head}>
            <h2 className={ENCOURS.title}>En cours</h2>
            <span className={ENCOURS.badge}>{sortedOpen.length}</span>
            <p className={ENCOURS.sum}>
              Mises <b className={ENCOURS.sumB}>{fmtMoney(totalStaked)}</b> · Fin dans{" "}
              <b className={ENCOURS.sumB}>{fmtRemainShort(nearestMs)}</b>
            </p>
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
              price={trade.symbol === symbol ? price : null}
            />
          ))}
        </div>
      </BottomSheet>

      {/* Panneau : résultat, un à la fois */}
      <BottomSheet
        open={results.length > 0}
        onClose={() => setResults((prev) => prev.slice(1))}
        title="Résultat"
      >
        <div className={SHEET.list2}>
          {results.length > 1 && (
            <p className={TRADER.moreResults}>
              +{results.length - 1} autre{results.length > 2 ? "s" : ""} résultat
              {results.length > 2 ? "s" : ""} après celui-ci
            </p>
          )}
          {results[0] && (
            <ResultCard trade={results[0]} onReplay={() => setResults((prev) => prev.slice(1))} />
          )}
        </div>
      </BottomSheet>

      {showGuide && <GuideBubbles onDone={() => setShowGuide(false)} />}
    </RequireAuth>
  );
}
