"use client";

import { useEffect, useRef, useState } from "react";
import { apiCandles, ApiError } from "@/lib/api";
import { CANDLES_LIMIT, CANDLES_REFRESH_MS, DOUBLE_TAP_MS } from "@/lib/config";
import { CHART, INK, TRADER } from "@/lib/design";
import { fmtHM24 } from "@/lib/format";
import { useLang } from "@/lib/lang-context";
import { useMoney } from "@/hooks/useMoney";
import { symbolDecimals, type Interval } from "@/lib/symbols";
import type { ApiCandle, ApiExactMoney } from "@/lib/types";
import { Btn } from "./ui";

const SKELETON_BARS = [55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48];
/** Images de l'anneau qui pulse autour du prix en direct. */
const PULSE_FRAMES = 12;

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
  /** Mise du trade en cours le plus proche (pastille sur la ligne du prix). */
  stake?: number | null;
  stakeExact?: ApiExactMoney | null;
}

/** Vue du graphique : largeur d'une bougie + bougies cachées à droite (0 = direct). */
interface View {
  step: number;
  scroll: number;
}

const DEFAULT_VIEW: View = { step: CHART.stepDef, scroll: 0 };

/** Vue ramenée dans les bornes (zoom 3-28 px, défilement dans l'historique). */
export function clampView(v: View, len: number, plotW: number): View {
  const step = Math.min(CHART.stepMax, Math.max(CHART.stepMin, v.step));
  const count = plotW > 0 ? plotW / step : len;
  const scroll = Math.min(Math.max(0, len - count), Math.max(0, v.scroll));
  return { step, scroll };
}

/** Animations réduites (système ou réglage « Réduire les animations »). */
function reduceMotion(): boolean {
  try {
    if (document.documentElement.classList.contains("calme")) return true;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Graphique maison en bougies (canvas) : grille, prix, ligne du prix en direct.
 * Comme les vrais graphiques de trading : glisser pour défiler dans
 * l'historique, molette/pincement pour zoomer, double-toucher pour revenir.
 */
export function CandleChart({ symbol, interval, tickCandle, livePrice, toast, stake, stakeExact }: Props) {
  const { t } = useLang();
  const { currency, money } = useMoney();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<ApiCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toastVis, setToastVis] = useState(false);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [phase, setPhase] = useState(0);
  const [, setPriceTick] = useState(0);

  // Chargement de l'historique des bougies. On garde les anciennes bougies
  // pendant le rechargement (pas de flash vide quand on touche « Réessayer ») ;
  // on n'efface que si le jeu ou l'unité change (sinon mélange de deux jeux).
  // Rechargé toutes les 15 s : sinon les nouvelles bougies n'apparaissent
  // jamais et le graphique se fige (la dernière bougie mutait sans fin).
  const seriesRef = useRef("");
  const drawnRef = useRef("");
  const priceRef = useRef<number | null>(null);
  const lenRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const series = `${symbol}|${interval}`;
    if (seriesRef.current !== series) {
      seriesRef.current = series;
      setCandles([]);
      setView(DEFAULT_VIEW); // nouveau jeu = retour au direct, zoom normal
      priceRef.current = null; // sinon le prix glisse depuis l'ancien jeu
      lenRef.current = 0;
      drawnRef.current = ""; // force le redessin (sinon l'ancien graphique reste)
    }
    setLoading(true);
    setError(null);

    const load = () => {
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
            err instanceof ApiError ? err.message : t("Graphique temporairement indisponible.")
          );
        });
    };
    load();
    const timer = setInterval(load, CANDLES_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, interval, reloadKey, t]);

  // Bougies affichées : TOUT l'historique (on s'y promène) + tick + dernier prix.
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
  // Cible du prix animé : le direct s'il est sain, sinon la dernière clôture.
  const lastHist = candles[candles.length - 1];
  const liveTarget =
    livePrice != null && Number.isFinite(livePrice) && livePrice > 0 && lastHist &&
    !(livePrice > lastHist.close * CHART.spikeHi || livePrice < lastHist.close * CHART.spikeLo)
      ? livePrice
      : null;

  // Miroirs pour le dessin et les gestes (le dessin ne lit que des refs).
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const stakeRef = useRef(stake ?? null);
  stakeRef.current = stake ?? null;
  const stakeExactRef = useRef(stakeExact ?? null);
  stakeExactRef.current = stakeExact ?? null;
  const viewRef = useRef(view);
  viewRef.current = view;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const liveTargetRef = useRef(liveTarget);
  liveTargetRef.current = liveTarget;
  const symRef = useRef(symbol);
  symRef.current = symbol;

  // Nouvelles bougies pendant qu'on regarde le passé : la vue reste clouée
  // aux mêmes bougies (sinon l'historique glisse sous les doigts tout seul).
  useEffect(() => {
    const prev = lenRef.current;
    lenRef.current = shown.length;
    if (prev > 0 && shown.length > prev) {
      const grown = shown.length - prev;
      setView((v) => (v.scroll > 0 ? { ...v, scroll: v.scroll + grown } : v));
    }
  }, [shown.length]);

  // Point vivant : pulse 12 images en boucle (figé si réduit/onglet caché).
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden || reduceMotion()) return;
      setPhase((p) => (p + 1) % PULSE_FRAMES);
    }, CHART.pulseMs);
    return () => clearInterval(t);
  }, []);

  // Le prix affiché glisse vers le direct (350 ms) au lieu de sauter :
  // la ligne, la pastille et la bougie en formation bougent toutes seules.
  useEffect(() => {
    if (liveTarget == null) return;
    if (priceRef.current == null || reduceMotion()) {
      if (priceRef.current !== liveTarget) {
        priceRef.current = liveTarget;
        setPriceTick((t) => t + 1);
      }
      return;
    }
    let raf = 0;
    const from = priceRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / CHART.tweenMs);
      const e = 1 - (1 - k) * (1 - k);
      priceRef.current = from + (liveTarget - from) * e;
      setPriceTick((t) => t + 1);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [liveTarget]);

  const draw = () => {
    const box = boxRef.current;
    const cv = canvasRef.current;
    if (!box || !cv) return;
    const data = shownRef.current;
    if (data.length === 0) return;
    const len = data.length;
    const r = box.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    if (W <= 0 || H <= 0) return;
    const pw = CHART.axisW;
    const ph = CHART.axisBottom;
    const plotW = Math.max(1, W - pw);

    // Fenêtre visible (indices à virgule : les bougies des bords sont coupées).
    const v = clampView(viewRef.current, len, plotW);
    const step = v.step;
    const count = plotW / step;
    const end = len - v.scroll;
    const start = end - count;
    const i0 = Math.max(0, Math.floor(start));
    const i1 = Math.min(len, Math.ceil(end));
    if (i1 <= i0) return;
    const x = (i: number) => (i - start) * step + step / 2;

    const stakeShown = stakeRef.current;
    const tip = data[len - 1];
    const target = liveTargetRef.current;
    const disp = target == null ? tip.close : (priceRef.current ?? tip.close);
    const sig = [
      len,
      step.toFixed(2),
      v.scroll.toFixed(2),
      tip.time,
      disp.toFixed(5),
      stakeShown == null ? "-" : stakeShown,
      stakeExactRef.current?.numerator ?? "-",
      stakeExactRef.current?.denominator ?? "-",
      currency,
      phaseRef.current,
      W,
      H,
    ].join("|");
    // Rien de neuf (taille, vue, prix, devise, pulse) : on ne touche pas
    // au canvas, sinon la page rame et le graphique scintille.
    if (sig === drawnRef.current) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    drawnRef.current = sig;

    const d = window.devicePixelRatio || 1;
    // Changer width/height efface tout : seulement si la taille a bougé.
    // Sinon on efface à la main (sans cela, chaque redessin se superpose
    // au précédent : pastilles et lignes fantômes partout).
    const w = Math.max(1, Math.round(W * d));
    const h = Math.max(1, Math.round(H * d));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const up = INK.hausse;
    const dn = INK.chartDown;
    const ln = INK.ligne;
    const mu = INK.doux;

    // Échelle sur les bougies VISIBLES (comme les vrais graphiques : en
    // zoomant, les détails du passé s'agrandissent au lieu de s'écraser).
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = i0; i < i1; i++) {
      const k = data[i];
      hi = Math.max(hi, k.high);
      lo = Math.min(lo, k.low);
    }
    // Au direct, le prix animé reste dans l'échelle (sinon la ligne sort).
    const liveX = x(len - 1);
    const liveVisible = liveX >= 0 && liveX <= plotW;
    if (liveVisible) {
      hi = Math.max(hi, disp);
      lo = Math.min(lo, disp);
    }
    const pad = (hi - lo) * CHART.rangePad;
    hi += pad;
    lo -= pad;
    if (!(hi > lo)) {
      hi = lo + 1;
    }
    const plotB = H - ph - CHART.padBottom;
    const y = (val: number) => CHART.padTop + ((hi - val) / (hi - lo)) * (plotB - CHART.padTop);

    // Grille + prix à droite (décimales du jeu : Lucky 7 en a 3).
    const dec = symbolDecimals(symRef.current);
    ctx.font = CHART.font;
    ctx.textAlign = "left";
    ctx.fillStyle = mu;
    ctx.strokeStyle = ln;
    ctx.lineWidth = 1;
    for (let g = 0; g < CHART.gridLines; g++) {
      const val = hi - ((hi - lo) * g) / (CHART.gridLines - 1);
      const yy = y(val);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(W - pw, yy);
      ctx.stroke();
      ctx.fillText(val.toFixed(dec), W - pw + 6, yy + 3);
    }

    // Bougies (la mèche s'épaissit quand on zoome).
    ctx.lineWidth = step > 16 ? 2 : 1;
    const bodyW = Math.max(1, step * 0.7);
    for (let i = i0; i < i1; i++) {
      const k = data[i];
      // La bougie en formation suit le prix ANIMÉ (elle grandit en douceur).
      const close = i === len - 1 ? disp : k.close;
      const high = i === len - 1 ? Math.max(k.high, disp) : k.high;
      const low = i === len - 1 ? Math.min(k.low, disp) : k.low;
      const cx = x(i);
      const col = close >= k.open ? up : dn;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, y(high));
      ctx.lineTo(cx, y(low));
      ctx.stroke();
      const t = y(Math.max(k.open, close));
      const bh = Math.max(1, Math.abs(y(k.open) - y(close)));
      ctx.fillRect(cx - bodyW / 2, t, bodyW, bh);
    }

    // Prix actuel façon Quotex : ligne blanche pointillée, pastille grise
    // de la mise (si trade en cours), pastille bleue du prix.
    const rrect = (rx: number, ry: number, rw: number, rh: number, rr: number) => {
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      ctx.arcTo(rx, ry + rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx + rw, ry, rr);
      ctx.closePath();
    };
    const cy = y(disp);
    ctx.setLineDash([...CHART.dash]);
    ctx.strokeStyle = INK.texte;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W - pw, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Loin du direct, la pastille reste visible (collée au bord).
    const pillCy = Math.min(Math.max(cy, CHART.padTop + 9), plotB - 9);
    ctx.font = CHART.fontBold;
    ctx.textAlign = "center";
    const pillX = W - pw + 2;
    const pillW = pw - 4;
    const pillH = 18;
    if (stakeShown != null) {
      const txt = money(stakeShown, stakeExactRef.current);
      const cw2 = ctx.measureText(txt).width + 12;
      const cx = pillX - 4 - cw2;
      if (cx >= 0) {
        rrect(cx, pillCy - pillH / 2, cw2, pillH, 4);
        ctx.fillStyle = INK.countBg;
        ctx.fill();
        ctx.fillStyle = INK.texte;
        ctx.fillText(txt, cx + cw2 / 2, pillCy + 3.5);
      }
    }
    rrect(pillX, pillCy - pillH / 2, pillW, pillH, 4);
    ctx.fillStyle = INK.pill;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(disp.toFixed(dec), pillX + pillW / 2, pillCy + 3.5);
    ctx.textAlign = "left";

    // Point vivant sur la bougie en formation (+ anneau qui s'étend).
    if (liveVisible && cy >= CHART.padTop && cy <= plotB) {
      const col = disp >= tip.open ? up : dn;
      const frac = phaseRef.current / (PULSE_FRAMES - 1);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(liveX, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (1 - frac) * 0.7;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(liveX, cy, 3 + frac * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Heures en bas + petites graduations (sur les bougies visibles).
    const span = i1 - 1 - i0;
    const labelCount = Math.min(CHART.timeLabels, i1 - i0);
    const plotBottom = y(lo);
    ctx.font = CHART.font;
    ctx.fillStyle = mu;
    ctx.strokeStyle = ln;
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    ctx.beginPath();
    for (let i = 0; i < labelCount; i++) {
      const idx = labelCount === 1 ? i1 - 1 : Math.round(i0 + (span * i) / (labelCount - 1));
      const lx = Math.min(Math.max(x(idx), CHART.timeEdge), W - pw - CHART.timeEdge);
      ctx.moveTo(lx, plotBottom);
      ctx.lineTo(lx, plotBottom + CHART.tickLen);
      ctx.fillText(fmtHM24(data[idx].time), lx, H - CHART.timePad);
    }
    ctx.stroke();
    ctx.textAlign = "left";
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Chaque rendu redessine si besoin (la signature évite le travail inutile).
  useEffect(() => {
    drawRef.current();
  });

  // Redessin au redimensionnement.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Gestes : glisser = défiler, molette/pincement = zoomer, double = direct.
  useEffect(() => {
    const box = boxRef.current;
    const cv = canvasRef.current;
    if (!box || !cv) return;
    const plotW = () => Math.max(1, box.clientWidth - CHART.axisW);
    const pending = { current: null as View | null };
    let raf = 0;
    const applyView = (v: View) => {
      pending.current = v;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = pending.current;
        pending.current = null;
        if (p) setView(clampView(p, shownRef.current.length, plotW()));
      });
    };
    // Zoom en gardant la bougie sous le curseur fixe (pas de saut).
    const zoomAt = (cx: number, factor: number, base?: View) => {
      const len = shownRef.current.length;
      if (len === 0) return;
      const v = base ?? viewRef.current;
      const step1 = Math.min(CHART.stepMax, Math.max(CHART.stepMin, v.step * factor));
      if (step1 === v.step) return;
      const w = plotW();
      const px = Math.min(Math.max(cx, 0), w);
      const anchor = len - v.scroll - w / v.step + px / v.step;
      const scroll1 = len - w / step1 - (anchor - px / step1);
      applyView({ step: step1, scroll: scroll1 });
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let panAnchor: { x: number; scroll: number } | null = null;
    let pinchAnchor: { dist: number; step: number; scroll: number; midX: number } | null = null;
    let downX = 0;
    let downY = 0;
    let moved = false;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const onDown = (e: PointerEvent) => {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* capture indisponible : les gestes marchent quand même */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        panAnchor = { x: e.clientX, scroll: viewRef.current.scroll };
        pinchAnchor = null;
        downX = e.clientX;
        downY = e.clientY;
        moved = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const r = cv.getBoundingClientRect();
        const v = viewRef.current;
        pinchAnchor = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          step: v.step,
          scroll: v.scroll,
          midX: (a.x + b.x) / 2 - r.left,
        };
        panAnchor = null;
        moved = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && panAnchor) {
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > CHART.tapSlop) {
          moved = true;
        }
        if (moved) {
          const v = viewRef.current;
          applyView({ step: v.step, scroll: panAnchor.scroll + (e.clientX - panAnchor.x) / v.step });
        }
      } else if (pointers.size === 2 && pinchAnchor) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > 0 && pinchAnchor.dist > 0) {
          // Depuis l'ancre d'origine (pas en cascade : sinon ça dérive).
          zoomAt(pinchAnchor.midX, dist / pinchAnchor.dist, {
            step: pinchAnchor.step,
            scroll: pinchAnchor.scroll,
          });
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        // Un doigt se lève en plein pincement : on ré-ancre le glisser
        // sur le doigt restant (sinon la vue saute).
        const [p] = [...pointers.values()];
        panAnchor = { x: p.x, scroll: viewRef.current.scroll };
        pinchAnchor = null;
        moved = true;
      } else if (pointers.size === 0) {
        panAnchor = null;
        pinchAnchor = null;
        if (!moved) {
          // Double-toucher rapide au même endroit = retour au direct.
          const now = Date.now();
          const near =
            Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < CHART.tapSlop;
          if (now - lastTapAt < DOUBLE_TAP_MS && near) {
            lastTapAt = 0;
            setView(DEFAULT_VIEW);
          } else {
            lastTapAt = now;
            lastTapX = e.clientX;
            lastTapY = e.clientY;
          }
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        zoomAt(e.clientX - r.left, Math.exp(-e.deltaY * 0.0015));
      } else {
        // Pavé tactile : défilement horizontal = on se promène.
        const v = viewRef.current;
        applyView({ step: v.step, scroll: v.scroll + e.deltaX / v.step });
      }
    };
    const onDouble = () => setView(DEFAULT_VIEW);

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDouble);
    return () => {
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("dblclick", onDouble);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
    <div
      ref={boxRef}
      className={TRADER.chartCard}
      role="img"
      aria-label={t("Graphique en bougies. Glisser pour défiler, pincer ou molette pour zoomer, double-toucher pour revenir au direct.")}
    >
      <canvas ref={canvasRef} className={CHART.canvas} />

      {/* Loin du direct : retour en un toucher (le zoom est gardé). */}
      {view.scroll > 0.5 && (
        <button type="button" onClick={() => setView((v) => ({ ...v, scroll: 0 }))} className={CHART.liveBtn}>
          {t("Direct ▸")}
        </button>
      )}

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

      {loading && shown.length === 0 && (
        <div className={CHART.load} aria-label={t("Chargement du graphique...")}>
          {SKELETON_BARS.map((h, i) => (
            <div key={i} className={CHART.bar} style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {error && !loading && shown.length === 0 && (
        <div className={CHART.errBox}>
          <p className={CHART.errText}>{error}</p>
          <Btn variant="card" onClick={() => setReloadKey((k) => k + 1)}>
            {t("Réessayer")}
          </Btn>
        </div>
      )}
    </div>
  );
}
