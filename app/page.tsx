"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { TradeForm } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { apiMyTrades, apiSettle } from "@/lib/api";
import { SYMBOLS, type Interval } from "@/lib/symbols";
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
type Tab = "parier" | "encours";

function loadSymbol(): string {
  try {
    const saved = window.localStorage.getItem(SYMBOL_KEY);
    if (saved && SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "BTCUSDT";
}

export default function TraderPage() {
  const { user, setBalance } = useAuth();
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [timeInterval, setTimeInterval] = useState<Interval>("1m");
  const [tab, setTab] = useState<Tab>("parier");
  const [openTrades, setOpenTrades] = useState<ApiTrade[]>([]);
  const [results, setResults] = useState<ApiTrade[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const { price, tickCandle, live, online } = useLiveMarket(symbol, timeInterval);
  const settlingRef = useRef(false);

  useEffect(() => {
    setSymbol(loadSymbol());
    setShowGuide(!hasSeenGuide());
  }, []);

  const pickSymbol = (id: string) => {
    setSymbol(id);
    try {
      window.localStorage.setItem(SYMBOL_KEY, id);
    } catch {
      /* ignore */
    }
  };

  // Charge les prédictions en cours (conservées même si l'app a été fermée).
  const loadOpen = useCallback(async () => {
    try {
      const { trades } = await apiMyTrades("open", 50);
      setOpenTrades(trades);
    } catch {
      /* la bannière hors ligne informe déjà l'utilisateur */
    } finally {
      setListLoading(false);
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
      const now = Date.now();
      const due = openTrades.filter((tr) => new Date(tr.closesAt).getTime() <= now);
      if (due.length === 0) return;
      settlingRef.current = true;
      try {
        const res = await apiSettle(due.map((d) => d.id));
        if (res.settled.length > 0) {
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
      setOpenTrades((prev) => [trade, ...prev]);
      setBalance(balance);
      setTab("encours"); // Bascule vers le compte à rebours, sans scroll.
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

  return (
    <RequireAuth>
      {/* Vue unique : 100 % de la hauteur dispo, aucun scroll de page. */}
      <div className="-mb-[6.5rem] flex h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col gap-2 overflow-hidden">
        {/* Choix de l'actif */}
        <div id="guide-symbol" className="no-scrollbar -mx-4 shrink-0 overflow-x-auto px-4">
          <div className="flex gap-2" role="group" aria-label="Choisir l'actif">
            {SYMBOLS.map((s) => {
              const active = s.id === symbol;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSymbol(s.id)}
                  aria-pressed={active}
                  className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-base font-bold transition-colors duration-200 ${
                    active
                      ? "bg-action text-white"
                      : "border border-ligne bg-carte text-texte active:bg-ligne"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  {s.base}
                </button>
              );
            })}
          </div>
        </div>

        {/* Graphique en bougies : prend toute la place restante */}
        <div id="guide-chart" className="min-h-[120px] flex-1">
          <PriceChart
            symbol={symbol}
            interval={timeInterval}
            onIntervalChange={setTimeInterval}
            price={price}
            tickCandle={tickCandle}
            live={live}
            priceLines={priceLines}
          />
        </div>

        {/* Bas : onglets Parier / En cours */}
        <div className="flex max-h-[52dvh] shrink-0 flex-col">
          <div className="grid shrink-0 grid-cols-2 gap-2" role="tablist" aria-label="Panneau de jeu">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "parier"}
              onClick={() => setTab("parier")}
              className={`min-h-[44px] rounded-xl text-base font-extrabold transition-colors duration-200 ${
                tab === "parier" ? "bg-action text-white" : "border border-ligne bg-carte text-doux"
              }`}
            >
              Parier
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "encours"}
              onClick={() => setTab("encours")}
              className={`min-h-[44px] rounded-xl text-base font-extrabold tabular-nums transition-colors duration-200 ${
                tab === "encours" ? "bg-action text-white" : "border border-ligne bg-carte text-doux"
              }`}
            >
              En cours{openTrades.length > 0 ? ` (${openTrades.length})` : ""}
            </button>
          </div>

          <div className="no-scrollbar mt-2 min-h-0 overflow-y-auto" role="tabpanel">
            {tab === "parier" ? (
              <TradeForm
                balance={user?.balance ?? 0}
                symbol={symbol}
                online={online}
                onOpened={handleOpened}
              />
            ) : listLoading ? (
              <Skeleton className="h-24" />
            ) : sortedOpen.length === 0 ? (
              <button
                type="button"
                onClick={() => setTab("parier")}
                className="w-full rounded-xl border border-dashed border-ligne bg-carte px-4 py-5 text-center text-base text-doux active:bg-ligne"
              >
                Aucune prédiction en cours.
                <span className="block font-bold text-action">Toucher pour parier</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2 pb-1">
                {sortedOpen.map((trade) => (
                  <ActiveTradeCard
                    key={trade.id}
                    trade={trade}
                    price={trade.symbol === symbol ? price : null}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setTab("parier")}
                  className="min-h-[48px] rounded-xl border border-action bg-action/10 text-base font-bold text-action active:bg-action/20"
                >
                  + Nouveau trade
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Résultat : panneau au-dessus de la vue, un à la fois */}
      {results.length > 0 && (
        <>
          <div className="fixed inset-0 z-40 bg-fond/60" aria-hidden="true" />
          <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xl">
            {results.length > 1 && (
              <p className="mb-1 text-center text-sm font-semibold text-doux">
                +{results.length - 1} autre{results.length > 2 ? "s" : ""} résultat
                {results.length > 2 ? "s" : ""} après celui-ci
              </p>
            )}
            <ResultCard
              trade={results[0]}
              onReplay={() => setResults((prev) => prev.slice(1))}
            />
          </div>
        </>
      )}

      {showGuide && (
        <GuideBubbles
          onDone={() => setShowGuide(false)}
          onStep={(step) => {
            if (step >= 2) setTab("parier");
          }}
        />
      )}
    </RequireAuth>
  );
}
