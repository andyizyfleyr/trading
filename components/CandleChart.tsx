"use client";

import { useEffect, useRef, useState } from "react";
import { apiCandles, ApiError } from "@/lib/api";
import { CANDLES_LIMIT } from "@/lib/config";
import { CHART, INK, TRADER } from "@/lib/design";
import { type Interval } from "@/lib/symbols";
import type { ApiCandle } from "@/lib/types";
import { Btn } from "./ui";

const SKELETON_BARS = [55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48];

/** Message bref affiché sur le graphique (mise, gain, perte). */
export interface ChartToast {
  id: number;
  msg: string;
  tone: "win" | "loss" | null;
}

interface Props {
  symbol: string;
  interval: Interval;
  /** Bougie en formation reçue en direct. */
  tickCandle: ApiCandle | null;
  /** Dernier prix connu : anime la clôture de la bougie en cours. */
  livePrice: number | null;
  toast: ChartToast | null;
}

/** Graphique maison en bougies (canvas) : grille, prix, ligne du prix en direct. */
export function CandleChart({ symbol, interval, tickCandle, livePrice, toast }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<ApiCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toastVis, setToastVis] = useState(false);

  // Chargement de l'historique des bougies.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCandles([]);

    apiCandles(symbol, interval, CANDLES_LIMIT)
      .then(({ candles: list }) => {
        if (cancelled) return;
        setCandles(list);
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

  // Bougies affichées : historique + tick en direct + dernier prix.
  let shown = candles;
  if (tickCandle) {
    const last = shown[shown.length - 1];
    if (!last || tickCandle.time > last.time) shown = [...shown, tickCandle];
    else if (tickCandle.time === last.time) shown = [...shown.slice(0, -1), tickCandle];
    // Ticks antérieurs ignorés.
  }
  if (livePrice != null && Number.isFinite(livePrice) && livePrice > 0 && shown.length > 0) {
    const last = shown[shown.length - 1];
    // Prix aberrants ignorés (ne déforment jamais le graphique).
    if (!(livePrice > last.close * CHART.spikeHi || livePrice < last.close * CHART.spikeLo)) {
      shown = [
        ...shown.slice(0, -1),
        {
          ...last,
          high: Math.max(last.high, livePrice),
          low: Math.min(last.low, livePrice),
          close: livePrice,
        },
      ];
    }
  }
  shown = shown.slice(-CHART.visible);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // Dessin + redessin au redimensionnement.
  useEffect(() => {
    const box = boxRef.current;
    const cv = canvasRef.current;

    const draw = () => {
      if (!box || !cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const r = box.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * d));
      cv.height = Math.max(1, Math.round(r.height * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const W = r.width;
      const H = r.height;
      const pw = CHART.axisW;
      const ph = CHART.axisBottom;
      const up = INK.hausse;
      const dn = INK.chartDown;
      const ln = INK.ligne;
      const mu = INK.doux;

      const data = shownRef.current;
      if (data.length === 0) return;
      let hi = -Infinity;
      let lo = Infinity;
      for (const k of data) {
        hi = Math.max(hi, k.high);
        lo = Math.min(lo, k.low);
      }
      const pad = (hi - lo) * CHART.rangePad;
      hi += pad;
      lo -= pad;
      if (!(hi > lo)) {
        hi = lo + 1;
      }
      const y = (v: number) =>
        CHART.padTop + ((hi - v) / (hi - lo)) * (H - ph - CHART.padBottom);

      // Grille + prix à droite.
      ctx.font = CHART.font;
      ctx.textAlign = "left";
      ctx.fillStyle = mu;
      ctx.strokeStyle = ln;
      ctx.lineWidth = 1;
      for (let g = 0; g < CHART.gridLines; g++) {
        const v = hi - ((hi - lo) * g) / (CHART.gridLines - 1);
        const yy = y(v);
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W - pw, yy);
        ctx.stroke();
        ctx.fillText(v.toFixed(2), W - pw + 6, yy + 3);
      }

      // Bougies.
      const cw = (W - pw) / data.length;
      data.forEach((k, i) => {
        const x = i * cw + cw / 2;
        const col = k.close >= k.open ? up : dn;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y(k.high));
        ctx.lineTo(x, y(k.low));
        ctx.stroke();
        const t = y(Math.max(k.open, k.close));
        const bh = Math.max(1, Math.abs(y(k.open) - y(k.close)));
        ctx.fillRect(x - cw * 0.35, t, cw * 0.7, bh);
      });

      // Prix actuel : ligne pointillée + étiquette.
      const last = data[data.length - 1].close;
      const cy = y(last);
      ctx.setLineDash([...CHART.dash]);
      ctx.strokeStyle = up;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(W - pw, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = up;
      ctx.fillRect(W - pw + 2, cy - 8, pw - 4, 16);
      ctx.fillStyle = INK.vertfonce;
      ctx.font = CHART.fontBold;
      ctx.fillText(last.toFixed(2), W - pw + 7, cy + 3.5);
    };

    draw();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(draw);
    if (box) ro.observe(box);
    return () => ro.disconnect();
  }, [shown]);

  // Le message glisse depuis le haut à chaque nouveau message.
  useEffect(() => {
    setToastVis(false);
    if (!toast) return;
    const r1 = requestAnimationFrame(() =>
      requestAnimationFrame(() => setToastVis(true))
    );
    return () => cancelAnimationFrame(r1);
  }, [toast]);

  return (
    <div ref={boxRef} className={TRADER.chartCard} role="img" aria-label="Graphique en bougies">
      <canvas ref={canvasRef} className={CHART.canvas} />

      {toast != null && (
        <div
          key={toast.id}
          role="status"
          className={`${TRADER.toast} ${toastVis ? TRADER.toastShow : TRADER.toastHide} ${
            toast.tone === "win" ? TRADER.toastWin : toast.tone === "loss" ? TRADER.toastLoss : ""
          }`}
        >
          {toast.msg}
        </div>
      )}

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
