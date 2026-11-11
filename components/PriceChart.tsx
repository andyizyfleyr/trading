"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { apiCandles, ApiError } from "@/lib/api";
import { fmtPrice } from "@/lib/format";
import { INTERVALS, type Interval } from "@/lib/symbols";
import type { ApiCandle } from "@/lib/types";
import { HelpTip } from "./ui";

export interface ChartPriceLine {
  price: number;
  title: string;
  color: string;
}

interface Props {
  symbol: string;
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  /** Dernier prix connu (WebSocket ou sondage). */
  price: number | null;
  /** Bougie en formation reçue en direct. */
  tickCandle: ApiCandle | null;
  live: boolean;
  priceLines: ChartPriceLine[];
}

function toBar(c: ApiCandle) {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

/** Graphique en bougies (TradingView Lightweight Charts, chargé à la demande). */
export function PriceChart({
  symbol,
  interval,
  onIntervalChange,
  price,
  tickCandle,
  live,
  priceLines,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const lastBarRef = useRef<{ time: number } | null>(null);
  const pendingRef = useRef<ReturnType<typeof toBar>[] | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [up, setUp] = useState<boolean | null>(null);

  // Flèche ▲/▼ selon le sens du dernier mouvement de prix.
  useEffect(() => {
    if (price == null) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = price;
    if (prev == null || prev === price) return;
    setUp(price > prev);
  }, [price]);

  // Création du graphique (une seule fois, import dynamique pour rester léger).
  useEffect(() => {
    let chart: IChartApi | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      const { createChart, ColorType } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#9CA3AF",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11,
        },
        grid: { vertLines: { color: "#1E2A44" }, horzLines: { color: "#1E2A44" } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4 },
        crosshair: {
          vertLine: { color: "#3B82F6", labelBackgroundColor: "#3B82F6" },
          horzLine: { color: "#3B82F6", labelBackgroundColor: "#3B82F6" },
        },
      });
      const series = chart.addCandlestickSeries({
        upColor: "#22C55E",
        downColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        borderVisible: false,
      });
      chartRef.current = chart;
      seriesRef.current = series;
      if (pendingRef.current) {
        const data = pendingRef.current;
        pendingRef.current = null;
        series.setData(data);
        lastBarRef.current = data[data.length - 1] ?? null;
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 90), to: data.length + 4 });
      }
      ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect && chart) chart.applyOptions({ width: rect.width, height: rect.height });
      });
      if (containerRef.current) ro.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      linesRef.current = [];
      try {
        chart?.remove();
      } catch {
        /* ignore */
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Chargement de l'historique des bougies.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    lastBarRef.current = null;

    apiCandles(symbol, interval, 200)
      .then(({ candles }) => {
        if (cancelled) return;
        const data = candles.map(toBar);
        if (seriesRef.current && chartRef.current) {
          seriesRef.current.setData(data);
          lastBarRef.current = data[data.length - 1] ?? null;
          chartRef.current
            .timeScale()
            .setVisibleLogicalRange({ from: Math.max(0, data.length - 90), to: data.length + 4 });
        } else {
          pendingRef.current = data;
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setError(
          err instanceof ApiError ? err.message : "Graphique temporairement indisponible."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, reloadKey]);

  // Mises à jour en direct de la bougie en formation.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !tickCandle) return;
    const last = lastBarRef.current;
    // Ignore les ticks antérieurs à la dernière bougie chargée.
    if (last && tickCandle.time < last.time) return;
    try {
      series.update(toBar(tickCandle));
      lastBarRef.current = { time: tickCandle.time };
    } catch {
      /* tick ignoré */
    }
  }, [tickCandle]);

  // Lignes de prix d'ouverture des prédictions en cours.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of linesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* ignore */
      }
    }
    linesRef.current = priceLines.map((pl) =>
      series.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: pl.title,
      })
    );
  }, [priceLines]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-ligne bg-carte">
      {/* Barre d'intervalle + prix en direct */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
        <div className="flex items-center gap-1 rounded-xl bg-fond/85 p-1 backdrop-blur">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => onIntervalChange(iv)}
              aria-pressed={interval === iv}
              className={`min-h-[44px] rounded-lg px-3 text-base font-bold transition-colors duration-200 ${
                interval === iv ? "bg-action text-white" : "text-doux active:text-texte"
              }`}
            >
              {iv}
            </button>
          ))}
          <span className="px-1">
            <HelpTip
              label="Bougie"
              text="Chaque bougie résume le prix sur une période (1, 5 ou 15 minutes). Verte ▲ : le prix a monté. Rouge ▼ : il a baissé."
            />
          </span>
        </div>

        <div className="flex flex-col items-end rounded-xl bg-fond/85 px-3 py-1.5 backdrop-blur">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-doux">
            <span
              className={`h-2 w-2 rounded-full ${live ? "bg-hausse pulse-dot" : "bg-doux"}`}
            />
            {live ? "EN DIRECT" : "PRIX"}
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            {price != null ? (
              <>
                <span className={up == null ? "" : up ? "text-hausse" : "text-baisse"}>
                  {up == null ? "" : up ? "▲ " : "▼ "}
                </span>
                {fmtPrice(price)}
              </>
            ) : (
              "…"
            )}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="h-full w-full" role="img" aria-label="Graphique en bougies" />

      {loading && (
        <div className="absolute inset-0 flex items-end gap-1 p-4" aria-label="Chargement du graphique...">
          {[55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48].map((h, i) => (
            <div key={i} className="skeleton flex-1 rounded" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-carte/95 p-6 text-center">
          <p className="text-base">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="min-h-[48px] rounded-xl border border-ligne bg-fond px-5 text-base font-semibold active:bg-ligne"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
