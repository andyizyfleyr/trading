// Graphique maison en bougies (SVG + gestes) : miroir exact de components/CandleChart.tsx.
// Optimisé mobile : bougies regroupées en 2 <Path>, anneau animé natif (GPU), gestes cadencés par rAF.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { apiCandles, ApiError } from '../api';
import { money } from '../money';
import { CHART_CFG, CONFIG, INK, fmtHM24, symbolDecimals } from '../theme';
import { Btn } from './Ui';

const SKELETON_BARS = [55, 70, 45, 80, 60, 75, 50, 65, 72, 58, 66, 48];
const DEFAULT_VIEW = { step: CHART_CFG.stepDef, scroll: 0 };

function clampView(v, len, plotW) {
  const step = Math.min(CHART_CFG.stepMax, Math.max(CHART_CFG.stepMin, v.step));
  const count = plotW > 0 ? plotW / step : len;
  const scroll = Math.min(Math.max(0, len - count), Math.max(0, v.scroll));
  return { step, scroll };
}

/** Anneau vivant animé 100 % sur le thread natif (0 re-render JS). */
const LivePulseRing = React.memo(function LivePulseRing({ x, y, color, calm, isActive }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (calm || !isActive) {
      progress.setValue(0);
      return undefined;
    }
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [calm, isActive, progress]);

  if (calm || !isActive) return null;

  const scale = progress.interpolate ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) : 1;
  const opacity = progress.interpolate ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }) : 0.4;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          left: x - 12,
          top: y - 12,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
});

export const CandleChart = React.memo(function CandleChart({
  symbol,
  interval = CONFIG.DEFAULT_INTERVAL,
  livePrice,
  toast,
  stake = null,
  stakeExact = null,
  currency = 'USD',
  lang = 'fr',
  calm = false,
  refreshKey = 0,
  isActive = true,
  t,
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);

  const seriesRef = useRef('');
  const lenRef = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const boxRef = useRef(box);
  boxRef.current = box;
  const rafRef = useRef(null);
  const pendingViewRef = useRef(null);

  const scheduleView = (next) => {
    pendingViewRef.current = next;
    if (rafRef.current != null) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    rafRef.current = raf(() => {
      rafRef.current = null;
      if (pendingViewRef.current) {
        setView(pendingViewRef.current);
        pendingViewRef.current = null;
      }
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
        else clearTimeout(rafRef.current);
      }
    };
  }, []);

  // Charge l'historique des bougies + rafraîchissement toutes les 15 s (en pause hors écran).
  useEffect(() => {
    if (!isActive) return undefined;
    let cancelled = false;
    const series = `${symbol}|${interval}`;
    const changed = seriesRef.current !== series;
    if (changed) {
      seriesRef.current = series;
      setCandles([]);
      setView(DEFAULT_VIEW);
      lenRef.current = 0;
      setLoading(true);
    } else if (lenRef.current === 0) {
      setLoading(true);
    }
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
  }, [symbol, interval, reloadKey, refreshKey, isActive, t]);

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

  // Gestes : glisser horizontalement = défiler, pincer = zoomer, double-toucher = retour au direct.
  // Les glissements verticaux sont laissés au ScrollView parent (tirer pour actualiser).
  const gestureRef = useRef({
    panStartX: 0,
    panStartScroll: 0,
    pinch: null,
    moved: false,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const handleChartPress = (evt) => {
    const g = gestureRef.current;
    const now = Date.now();
    const px = evt && evt.nativeEvent ? evt.nativeEvent.pageX || 0 : 0;
    const py = evt && evt.nativeEvent ? evt.nativeEvent.pageY || 0 : 0;
    const near = Math.hypot(px - g.lastTapX, py - g.lastTapY) < CHART_CFG.tapSlop * 2;
    if (now - g.lastTapAt < CONFIG.DOUBLE_TAP_MS && near) {
      g.lastTapAt = 0;
      setView(DEFAULT_VIEW);
    } else {
      g.lastTapAt = now;
      g.lastTapX = px;
      g.lastTapY = py;
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => (evt.nativeEvent.touches || []).length >= 2,
        onMoveShouldSetPanResponder: (evt, gs) => {
          const touches = evt.nativeEvent.touches || [];
          if (touches.length >= 2) return true;
          return Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy);
        },
        onPanResponderTerminationRequest: () => false,
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
            g.moved = true;
          }
        },
        onPanResponderMove: (evt) => {
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
              scheduleView(clampView({ step: step1, scroll: scroll1 }, len, plotW));
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

          const v = viewRef.current;
          const dx = evt.nativeEvent.pageX - g.panStartX;
          scheduleView(clampView({ step: v.step, scroll: g.panStartScroll + dx / v.step }, len, plotW));
        },
        onPanResponderRelease: () => {
          gestureRef.current.pinch = null;
          gestureRef.current.moved = false;
        },
        onPanResponderTerminate: () => {
          gestureRef.current.pinch = null;
          gestureRef.current.moved = false;
        },
      }),
    []
  );

  // Calcul des géométries SVG regroupées en chemins (<Path>) pour un rendu ultra-fluide.
  const W = box.width || 340;
  const H = box.height || 220;
  const pw = CHART_CFG.axisW;
  const ph = CHART_CFG.axisBottom;
  const plotW = Math.max(1, W - pw);
  const plotB = Math.max(CHART_CFG.padTop + 20, H - ph - CHART_CFG.padBottom);
  const dec = symbolDecimals(symbol);

  const computed = useMemo(() => {
    const len = shown.length;
    if (len === 0 || W <= 0 || H <= 0) return null;

    const v = clampView(view, len, plotW);
    const step = v.step;
    const count = plotW / step;
    const end = len - v.scroll;
    const start = end - count;
    const i0 = Math.max(0, Math.floor(start));
    const i1 = Math.min(len, Math.ceil(end));
    const xPos = (i) => (i - start) * step + step / 2;

    const tip = shown[len - 1];
    const disp = liveTarget == null ? tip.close : liveTarget;

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
    const halfBody = bodyW / 2;
    const wickW = step > 16 ? 2 : 1;
    const halfWick = wickW / 2;

    // Grille + prix à droite (1 seul <Path> pour toutes les lignes horizontales + graduations)
    const gridRows = [];
    const gridSegs = [];
    for (let g = 0; g < CHART_CFG.gridLines; g++) {
      const val = hi - ((hi - lo) * g) / (CHART_CFG.gridLines - 1);
      const yy = yPos(val);
      gridRows.push({ yy, label: val.toFixed(dec) });
      gridSegs.push(`M0 ${yy.toFixed(1)}H${plotW.toFixed(1)}`);
    }

    // Bougies visibles regroupées en 2 <Path> (haussières et baissières)
    const upSegs = [];
    const downSegs = [];
    const bwStr = bodyW.toFixed(1);
    const nbwStr = (-bodyW).toFixed(1);
    for (let i = i0; i < i1; i++) {
      const k = shown[i];
      const close = i === len - 1 ? disp : k.close;
      const high = i === len - 1 ? Math.max(k.high, disp) : k.high;
      const low = i === len - 1 ? Math.min(k.low, disp) : k.low;
      const cx = xPos(i);
      const yOpen = yPos(k.open);
      const yClose = yPos(close);
      const yHi = yPos(high);
      const yLo = yPos(low);
      const yTop = Math.min(yOpen, yClose);
      const bh = Math.max(1, Math.abs(yOpen - yClose));
      const wh = Math.max(1, yLo - yHi);
      const seg =
        `M${(cx - halfWick).toFixed(1)} ${yHi.toFixed(1)}h${wickW}v${wh.toFixed(1)}h${-wickW}Z` +
        `M${(cx - halfBody).toFixed(1)} ${yTop.toFixed(1)}h${bwStr}v${bh.toFixed(1)}h${nbwStr}Z`;
      if (close >= k.open) upSegs.push(seg);
      else downSegs.push(seg);
    }

    // Heures en bas
    const span = Math.max(0, i1 - 1 - i0);
    const labelCount = Math.min(CHART_CFG.timeLabels, Math.max(0, i1 - i0));
    const plotBottom = yPos(lo);
    const timeTicks = [];
    for (let i = 0; i < labelCount; i++) {
      const idx = labelCount === 1 ? i1 - 1 : Math.round(i0 + (span * i) / (labelCount - 1));
      const lx = Math.min(Math.max(xPos(idx), CHART_CFG.timeEdge), W - pw - CHART_CFG.timeEdge);
      timeTicks.push({ key: i, lx, label: fmtHM24(shown[idx].time) });
      gridSegs.push(`M${lx.toFixed(1)} ${plotBottom.toFixed(1)}v${CHART_CFG.tickLen}`);
    }

    const cy = yPos(disp);
    const pillCy = Math.min(Math.max(cy, CHART_CFG.padTop + 9), plotB - 9);
    const pillX = W - pw + 2;
    const pillW = pw - 4;
    const pillH = 18;
    const stakeText = stake != null ? money(stake, stakeExact, currency, lang) : null;
    const stakeW = stakeText ? Math.max(36, stakeText.length * 6.2 + 12) : 0;
    const stakeX = pillX - 4 - stakeW;
    const liveCol = disp >= tip.open ? INK.hausse : INK.chartDown;
    const showDot = liveVisible && cy >= CHART_CFG.padTop && cy <= plotB;

    return {
      gridD: gridSegs.join(''),
      upD: upSegs.join(''),
      downD: downSegs.join(''),
      gridRows,
      timeTicks,
      cy,
      pillCy,
      pillX,
      pillW,
      pillH,
      stakeText,
      stakeW,
      stakeX,
      liveX,
      liveCol,
      showDot,
      dispLabel: disp.toFixed(dec),
    };
  }, [shown, view, liveTarget, W, H, pw, plotW, plotB, dec, stake, stakeExact, currency, lang]);

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
      <Pressable onPress={handleChartPress} style={styles.pressFill}>
        {computed ? (
          <Svg width={W} height={H}>
            <Defs>
              <ClipPath id="plotClip">
                <Rect x={0} y={0} width={plotW} height={plotB + 4} />
              </ClipPath>
            </Defs>

            {/* Grille horizontale + graduations temps en un seul Path */}
            {computed.gridD ? (
              <Path d={computed.gridD} stroke={INK.ligne} strokeWidth={1} fill="none" />
            ) : null}

            {/* Étiquettes de prix sur l'axe droit */}
            {computed.gridRows.map((row, idx) => (
              <SvgText key={idx} x={W - pw + 5} y={row.yy + 3.5} fill={INK.doux} fontSize={10}>
                {row.label}
              </SvgText>
            ))}

            {/* Bougies regroupées en 2 Path (haussières / baissières) */}
            <G clipPath="url(#plotClip)">
              {computed.upD ? <Path d={computed.upD} fill={INK.hausse} /> : null}
              {computed.downD ? <Path d={computed.downD} fill={INK.chartDown} /> : null}
            </G>

            {/* Ligne pointillée blanche du prix actuel */}
            <Line
              x1={0}
              x2={plotW}
              y1={computed.cy}
              y2={computed.cy}
              stroke={INK.texte}
              strokeWidth={1}
              strokeDasharray="3,3"
            />

            {/* Pastille grise de la mise en cours */}
            {computed.stakeText && computed.stakeX >= 0 ? (
              <>
                <Rect
                  x={computed.stakeX}
                  y={computed.pillCy - computed.pillH / 2}
                  width={computed.stakeW}
                  height={computed.pillH}
                  rx={4}
                  fill={INK.countBg}
                />
                <SvgText
                  x={computed.stakeX + computed.stakeW / 2}
                  y={computed.pillCy + 3.5}
                  textAnchor="middle"
                  fill={INK.texte}
                  fontSize={10}
                  fontWeight="700"
                >
                  {computed.stakeText}
                </SvgText>
              </>
            ) : null}

            {/* Pastille bleue du prix en direct */}
            <Rect
              x={computed.pillX}
              y={computed.pillCy - computed.pillH / 2}
              width={computed.pillW}
              height={computed.pillH}
              rx={4}
              fill={INK.pill}
            />
            <SvgText
              x={computed.pillX + computed.pillW / 2}
              y={computed.pillCy + 3.5}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={10}
              fontWeight="700"
            >
              {computed.dispLabel}
            </SvgText>

            {/* Point vivant fixe (l'anneau qui pulse est animé nativement au-dessus) */}
            {computed.showDot ? (
              <Circle cx={computed.liveX} cy={computed.cy} r={3} fill={computed.liveCol} />
            ) : null}

            {/* Heures sur l'axe du bas */}
            {computed.timeTicks.map((tk) => (
              <SvgText
                key={tk.key}
                x={tk.lx}
                y={H - CHART_CFG.timePad}
                textAnchor="middle"
                fill={INK.doux}
                fontSize={10}
              >
                {tk.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </Pressable>

      {/* Anneau animé sur le GPU (0 re-render JS) */}
      {computed && computed.showDot ? (
        <LivePulseRing
          x={computed.liveX}
          y={computed.cy}
          color={computed.liveCol}
          calm={calm}
          isActive={isActive}
        />
      ) : null}

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
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: INK.fond,
  },
  pressFill: {
    flex: 1,
    width: '100%',
  },
  pulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  liveBtn: {
    position: 'absolute',
    bottom: 24,
    right: 8,
    zIndex: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 8,
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
    alignItems: 'center',
    zIndex: 5,
  },
  toast: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: 'rgba(28, 31, 46, 0.94)',
    paddingHorizontal: 14,
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
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  skelBar: {
    width: 8,
    borderRadius: 3,
    backgroundColor: INK.carte,
  },
  errBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: INK.fond,
  },
  errText: {
    fontSize: 13,
    color: INK.doux,
    textAlign: 'center',
  },
});
