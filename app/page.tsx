"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { TradeForm, type SignalHint } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { BottomSheet } from "@/components/ui";
import { CheckIcon, ChevronDownIcon } from "@/components/Icons";
import { useAuth } from "@/lib/auth-context";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { apiMyTrades, apiSettle } from "@/lib/api";
import { fmtMoney, fmtPrice } from "@/lib/format";
import { SYMBOLS, isDuration, isOtc, isStock, symbolDisplay } from "@/lib/symbols";
import { vibrate } from "@/lib/vibrate";
import type { ApiTrade } from "@/lib/types";

const PriceChart = dynamic(
  () => import("@/components/PriceChart").then((m) => m.PriceChart),
  {
    ssr: false,
    loading: () => <div className="skeleton h-full w-full rounded-2xl" />,
  }
);

const SYMBOL_KEY = "tf_symbol";

function loadSymbol(): string {
  try {
    const saved = window.localStorage.getItem(SYMBOL_KEY);
    if (saved && SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "BTCUSDT";
}

function formatRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `${s}s`;
}

export default function TraderPage() {
  const { user, setBalance } = useAuth();
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [openTrades, setOpenTrades] = useState<ApiTrade[]>([]);
  const [results, setResults] = useState<ApiTrade[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [signalDuration, setSignalDuration] = useState<number | undefined>(undefined);
  const [signal, setSignal] = useState<SignalHint | null>(null);

  const { price, tickCandle, online } = useLiveMarket(symbol, "1m");
  const settlingRef = useRef(false);

  useEffect(() => {
    setSymbol(loadSymbol());
    setShowGuide(!hasSeenGuide());
  }, []);

  // Horloge pour le compte à rebours du bouton flottant.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const pickSymbol = (id: string) => {
    setSymbol(id);
    setAssetOpen(false);
    try {
      window.localStorage.setItem(SYMBOL_KEY, id);
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
      const { trades } = await apiMyTrades("open", 50);
      setOpenTrades(trades);
      const fresh = new Set(trades.map((t) => t.id));
      const vanished = [...openIdsRef.current].filter(
        (id) => !fresh.has(id) && !shownRef.current.has(id)
      );
      openIdsRef.current = fresh;
      if (vanished.length > 0) {
        try {
          const { trades: settled } = await apiMyTrades("settled", 50);
          const found = settled.filter((t) => vanished.includes(t.id));
          if (found.length > 0) {
            found.forEach((t) => shownRef.current.add(t.id));
            setResults((prev) => {
              const known = new Set(prev.map((p) => p.id));
              return [...found.filter((t) => !known.has(t.id)), ...prev].slice(0, 5);
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
    const t = setInterval(loadOpen, 15000);
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
          setResults((prev) => [...res.settled, ...prev].slice(0, 5));
          setBalance(res.balance);
          vibrate(30);
        }
      } catch {
        // Nouvel essai automatique à la prochaine seconde.
      } finally {
        settlingRef.current = false;
      }
    }, 1000);
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
    },
    [setBalance]
  );

  const priceLines = openTrades
    .filter((t) => t.symbol === symbol)
    .map((t) => ({
      price: t.openPrice,
      title: `${t.direction === "UP" ? "Achat" : "Vente"} ${t.amount}`,
      color: t.direction === "UP" ? "#22C55E" : "#EF4444",
    }));

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
      <div className="-mb-[6.5rem] flex h-[calc(100dvh-7.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col gap-2 overflow-hidden lg:mb-0 lg:grid lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-4 lg:overflow-visible">
        {/* Sélecteur d'actif (liste déroulante) + prix en direct */}
        <button
          id="guide-symbol"
          type="button"
          onClick={() => setAssetOpen(true)}
          aria-haspopup="dialog"
          className="flex h-11 w-full shrink-0 items-center justify-between rounded-xl border border-ligne bg-carte px-3 active:bg-ligne lg:col-span-2 lg:max-w-xl"
        >
          <span className="flex items-center gap-2 text-base font-extrabold">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: current.color }}
              aria-hidden="true"
            />
            {symbolDisplay(current.id)}
            <span className="font-medium text-doux">{current.name}</span>
            {current.kind === "otc" && (
              <span className="rounded-lg bg-action/15 px-1.5 py-0.5 text-xs font-extrabold text-action">
                JEU
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-bold tabular-nums text-doux">
              {price != null ? fmtPrice(price) : "…"}
            </span>
            <ChevronDownIcon className="h-5 w-5 text-doux" />
          </span>
        </button>

        {/* Graphique en bougies : prend toute la place restante */}
        <div id="guide-chart" className="min-h-[100px] flex-1 lg:col-start-1 lg:row-start-2 lg:min-h-0">
          <PriceChart
            symbol={symbol}
            interval="1m"
            tickCandle={tickCandle}
            livePrice={isStock(symbol) || isOtc(symbol) ? price : null}
            priceLines={priceLines}
          />
        </div>

        {/* Paris + En cours (colonne de droite sur desktop) */}
        <div className="shrink-0 lg:col-start-2 lg:row-start-2 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto">
          <div className="lg:shrink-0">
            <TradeForm
              balance={user?.balance ?? 0}
              symbol={symbol}
              online={online}
              onOpened={handleOpened}
            />
          </div>

          {/* En cours affiché directement sur desktop (panneau sur mobile). */}
          {sortedOpen.length > 0 && (
            <div className="hidden lg:block">
              <div className="flex flex-col gap-2 rounded-2xl border border-ligne bg-carte p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <p className="font-extrabold">
                    En cours ({sortedOpen.length})
                  </p>
                  <p className="font-bold tabular-nums text-action">
                    Fin dans {formatRemain(nearestMs)}
                  </p>
                </div>
                <p className="-mt-1 text-xs tabular-nums text-doux">
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
          className="anim-in fixed bottom-[4.75rem] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-base font-extrabold tabular-nums text-white shadow-xl active:bg-blue-700 lg:hidden"
        >
          <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
          {openTrades.length} · {formatRemain(nearestMs)}
        </button>
      )}

      {/* Panneau : choix de l'actif */}
      <BottomSheet open={assetOpen} onClose={() => setAssetOpen(false)} title="Choisir un actif">
        <div className="flex flex-col gap-1 pb-2">
          {SYMBOLS.map((s) => {
            const active = s.id === symbol;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSymbol(s.id)}
                aria-pressed={active}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 text-left active:bg-ligne ${
                  active ? "bg-fond" : ""
                }`}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">{symbolDisplay(s.id)}</span>
                  <span className="block text-sm text-doux">
                    {s.name}
                    {s.kind === "stock" ? " · Action" : ""}
                    {s.kind === "otc" ? " · Jeu de hasard" : ""}
                  </span>
                </span>
                {s.kind === "otc" && (
                  <span className="shrink-0 rounded-lg bg-action/15 px-2 py-1 text-xs font-extrabold text-action">
                    JEU
                  </span>
                )}
                {active && <CheckIcon className="h-5 w-5 shrink-0 text-hausse" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Panneau : prédictions en cours */}
      <BottomSheet
        open={encoursVisible}
        onClose={() => setTradesOpen(false)}
        title={`En cours (${openTrades.length})`}
      >
        <div className="flex flex-col gap-2 pb-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-fond px-3 py-2 text-sm">
            <span className="font-bold tabular-nums">
              {sortedOpen.length} prédiction{sortedOpen.length > 1 ? "s" : ""}
            </span>
            <span className="tabular-nums text-doux">Mises {fmtMoney(totalStaked)}</span>
            <span className="font-bold tabular-nums text-action">
              Fin dans {formatRemain(nearestMs)}
            </span>
          </div>
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
        <div className="flex flex-col gap-2 pb-2">
          {results.length > 1 && (
            <p className="text-center text-sm font-semibold text-doux">
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
