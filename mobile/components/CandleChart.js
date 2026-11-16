// Graphique maison en bougies (SVG + gestes) : miroir exact de components/CandleChart.tsx.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { apiCandles, ApiError } from '../api';
import { money } from '../money';
import { CHART_CFG, CONFIG, INK, fmtHM24, symbolDecimals } from '../theme';
import { Btn } from './Ui';

const SKELETON_BARS = [55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48];
const PULSE_FRAMES = 12;
const DEFAULT_VIEW = { step: CHART_CFG.stepDef, scroll: 0 };

function clampView(v, len, plotW) {
  const step = Math.min(CHART_CFG.stepMax, Math.max(CHART_CFG.stepMin, v.step));
  const count = plotW > 0 ? plotW / step : len;
  const scroll = Math.min(Math.max(0, len - count), Math.max(0, v.scroll));
  return { step, scroll };
}

export function CandleChart({
  symbol,
  interval = CONFIG.DEFAULT_INTERVAL,
  livePrice,
  toast,
  stake = null,
  stakeExact = null,
  currency = 'USD',
  lang = 'fr',
  calm = false,
  t,
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [phase, setPhase] = useState(0);
  const [dispPrice, setDispPrice] = useState(null);

  const seriesRef = useRef('');
  const priceRef = useRef(null);
  const lenRef = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const boxRef = useRef(box);
  boxRef.current = box;

  // Charge l'historique des bougies + rafraîchissement toutes les 15 s.
  useEffect(() => {
    let cancelled = false;
    const series = `${symbol}|${interval}`;
    if (seriesRef.current !== series) {
      seriesRef.current = series;
      setCandles([]);
      setView(DEFAULT_VIEW);
      priceRef.current = null;
      setDispPrice(null);
      lenRef.current = 0;
    }
    setLoading(true);
    setError(null);

    const load = () => {
      apiCandles(symbol, interval, CONFIG.CANDLES_LIMIT)
        .then((res) => {
          if (cancelled) return;
          setCandles((res && res.candles) || []);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setLoading(false);
          setError(err instanceof ApiError ? err.message : t('Graphique temporairement indisponible.'));
        });
    };

    load();
    const timer = setInterval(load, CONFIG.CANDLES_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, interval, reloadKey, t]);

  // Bougies affichées + dernier prix en direct (garde-fou anti-pic).
  const { shown, liveTarget } = useMemo(() => {
    let list = candles;
    let target = null;
    if (livePrice != null && Number.isFinite(livePrice) && livePrice > 0 && list.length > 0) {
      const last = list[list.length - 1];
      if (!(livePrice > last.close * CHART_CFG.spikeHi || livePrice < last.close * CHART_CFG.spikeLo)) {
        target = livePrice;
        list = [
          ...list.slice(0, -1),
          {
            ...last,
            high: Math.max(last.high, livePrice),
            low: Math.min(last.low, livePrice),
            close: livePrice,
          },
        ];
      }
    }
    return { shown: list, liveTarget: target };
  }, [candles, livePrice]);

  const shownLenRef = useRef(shown.length);
  shownLenRef.current = shown.length;

  // Garde la vue fixe dans l'historique si de nouvelles bougies arrivent.
  useEffect(() => {
    const prev = lenRef.current;
    lenRef.current = shown.length;
    if (prev > 0 && shown.length > prev) {
      const grown = shown.length - prev;
      setView((v) => (v.scroll > 0 ? { ...v, scroll: v.scroll + grown } : v));
    }
  }, [shown.length]);

  // Point vivant qui pulse (figé en mode calme).
  useEffect(() => {
    if (calm) return;
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % PULSE_FRAMES);
    }, CHART_CFG.pulseMs);
    return () => clearInterval(timer);
  }, [calm]);

  // Transition douce du prix (350 ms) sauf mode calme.
  useEffect(() => {
    if (liveTarget == null) return;
    if (priceRef.current == null || calm) {
      priceRef.current = liveTarget;
      setDispPrice(liveTarget);
      return;
    }
    const from = priceRef.current;
    const t0 = Date.now();
    let timer = null;
    const stepAnim = () => {
      const k = Math.min(1, (Date.now() - t0) / CHART_CFG.tweenMs);
      const e = 1 - (1 - k) * (1 - k);
      const next = from + (liveTarget - from) * e;
      priceRef.current = next;
      setDispPrice(next);
      if (k < 1) timer = setTimeout(stepAnim, 32);
    };
    stepAnim();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [liveTarget, calm]);

  // Gestes : glisser = défiler, pincer = zoomer, double-toucher = retour au direct.
  const gestureRef = useRef({
    panStartX: 0,
    panStartScroll: 0,
    pinch: null,
    moved: false,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches || [];
          const g = gestureRef.current;
          if (touches.length >= 2) {
            const [a, b] = touches;
            const v = viewRef.current;
            g.pinch = {
              dist: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
              step: v.step,
              scroll: v.scroll,
              midX: (a.locationX + b.locationX) / 2,
            };
            g.moved = true;
          } else {
            g.panStartX = evt.nativeEvent.pageX;
            g.panStartScroll = viewRef.current.scroll;
            g.pinch = null;
            g.moved = false;
          }
        },
        onPanResponderMove: (evt, gs) => {
          const touches = evt.nativeEvent.touches || [];
          const g = gestureRef.current;
          const len = shownLenRef.current;
          const plotW = Math.max(1, (boxRef.current.width || 340) - CHART_CFG.axisW);
          if (len === 0) return;

          if (touches.length >= 2) {
            const [a, b] = touches;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!g.pinch) {
              const v = viewRef.current;
              g.pinch = {
                dist: dist || 1,
                step: v.step,
                scroll: v.scroll,
                midX: (a.locationX + b.locationX) / 2,
              };
            }
            if (dist > 0 && g.pinch.dist > 0) {
              const factor = dist / g.pinch.dist;
              const step1 = Math.min(CHART_CFG.stepMax, Math.max(CHART_CFG.stepMin, g.pinch.step * factor));
              const px = Math.min(Math.max(g.pinch.midX, 0), plotW);
              const anchor = len - g.pinch.scroll - plotW / g.pinch.step + px / g.pinch.step;
              const scroll1 = len - plotW / step1 - (anchor - px / step1);
              setView(clampView({ step: step1, scroll: scroll1 }, len, plotW));
              g.moved = true;
            }
            return;
          }

          if (g.pinch) {
            g.pinch = null;
            g.panStartX = evt.nativeEvent.pageX;
            g.panStartScroll = viewRef.current.scroll;
            return;
          }

          if (Math.abs(gs.dx) + Math.abs(gs.dy) > CHART_CFG.tapSlop) {
            g.moved = true;
          }
          if (g.moved) {
            const v = viewRef.current;
            const dx = evt.nativeEvent.pageX - g.panStartX;
            setView(clampView({ step: v.step, scroll: g.panStartScroll + dx / v.step }, len, plotW));
          }
        },
        onPanResponderRelease: (evt) => {
          const g = gestureRef.current;
          g.pinch = null;
          if (!g.moved) {
            const now = Date.now();
            const px = evt.nativeEvent.pageX;
            const py = evt.nativeEvent.pageY;
            const near = Math.hypot(px - g.lastTapX, py - g.lastTapY) < CHART_CFG.tapSlop;
            if (now - g.lastTapAt < CONFIG.DOUBLE_TAP_MS && near) {
              g.lastTapAt = 0;
              setView(DEFAULT_VIEW);
            } else {
              g.lastTapAt = now;
              g.lastTapX = px;
              g.lastTapY = py;
            }
          }
        },
      }),
    []
  );

  // Calcul des géométries SVG
  const W = box.width || 340;
  const H = box.height || 220;
  const pw = CHART_CFG.axisW;
  const ph = CHART_CFG.axisBottom;
  const plotW = Math.max(1, W - pw);
  const plotB = Math.max(CHART_CFG.padTop + 20, H - ph - CHART_CFG.padBottom);
  const len = shown.length;
  const dec = symbolDecimals(symbol);

  let chartSvg = null;
  if (len > 0 && W > 0 && H > 0) {
    const v = clampView(view, len, plotW);
    const step = v.step;
    const count = plotW / step;
    const end = len - v.scroll;
    const start = end - count;
    const i0 = Math.max(0, Math.floor(start));
    const i1 = Math.min(len, Math.ceil(end));
    const xPos = (i) => (i - start) * step + step / 2;

    const tip = shown[len - 1];
    const disp = liveTarget == null ? tip.close : (dispPrice ?? tip.close);

    let hi = -Infinity;
    let lo = Infinity;
    for (let i = i0; i < i1; i++) {
      const k = shown[i];
      if (k.high > hi) hi = k.high;
      if (k.low < lo) lo = k.low;
    }
    const liveX = xPos(len - 1);
    const liveVisible = liveX >= 0 && liveX <= plotW;
    if (liveVisible) {
      hi = Math.max(hi, disp);
      lo = Math.min(lo, disp);
    }
    const pad = (hi - lo) * CHART_CFG.rangePad;
    hi += pad;
    lo -= pad;
    if (!(hi > lo)) hi = lo + 1;

    const yPos = (val) => CHART_CFG.padTop + ((hi - val) / (hi - lo)) * (plotB - CHART_CFG.padTop);
    const bodyW = Math.max(1, step * 0.7);
    const wickW = step > 16 ? 2 : 1;

    // Grille + prix à droite
    const gridRows = [];
    for (let g = 0; g < CHART_CFG.gridLines; g++) {
      const val = hi - ((hi - lo) * g) / (CHART_CFG.gridLines - 1);
      gridRows.push({ yy: yPos(val), label: val.toFixed(dec) });
    }

    // Bougies visibles
    const bars = [];
    for (let i = i0; i < i1; i++) {
      const k = shown[i];
      const close = i === len - 1 ? disp : k.close;
      const high = i === len - 1 ? Math.max(k.high, disp) : k.high;
      const low = i === len - 1 ? Math.min(k.low, disp) : k.low;
      const cx = xPos(i);
      const col = close >= k.open ? INK.hausse : INK.chartDown;
      const yOpen = yPos(k.open);
      const yClose = yPos(close);
      bars.push({
        key: k.time,
        cx,
        col,
        yHi: yPos(high),
        yLo: yPos(low),
        yTop: Math.min(yOpen, yClose),
        bh: Math.max(1, Math.abs(yOpen - yClose)),
      });
    }

    // Ligne du prix en direct + pastilles
    const cy = yPos(disp);
    const pillCy = Math.min(Math.max(cy, CHART_CFG.padTop + 9), plotB - 9);
    const pillX = W - pw + 2;
    const pillW = pw - 4;
    const pillH = 18;
    const stakeText = stake != null ? money(stake, stakeExact, currency, lang) : null;
    const stakeW = stakeText ? Math.max(36, stakeText.length * 6.2 + 12) : 0;
    const stakeX = pillX - 4 - stakeW;

    // Heures en bas
    const span = Math.max(0, i1 - 1 - i0);
    const labelCount = Math.min(CHART_CFG.timeLabels, Math.max(0, i1 - i0));
    const plotBottom = yPos(lo);
    const timeTicks = [];
    for (let i = 0; i < labelCount; i++) {
      const idx = labelCount === 1 ? i1 - 1 : Math.round(i0 + (span * i) / (labelCount - 1));
      const lx = Math.min(Math.max(xPos(idx), CHART_CFG.timeEdge), W - pw - CHART_CFG.timeEdge);
      timeTicks.push({ key: i, lx, label: fmtHM24(shown[idx].time) });
    }

    const pulseFrac = phase / (PULSE_FRAMES - 1);
    const liveCol = disp >= tip.open ? INK.hausse : INK.chartDown;

    chartSvg = (
      <Svg width={W} height={H}>
        <Defs>
          <ClipPath id="plotClip">
            <Rect x={0} y={0} width={plotW} height={plotB + 4} />
          </ClipPath>
        </Defs>

        {/* Grille horizontale + prix sur l'axe droit */}
        {gridRows.map((row, idx) => (
          <React.Fragment key={idx}>
            <Line x1={0} x2={plotW} y1={row.yy} y2={row.yy} stroke={INK.ligne} strokeWidth={1} />
            <SvgText x={W - pw + 5} y={row.yy + 3.5} fill={INK.doux} fontSize={10}>
              {row.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Bougies (clippées à la zone du graphique) */}
        <G clipPath="url(#plotClip)">
          {bars.map((b) => (
            <React.Fragment key={b.key}>
              <Line x1={b.cx} x2={b.cx} y1={b.yHi} y2={b.yLo} stroke={b.col} strokeWidth={wickW} />
              <Rect x={b.cx - bodyW / 2} y={b.yTop} width={bodyW} height={b.bh} fill={b.col} />
            </React.Fragment>
          ))}
        </G>

        {/* Ligne pointillée blanche du prix actuel */}
        <Line
          x1={0}
          x2={plotW}
          y1={cy}
          y2={cy}
          stroke={INK.texte}
          strokeWidth={1}
          strokeDasharray="3,3"
        />

        {/* Pastille grise de la mise en cours */}
        {stakeText && stakeX >= 0 ? (
          <>
            <Rect x={stakeX} y={pillCy - pillH / 2} width={stakeW} height={pillH} rx={4} fill={INK.countBg} />
            <SvgText
              x={stakeX + stakeW / 2}
              y={pillCy + 3.5}
              textAnchor="middle"
              fill={INK.texte}
              fontSize={10}
              fontWeight="700"
            >
              {stakeText}
            </SvgText>
          </>
        ) : null}

        {/* Pastille bleue du prix en direct */}
        <Rect x={pillX} y={pillCy - pillH / 2} width={pillW} height={pillH} rx={4} fill={INK.pill} />
        <SvgText
          x={pillX + pillW / 2}
          y={pillCy + 3.5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={10}
          fontWeight="700"
        >
          {disp.toFixed(dec)}
        </SvgText>

        {/* Point vivant + anneau qui pulse */}
        {liveVisible && cy >= CHART_CFG.padTop && cy <= plotB ? (
          <>
            <Circle cx={liveX} cy={cy} r={3} fill={liveCol} />
            <Circle
              cx={liveX}
              cy={cy}
              r={3 + pulseFrac * 9}
              fill="none"
              stroke={liveCol}
              strokeWidth={1.5}
              strokeOpacity={(1 - pulseFrac) * 0.7}
            />
          </>
        ) : null}

        {/* Heures + graduations sur l'axe du bas */}
        {timeTicks.map((tk) => (
          <React.Fragment key={tk.key}>
            <Line
              x1={tk.lx}
              x2={tk.lx}
              y1={plotBottom}
              y2={plotBottom + CHART_CFG.tickLen}
              stroke={INK.ligne}
              strokeWidth={1}
            />
            <SvgText
              x={tk.lx}
              y={H - CHART_CFG.timePad}
              textAnchor="middle"
              fill={INK.doux}
              fontSize={10}
            >
              {tk.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    );
  }

  return (
    <View
      style={styles.card}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== box.width || height !== box.height)) {
          setBox({ width, height });
        }
      }}
      {...panResponder.panHandlers}
    >
      {chartSvg}

      {/* Bouton retour au direct quand on a fait défiler l'historique */}
      {view.scroll > 0.5 ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setView((v) => ({ ...v, scroll: 0 }))}
          style={styles.liveBtn}
        >
          <Text style={styles.liveBtnText}>{t('Direct ▸')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Toast flottant en haut du graphique (mise, gain, perte) */}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text
              style={[
                styles.toastText,
                toast.tone === 'win'
                  ? styles.toastWin
                  : toast.tone === 'loss'
                    ? styles.toastLoss
                    : null,
              ]}
            >
              {toast.msg}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Squelette de chargement */}
      {loading && shown.length === 0 ? (
        <View style={styles.loadOverlay} pointerEvents="none">
          {SKELETON_BARS.map((pct, i) => (
            <View key={i} style={[styles.skelBar, { height: `${pct}%` }]} />
          ))}
        </View>
      ) : null}

      {/* Erreur de chargement */}
      {error && !loading && shown.length === 0 ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{error}</Text>
          <Btn variant="card" onPress={() => setReloadKey((k) => k + 1)}>
            {t('Réessayer')}
          </Btn>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: INK.fond,
  },
  liveBtn: {
    position: 'absolute',
    bottom: 24,
    right: 8,
    zIndex: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.puce,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK.texte,
  },
  toastWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
  },
  toast: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.puce,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK.texte,
  },
  toastWin: {
    color: INK.hausse,
  },
  toastLoss: {
    color: INK.baisse,
  },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    padding: 16,
  },
  skelBar: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#283044',
  },
  errBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(42,48,64,0.95)',
    padding: 24,
  },
  errText: {
    fontSize: 15,
    color: INK.texte,
    textAlign: 'center',
  },
});
