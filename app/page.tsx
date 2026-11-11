"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { RequireAuth } from "@/components/AppShell";
import { ActiveTradeCard, ResultCard } from "@/components/TradeCards";
import { TradeForm } from "@/components/TradeForm";
import { GuideBubbles, hasSeenGuide } from "@/components/GuideBubbles";
import { EmptyState, Skeleton } from "@/components/ui";
import { ChartIcon } from "@/components/Icons";
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
      requestAnimationFrame(() => {
        document.getElementById("trades-actifs")?.scrollIntoView({ behavior: "smooth" });
      });
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

  return (
    <RequireAuth>
      <div className="flex flex-col gap-3">
        {/* Choix de l'actif */}
        <div id="guide-symbol" className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2" role="group" aria-label="Choisir l'actif">
            {SYMBOLS.map((s) => {
              const active = s.id === symbol;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSymbol(s.id)}
                  aria-pressed={active}
                  className={`flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl px-4 text-base font-bold transition-colors duration-200 ${
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

        {/* Graphique en bougies */}
        <div id="guide-chart" className="h-[38dvh] min-h-[260px]">
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

        {/* Résultats récents */}
        {results.map((trade) => (
          <ResultCard
            key={trade.id}
            trade={trade}
            onReplay={() => setResults((prev) => prev.filter((r) => r.id !== trade.id))}
          />
        ))}

        {/* Prédictions en cours */}
        <section id="trades-actifs" aria-label="Prédictions en cours" className="flex flex-col gap-3">
          {listLoading ? (
            <>
              <Skeleton className="h-28" />
            </>
          ) : openTrades.length > 0 ? (
            <>
              <h2 className="text-lg font-extrabold">
                En cours ({openTrades.length})
              </h2>
              {[...openTrades]
                .sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt))
                .map((trade) => (
                  <ActiveTradeCard
                    key={trade.id}
                    trade={trade}
                    price={trade.symbol === symbol ? price : null}
                  />
                ))}
            </>
          ) : (
            <EmptyState
              icon={<ChartIcon className="h-10 w-10" />}
              title="Aucune prédiction en cours"
              text="Choisis une durée, une mise, puis prédis si le prix monte ou descend."
            />
          )}
        </section>

        {/* Formulaire */}
        <TradeForm
          balance={user?.balance ?? 0}
          symbol={symbol}
          online={online}
          onOpened={handleOpened}
        />

        <p className="pb-2 text-center text-sm text-doux">
          Les prix sont les vrais prix du marché en direct.{" "}
          <Link href="/cours" className="font-semibold text-action underline">
            Apprendre à lire le graphique
          </Link>
        </p>
      </div>

      {showGuide && <GuideBubbles onDone={() => setShowGuide(false)} />}
    </RequireAuth>
  );
}
