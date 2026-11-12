"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { apiCandles, ApiError } from "@/lib/api";
import { CANDLES_LIMIT } from "@/lib/config";
import { CHART, TRADER } from "@/lib/design";
import { type Interval } from "@/lib/symbols";
import type { ApiCandle } from "@/lib/types";
import { Btn } from "./ui";

const SKELETON_BARS = [55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48];

export interface ChartPriceLine {
  price: number;
  title: string;
  color: string;
}

interface Props {
  symbol: string;
  interval: Interval;
  /** Bougie en formation reçue en direct. */
  tickCandle: ApiCandle | null;
  /** Dernier prix connu : anime la dernière bougie (actions, sans flux temps réel). */
  livePrice: number | null;
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
export function PriceChart({ symbol, interval, tickCandle, livePrice, priceLines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const lastBarRef = useRef<ReturnType<typeof toBar> | null>(null);
  const pendingRef = useRef<ReturnType<typeof toBar>[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
          textColor: CHART.text,
          fontFamily: CHART.font,
          fontSize: CHART.fontSize,
        },
        grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: CHART.rightOffset },
        crosshair: {
          vertLine: { color: CHART.cross, labelBackgroundColor: CHART.crossLabel },
          horzLine: { color: CHART.cross, labelBackgroundColor: CHART.crossLabel },
        },
      });
      const series = chart.addCandlestickSeries({
        upColor: CHART.up,
        downColor: CHART.down,
        wickUpColor: CHART.up,
        wickDownColor: CHART.down,
        borderVisible: false,
      });
      chartRef.current = chart;
      seriesRef.current = series;
      if (pendingRef.current) {
        const data = pendingRef.current;
        pendingRef.current = null;
        series.setData(data);
        lastBarRef.current = data[data.length - 1] ?? null;
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - CHART.visible), to: data.length + CHART.overscroll });
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

    apiCandles(symbol, interval, CANDLES_LIMIT)
      .then(({ candles }) => {
        if (cancelled) return;
        const data = candles.map(toBar);
        if (seriesRef.current && chartRef.current) {
          seriesRef.current.setData(data);
          lastBarRef.current = data[data.length - 1] ?? null;
          chartRef.current
            .timeScale()
            .setVisibleLogicalRange({ from: Math.max(0, data.length - CHART.visible), to: data.length + CHART.overscroll });
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
      const bar = toBar(tickCandle);
      series.update(bar);
      lastBarRef.current = bar;
    } catch {
      /* tick ignoré */
    }
  }, [tickCandle]);

  // Dernier prix (actions) : fait bouger la clôture de la bougie en cours.
  useEffect(() => {
    const series = seriesRef.current;
    const last = lastBarRef.current;
    if (!series || !last || livePrice == null || !Number.isFinite(livePrice) || livePrice <= 0) {
      return;
    }
    // Ignore les prix aberrants (ne doivent jamais déformer le graphique).
    if (livePrice > last.close * CHART.spikeHi || livePrice < last.close * CHART.spikeLo) return;
    try {
      const bar = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
      };
      series.update(bar);
      lastBarRef.current = bar;
    } catch {
      /* tick ignoré */
    }
  }, [livePrice]);

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
        lineWidth: CHART.lineWidth,
        lineStyle: CHART.lineStyle,
        axisLabelVisible: true,
        title: pl.title,
      })
    );
  }, [priceLines]);

  return (
    <div className={TRADER.chartCard}>
      <div ref={containerRef} className={CHART.fill} role="img" aria-label="Graphique en bougies" />

      {loading && (
        <div className={CHART.load} aria-label="Chargement du graphique...">
          {SKELETON_BARS.map((h, i) => (
            <div key={i} className={CHART.bar} style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className={CHART.errBox}>
          <p className={CHART.errText}>{error}</p>
          <Btn variant="card" onClick={() => setReloadKey((k) => k + 1)}>
            Réessayer
          </Btn>
        </div>
      )}
    </div>
  );
}
