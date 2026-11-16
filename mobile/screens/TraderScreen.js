// Écran Trader : miroir exact de app/page.tsx + components/TradeForm.tsx.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Svg, { Line } from 'react-native-svg';
import {
  apiCancelScheduled,
  apiGetPrice,
  apiMyTrades,
  apiOpenTrade,
  apiScheduleTrade,
  apiSettle,
  ApiError,
} from '../api';
import {
  CURRENCIES,
  compareExact,
  convertToUsdNumber,
  convertUsdToInput,
  decimalToExact,
  exactGain,
  exactToInput,
  formatCurrencyLocal,
  localStake,
  money,
  stepBetAmount,
  sumTradeAmounts,
} from '../money';
import {
  CONFIG,
  DURATIONS,
  INK,
  RULES,
  SYMBOLS,
  fmtDurMS,
  fmtHM,
  fmtRemain,
  fmtRemainShort,
  fmtSlot,
  isDuration,
  isOtc,
  symbolDisplay,
} from '../theme';
import { CandleChart } from '../components/CandleChart';
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, MinusIcon, PlusIcon } from '../components/Icons';
import { ActiveTradeCard, ResultCard, ScheduledTrades, TimePickerPanel, chunkRows } from '../components/TradeCards';
import { BottomSheet, Btn, GuideBubbles, SelectSheet } from '../components/Ui';

function parseAmount(raw) {
  const cleaned = String(raw || '').replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function slotFromTime(v, fromMs) {
  const m = /^(\d{2})[:h](\d{2})$/.exec(v || '');
  if (!m) return null;
  const day = new Date(fromMs);
  day.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let slot = Math.floor(day.getTime() / 1000);
  if (slot * 1000 <= fromMs) slot += 24 * 3600;
  return slot;
}

const DottedLeader = React.memo(function DottedLeader() {
  const [width, setWidth] = useState(0);
  return (
    <View
      style={styles.debDotsWrap}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0 && w !== width) setWidth(w);
      }}
    >
      {width > 0 ? (
        <Svg height={2} width={width}>
          <Line
            x1={0}
            y1={1}
            x2={width}
            y2={1}
            stroke="rgba(142,147,167,0.6)"
            strokeWidth={2}
            strokeDasharray="2,4"
          />
        </Svg>
      ) : null}
    </View>
  );
});

export const TraderScreen = React.memo(function TraderScreen({
  user,
  currency,
  lang,
  t,
  calm,
  online,
  offsetMs,
  isActive = true,
  onBalance,
  onRefresh,
  pendingSignal,
  onConsumeSignal,
}) {
  const [symbol, setSymbol] = useState(SYMBOLS[0].id);
  const [durationSec, setDurationSec] = useState(CONFIG.DEFAULT_DURATION_SEC);
  const [amountStr, setAmountStr] = useState(() => convertUsdToInput(CONFIG.DEFAULT_BET, currency));
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [price, setPrice] = useState(null);
  const [otherPrices, setOtherPrices] = useState({});
  const [openTrades, setOpenTrades] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [results, setResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  const [assetOpen, setAssetOpen] = useState(false);
  const [durSheetOpen, setDurSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [quand, setQuand] = useState('now');
  const [customTime, setCustomTime] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [signal, setSignal] = useState(null);
  const [pending, setPending] = useState(null);

  const [placing, setPlacing] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [fastNow, setFastNow] = useState(() => Date.now());

  const settlingRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef(null);
  const openIdsRef = useRef(new Set());
  const shownRef = useRef(new Set());
  const firedRef = useRef(false);
  const currencyRef = useRef(currency);

  const doVibrate = useCallback(
    (ms) => {
      if (calm) return;
      try {
        if (Vibration && typeof Vibration.vibrate === 'function') Vibration.vibrate(ms);
      } catch {
        /* ignore */
      }
    },
    [calm]
  );

  const say = useCallback((msg, tone) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), CONFIG.TOAST_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Charge les préférences sauvegardées (symbole, durée, mise, guide).
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [savedSym, savedOrder, savedGuide] = await Promise.all([
          SecureStore.getItemAsync(CONFIG.STORE.symbol).catch(() => null),
          SecureStore.getItemAsync(CONFIG.STORE.order).catch(() => null),
          SecureStore.getItemAsync(CONFIG.STORE.guide).catch(() => null),
        ]);
        if (!live) return;
        if (savedSym && SYMBOLS.some((s) => s.id === savedSym)) setSymbol(savedSym);
        if (savedOrder) {
          try {
            const parsed = JSON.parse(savedOrder);
            if (parsed.currency === currency) {
              if (isDuration(parsed.durationSec)) setDurationSec(parsed.durationSec);
              if (typeof parsed.amountStr === 'string' && parsed.amountStr.trim() !== '') {
                setAmountStr(parsed.amountStr);
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (savedGuide !== '1') setShowGuide(true);
      } finally {
        if (live) setPrefsLoaded(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde durée + mise à chaque changement.
  useEffect(() => {
    if (!prefsLoaded) return;
    SecureStore.setItemAsync(
      CONFIG.STORE.order,
      JSON.stringify({ durationSec, amountStr, currency })
    ).catch(() => {});
  }, [durationSec, amountStr, currency, prefsLoaded]);

  // Changement de devise dans le profil : réinitialise la mise au défaut converti.
  useEffect(() => {
    if (currencyRef.current !== currency) {
      currencyRef.current = currency;
      setAmountStr(convertUsdToInput(CONFIG.DEFAULT_BET, currency));
    }
  }, [currency]);

  // Signal entrant depuis l'écran Signaux (« Préparer ma mise → »).
  useEffect(() => {
    if (!pendingSignal) return;
    const { symbol: sym, duration, direction, slot } = pendingSignal;
    if (sym && SYMBOLS.some((s) => s.id === sym)) {
      setSymbol(sym);
      SecureStore.setItemAsync(CONFIG.STORE.symbol, sym).catch(() => {});
    }
    if (isDuration(duration)) setDurationSec(duration);
    const serverNow = Date.now() + (offsetMs || 0);
    if (direction && slot) {
      setSignal({ direction, atMs: slot * 1000 });
      if (slot * 1000 > serverNow + CONFIG.TIME_SLOT_BOOK_MARGIN_MS) {
        setQuand(String(slot));
        setCustomTime('');
      }
    }
    if (onConsumeSignal) onConsumeSignal();
  }, [pendingSignal, offsetMs, onConsumeSignal]);

  const needsClock =
    isActive &&
    (openTrades.length > 0 ||
      scheduled.length > 0 ||
      durSheetOpen ||
      timeSheetOpen ||
      tradesOpen ||
      signal != null ||
      pending != null);

  // Horloge 1 s uniquement quand un élément affiché en a besoin (0 re-render au repos).
  useEffect(() => {
    if (!needsClock) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CONFIG.FLOAT_TICK_MS);
    return () => clearInterval(timer);
  }, [needsClock]);

  // Horloge rapide 250 ms pendant un signal actif ou une mise armée.
  useEffect(() => {
    if (!isActive || (!signal && !pending)) return undefined;
    setFastNow(Date.now());
    const timer = setInterval(() => setFastNow(Date.now()), CONFIG.SIGNAL_TICK_MS);
    return () => clearInterval(timer);
  }, [isActive, signal, pending]);

  // Efface automatiquement un signal expiré après 30 s.
  useEffect(() => {
    if (!signal) return;
    const wait = signal.atMs + CONFIG.SIGNAL_LATE_MS - (Date.now() + (offsetMs || 0));
    if (wait <= 0) {
      setSignal(null);
      return;
    }
    const timer = setTimeout(() => setSignal(null), wait);
    return () => clearTimeout(timer);
  }, [signal, offsetMs]);

  // Changement de jeu pendant une mise armée sur l'appareil : annule l'attente.
  useEffect(() => {
    if (pending && pending.symbol !== symbol) {
      setPending(null);
      firedRef.current = false;
      setError(t('Jeu changé : programmation annulée.'));
    }
  }, [symbol, pending, t]);

  const pickSymbol = useCallback((id) => {
    setSymbol(id);
    setAssetOpen(false);
    SecureStore.setItemAsync(CONFIG.STORE.symbol, id).catch(() => {});
  }, []);

  const prevSymbolRef = useRef(symbol);

  // Sondage du prix en direct toutes les 4 s (en pause quand l'onglet n'est pas affiché).
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      prevSymbolRef.current = symbol;
      setPrice(null);
    }
    if (!isActive) return undefined;
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const p = await apiGetPrice(symbol);
        if (!stopped) setPrice(p);
      } catch {
        /* nouvel essai au tour suivant */
      } finally {
        inFlight = false;
      }
    };
    poll();
    const timer = setInterval(poll, CONFIG.LIVE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [symbol, isActive]);

  // Prix en direct des autres jeux ayant des trades en cours.
  const otherSymbolsKey = useMemo(() => {
    const syms = [...new Set(openTrades.map((tr) => tr.symbol))].filter((s) => s !== symbol).sort();
    return syms.join(',');
  }, [openTrades, symbol]);

  useEffect(() => {
    if (!otherSymbolsKey) {
      setOtherPrices({});
      return undefined;
    }
    if (!isActive) return undefined;
    const syms = otherSymbolsKey.split(',');
    let stopped = false;
    const poll = async () => {
      const entries = await Promise.all(
        syms.map(async (s) => {
          try {
            return [s, await apiGetPrice(s)];
          } catch {
            return [s, null];
          }
        })
      );
      if (stopped) return;
      setOtherPrices((prev) => {
        const next = { ...prev };
        for (const [s, p] of entries) {
          if (p != null) next[s] = p;
        }
        return next;
      });
    };
    poll();
    const timer = setInterval(poll, CONFIG.LIVE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [otherSymbolsKey, isActive]);

  // Chargement des prédictions en cours.
  const loadOpen = useCallback(async () => {
    try {
      const res = await apiMyTrades('open', CONFIG.TRADES_PAGE_LIMIT);
      const list = (res && res.trades) || [];
      setOpenTrades(list);
      const fresh = new Set(list.map((tr) => tr.id));
      const vanished = [...openIdsRef.current].filter((id) => !fresh.has(id) && !shownRef.current.has(id));
      openIdsRef.current = fresh;
      if (vanished.length > 0) {
        try {
          const settledRes = await apiMyTrades('settled', CONFIG.TRADES_PAGE_LIMIT);
          const found = ((settledRes && settledRes.trades) || []).filter((tr) => vanished.includes(tr.id));
          if (found.length > 0) {
            found.forEach((tr) => shownRef.current.add(tr.id));
            setResults((prev) => {
              const known = new Set(prev.map((p) => p.id));
              return [...found.filter((tr) => !known.has(tr.id)), ...prev].slice(0, CONFIG.RESULTS_SHOWN);
            });
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;
    loadOpen();
    const timer = setInterval(loadOpen, CONFIG.TRADES_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadOpen, isActive]);

  // Chargement des mises programmées.
  const loadScheduled = useCallback(async () => {
    try {
      const res = await apiMyTrades('scheduled', CONFIG.TRADES_PAGE_LIMIT);
      setScheduled((res && res.trades) || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;
    loadScheduled();
    const timer = setInterval(loadScheduled, CONFIG.SCHEDULED_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadScheduled, isActive]);

  const handlePullRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setChartRefreshKey((k) => k + 1);
    try {
      await Promise.all([
        onRefresh ? onRefresh() : Promise.resolve(),
        loadOpen(),
        loadScheduled(),
        apiGetPrice(symbol)
          .then((p) => {
            if (p != null) setPrice(p);
          })
          .catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, onRefresh, loadOpen, loadScheduled, symbol]);

  const cancelScheduled = useCallback(
    async (id) => {
      try {
        const res = await apiCancelScheduled(id);
        onBalance(res.balance, res.balanceExact);
        loadScheduled();
      } catch (err) {
        say(err instanceof ApiError ? err.message : t('Annulation impossible pour le moment.'), null);
      }
    },
    [loadScheduled, onBalance, say, t]
  );

  // Clôture automatique à l'échéance (uniquement s'il y a des trades ouverts).
  useEffect(() => {
    if (!isActive || openTrades.length === 0) return undefined;
    const timer = setInterval(async () => {
      if (settlingRef.current || !online) return;
      const current = Date.now() + (offsetMs || 0);
      const due = openTrades.filter((tr) => new Date(tr.closesAt).getTime() <= current);
      if (due.length === 0) return;
      settlingRef.current = true;
      try {
        const res = await apiSettle(due.map((d) => d.id));
        if (res && res.settled && res.settled.length > 0) {
          res.settled.forEach((s) => shownRef.current.add(s.id));
          setOpenTrades((prev) => prev.filter((p) => !res.settled.some((s) => s.id === p.id)));
          setResults((prev) => [...res.settled, ...prev].slice(0, CONFIG.RESULTS_SHOWN));
          onBalance(res.balance, res.balanceExact);
          doVibrate(CONFIG.VIBRATE.settle);
          if (res.settled.length === 1) {
            const s = res.settled[0];
            if (s.result === 'WIN') {
              say(t('Gagné +{amt}', { amt: money(s.payout ?? 0, s.payoutExact, currency, lang) }), 'win');
            } else if (s.result === 'LOSS') {
              say(t('Perdu −{amt}', { amt: money(s.amount, s.amountExact, currency, lang) }), 'loss');
            } else {
              say(t('Égalité : mise rendue'), null);
            }
          } else {
            const won = res.settled.filter((s) => s.result === 'WIN').length;
            const lost = res.settled.filter((s) => s.result === 'LOSS').length;
            say(
              t('{n} résultats : {w} · {l}', {
                n: res.settled.length,
                w: won > 1 ? t('{n} gagnés', { n: won }) : t('{n} gagné', { n: won }),
                l: lost > 1 ? t('{n} perdus', { n: lost }) : t('{n} perdu', { n: lost }),
              }),
              won > lost ? 'win' : lost > won ? 'loss' : null
            );
          }
        }
      } catch {
        /* nouvel essai à la seconde suivante */
      } finally {
        settlingRef.current = false;
      }
    }, CONFIG.SETTLE_TICK_MS);
    return () => clearInterval(timer);
  }, [isActive, openTrades, online, offsetMs, onBalance, doVibrate, say, t, currency, lang]);

  // Calculs du panneau d'ordre
  const serverNowMs = now + (offsetMs || 0);
  const fastServerMs = fastNow + (offsetMs || 0);

  const signalRemainMs = signal ? signal.atMs - fastServerMs : 0;
  const signalLive = signal != null && signalRemainMs > 0;
  const signalLabel = signal && signal.direction === 'DOWN' ? t('Baisse ▼') : t('Hausse ▲');
  const signalArmed = signalLive && signalRemainMs <= CONFIG.SIGNAL_PRESS_WINDOW_MS;

  const firstSlot = Math.ceil((serverNowMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS) / 60000) * 60;
  const timeSlots = Array.from({ length: CONFIG.TIME_SLOT_COUNT - 2 }, (_, i) => firstSlot + i * 60);

  const typedSlot = customTime === '' ? null : slotFromTime(customTime, serverNowMs);
  const typedPassed = typedSlot != null && typedSlot * 1000 <= serverNowMs;
  const typedTooSoon =
    typedSlot != null &&
    typedSlot * 1000 > serverNowMs &&
    typedSlot * 1000 <= serverNowMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS;

  let chosenSlot = null;
  let quandStale = false;
  if (quand !== 'now' && quand !== CONFIG.BAD_TIME) {
    const slot = Number(quand);
    if (Number.isFinite(slot) && slot * 1000 > serverNowMs) chosenSlot = slot;
    else quandStale = true;
  }

  const scheduling = !signalLive;
  const effectiveSlot = scheduling ? chosenSlot : null;
  const slotInvalid = scheduling && (quand === CONFIG.BAD_TIME || quandStale);

  const pickNow = useCallback(() => {
    setQuand('now');
    setCustomTime('');
  }, []);

  const pickSlot = useCallback((s) => {
    setSignal(null);
    setQuand(String(s));
    setCustomTime('');
  }, []);

  const onCustomTime = useCallback(
    (v) => {
      setSignal(null);
      setCustomTime(v);
      if (v === '') {
        setQuand('now');
        return;
      }
      const curMs = Date.now() + (offsetMs || 0);
      const slot = slotFromTime(v, curMs);
      const ok = slot != null && slot * 1000 > curMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS;
      setQuand(ok ? String(slot) : CONFIG.BAD_TIME);
    },
    [offsetMs]
  );

  const balance = user ? user.balance : 0;
  const maxBet = Math.max(0, balance);
  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);
  const amountUsd = amount == null ? null : convertToUsdNumber(amount, currency);
  const amountExact = useMemo(() => {
    try {
      return localStake(amountStr, currency);
    } catch {
      return undefined;
    }
  }, [amountStr, currency]);

  const payoutExact = amountExact && amount != null && amount > 0 ? exactGain(amountExact) : undefined;
  const payoutDisplay = payoutExact
    ? money(0, payoutExact, currency, lang)
    : formatCurrencyLocal(0, currency, lang);

  const minBetExact = useMemo(() => decimalToExact(RULES.MIN_BET), []);

  const belowMinimum = useCallback(
    (exact, usd) => (exact ? compareExact(exact, minBetExact) < 0 : usd < RULES.MIN_BET),
    [minBetExact]
  );
  const exceedsBalance = useCallback(
    (exact, usd) =>
      exact && user && user.balanceExact
        ? compareExact(exact, user.balanceExact) > 0
        : usd > maxBet,
    [user, maxBet]
  );

  const stepBet = useCallback(
    (dir) => {
      setAmountStr((prev) =>
        stepBetAmount(
          prev,
          dir,
          currency,
          balance,
          user && user.balanceExact,
          RULES.MIN_BET,
          CONFIG.DEFAULT_BET
        )
      );
    },
    [currency, balance, user]
  );

  const handleOpened = useCallback(
    (trade, newBalance, newBalanceExact) => {
      openIdsRef.current.add(trade.id);
      setOpenTrades((prev) => [trade, ...prev]);
      onBalance(newBalance, newBalanceExact);
      setSignal(null);
      setTradesOpen(true);
      say(
        t('{dir} {amt} · {dur} s', {
          dir: trade.direction === 'UP' ? t('Hausse') : t('Baisse'),
          amt: money(trade.amount, trade.amountExact, currency, lang),
          dur: trade.durationSec,
        }),
        null
      );
    },
    [onBalance, say, t, currency, lang]
  );

  const place = useCallback(
    async (direction, ov) => {
      const amt = ov ? ov.amount : amountUsd;
      const stakeExact = ov ? ov.amountExact : amountExact;
      setError(null);
      if (!online) {
        setError(t('Hors ligne : reconnectez-vous pour jouer.'));
        return;
      }
      if (amt == null || amt <= 0 || (!ov && !stakeExact)) {
        setError(t('Entrez un montant de mise.'));
        return;
      }
      if (belowMinimum(stakeExact, amt)) {
        setError(t('La mise minimum est de {min}.', { min: money(RULES.MIN_BET, null, currency, lang) }));
        return;
      }
      if (exceedsBalance(stakeExact, amt)) {
        setError(t('Solde insuffisant pour cette mise.'));
        return;
      }
      setPlacing(direction);
      try {
        const res = await apiOpenTrade({
          symbol: (ov && ov.symbol) || symbol,
          direction,
          amount: amt,
          amountExact: stakeExact,
          durationSec: (ov && ov.durationSec) || durationSec,
        });
        doVibrate(CONFIG.VIBRATE.action);
        pickNow();
        handleOpened(res.trade, res.balance, res.balanceExact);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('Prédiction impossible pour le moment.'));
      } finally {
        setPlacing(null);
      }
    },
    [
      amountUsd,
      amountExact,
      online,
      belowMinimum,
      exceedsBalance,
      symbol,
      durationSec,
      doVibrate,
      pickNow,
      handleOpened,
      t,
      currency,
      lang,
    ]
  );

  const scheduleOrPlace = useCallback(
    async (direction) => {
      if (!scheduling || quand === 'now') {
        await place(direction);
        return;
      }
      if (quand === CONFIG.BAD_TIME) {
        setError(
          typedPassed
            ? t('Heure passée : choisis une heure à venir.')
            : typedTooSoon
              ? t('Heure trop proche : choisis une heure plus tardive.')
              : t('Choisis une heure à venir dans la liste.')
        );
        return;
      }
      const slot = Number(quand);
      const curMs = Date.now() + (offsetMs || 0);
      if (!Number.isFinite(slot) || slot * 1000 <= curMs) {
        setError(t('Heure passée : choisis une autre heure.'));
        return;
      }
      if (slot * 1000 <= curMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS) {
        setError(t('Heure trop proche : choisis une heure plus tardive.'));
        return;
      }
      setError(null);
      if (!online) {
        setError(t('Hors ligne : reconnectez-vous pour jouer.'));
        return;
      }
      if (amountUsd == null || amountUsd <= 0 || !amountExact) {
        setError(t('Entrez un montant de mise.'));
        return;
      }
      if (belowMinimum(amountExact, amountUsd)) {
        setError(t('La mise minimum est de {min}.', { min: money(RULES.MIN_BET, null, currency, lang) }));
        return;
      }
      if (exceedsBalance(amountExact, amountUsd)) {
        setError(t('Solde insuffisant pour cette mise.'));
        return;
      }
      if (isOtc(symbol)) {
        setPlacing(direction);
        try {
          const res = await apiScheduleTrade({
            symbol,
            direction,
            amount: amountUsd,
            amountExact,
            durationSec,
            slot,
          });
          doVibrate(CONFIG.VIBRATE.action);
          onBalance(res.balance, res.balanceExact);
          pickNow();
          loadScheduled();
          setTradesOpen(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t('Programmation impossible pour le moment.'));
        } finally {
          setPlacing(null);
        }
        return;
      }
      firedRef.current = false;
      setPending({ direction, amount: amountUsd, amountExact, durationSec, symbol, slot });
    },
    [
      scheduling,
      quand,
      typedPassed,
      typedTooSoon,
      offsetMs,
      online,
      amountUsd,
      amountExact,
      belowMinimum,
      exceedsBalance,
      symbol,
      durationSec,
      doVibrate,
      onBalance,
      pickNow,
      loadScheduled,
      place,
      t,
      currency,
      lang,
    ]
  );

  const pressDirection = useCallback(
    async (direction) => {
      if (signalLive && signal && direction === signal.direction) {
        if (!signalArmed) {
          setError(t('Trop tôt : attends la fin du compte à rebours, le coup part à la seconde pile.'));
          return;
        }
        setError(null);
        if (!online) {
          setError(t('Hors ligne : reconnectez-vous pour jouer.'));
          return;
        }
        if (amountUsd == null || amountUsd <= 0 || !amountExact) {
          setError(t('Entrez un montant de mise.'));
          return;
        }
        if (belowMinimum(amountExact, amountUsd)) {
          setError(t('La mise minimum est de {min}.', { min: money(RULES.MIN_BET, null, currency, lang) }));
          return;
        }
        if (exceedsBalance(amountExact, amountUsd)) {
          setError(t('Solde insuffisant pour cette mise.'));
          return;
        }
        firedRef.current = false;
        setPending({
          direction,
          amount: amountUsd,
          amountExact,
          durationSec,
          symbol,
          slot: Math.floor(signal.atMs / 1000),
        });
        return;
      }
      await scheduleOrPlace(direction);
    },
    [
      signalLive,
      signal,
      signalArmed,
      online,
      amountUsd,
      amountExact,
      belowMinimum,
      exceedsBalance,
      durationSec,
      symbol,
      scheduleOrPlace,
      t,
      currency,
      lang,
    ]
  );

  // Tir armé sur l'appareil : part dès que la seconde pile (+150 ms) arrive.
  useEffect(() => {
    if (!pending || firedRef.current) return;
    if (fastServerMs < pending.slot * 1000 + CONFIG.SHOT_DELAY_MS) return;
    firedRef.current = true;
    (async () => {
      await place(pending.direction, {
        amount: pending.amount,
        amountExact: pending.amountExact,
        durationSec: pending.durationSec,
        symbol: pending.symbol,
      });
      setPending(null);
      firedRef.current = false;
    })();
  }, [fastServerMs, pending, place]);

  const handleReplay = useCallback(
    (trade) => {
      setResults((prev) => prev.slice(1));
      if (trade.symbol !== symbol) pickSymbol(trade.symbol);
      setDurationSec(trade.durationSec);
      setAmountStr(
        trade.amountExact
          ? exactToInput(trade.amountExact, currency)
          : convertUsdToInput(trade.amount, currency)
      );
      pickNow();
      place(trade.direction, {
        amount: trade.amount,
        amountExact: trade.amountExact,
        durationSec: trade.durationSec,
        symbol: trade.symbol,
      });
    },
    [symbol, pickSymbol, currency, pickNow, place]
  );

  const sortedOpen = useMemo(
    () => [...openTrades].sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt)),
    [openTrades]
  );
  const scheduledUp = useMemo(
    () => scheduled.filter((tr) => new Date(tr.openedAt).getTime() > serverNowMs),
    [scheduled, serverNowMs]
  );

  const nearestMs =
    sortedOpen.length === 0 ? 0 : Math.max(0, +new Date(sortedOpen[0].closesAt) - serverNowMs);
  const nextSchedMs =
    scheduledUp.length === 0
      ? 0
      : Math.max(0, Math.min(...scheduledUp.map((tr) => new Date(tr.openedAt).getTime())) - serverNowMs);
  const totalStaked = sortedOpen.reduce((sum, tr) => sum + tr.amount, 0);
  const scheduledStaked = scheduledUp.reduce((sum, tr) => sum + tr.amount, 0);
  const totalStakedExact = sumTradeAmounts(sortedOpen);
  const scheduledStakedExact = sumTradeAmounts(scheduledUp);
  const priceOf = (tr) => (tr.symbol === symbol ? price : otherPrices[tr.symbol] ?? null);

  const encoursVisible = tradesOpen && (sortedOpen.length > 0 || scheduledUp.length > 0);
  const asset = SYMBOLS.find((s) => s.id === symbol) || SYMBOLS[0];
  const payoutPct = Math.round(RULES.WIN_PAYOUT_RATIO * 100);
  const pendingRemainMs = pending
    ? Math.max(0, pending.slot * 1000 + CONFIG.SHOT_DELAY_MS - fastServerMs)
    : 0;

  const durationRows = chunkRows(DURATIONS, 3);
  const departItems = [
    { type: 'now', key: 'now', label: t('Maintenant'), active: quand === 'now' },
    ...timeSlots.map((s) => ({
      type: 'slot',
      key: String(s),
      slot: s,
      label: fmtHM(s),
      active: quand === String(s),
    })),
    { type: 'other', key: 'other', label: t('Autre'), active: customTime !== '' },
  ];
  const departRows = chunkRows(departItems, 3);

  const closeGuide = () => {
    setShowGuide(false);
    SecureStore.setItemAsync(CONFIG.STORE.guide, '1').catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            tintColor={INK.action}
            colors={[INK.action, INK.hausse]}
            progressBackgroundColor={INK.carte}
          />
        }
      >
        {/* Graphique maison en bougies : prend toute la place disponible */}
        <View style={styles.chartBox}>
          <CandleChart
            symbol={symbol}
            interval={CONFIG.DEFAULT_INTERVAL}
            livePrice={price}
            toast={toast}
            stake={sortedOpen.length > 0 ? sortedOpen[0].amount : null}
            stakeExact={sortedOpen.length > 0 ? sortedOpen[0].amountExact : null}
            currency={currency}
            lang={lang}
            calm={calm}
            refreshKey={chartRefreshKey}
            isActive={isActive}
            t={t}
          />

        {/* Pastille « N en cours » en bas à gauche du graphique */}
        {sortedOpen.length > 0 || scheduledUp.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setTradesOpen(true)}
            style={styles.pill}
          >
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>
              {sortedOpen.length > 0
                ? t('{n} en cours', { n: sortedOpen.length })
                : t('Programmé(es) ({n})', { n: scheduledUp.length })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Panneau d'ordres façon Quotex */}
      <View style={styles.panel}>
        {pending ? (
          <View style={styles.waitBox}>
            <Text style={styles.waitTitle}>
              {pending.direction === 'UP' ? t('Hausse ▲') : t('Baisse ▼')}{' '}
              {money(pending.amount, pending.amountExact, currency, lang)} {t('à')}{' '}
              {fmtSlot(pending.slot)}
            </Text>
            <Text style={styles.waitClock}>{fmtRemain(pendingRemainMs)}</Text>
            <Btn variant="ghost" onPress={() => setPending(null)} style={styles.waitBtn}>
              {t('Annuler')}
            </Btn>
            <Text style={styles.waitNote}>{t("Reste sur cette page jusqu'au départ.")}</Text>
          </View>
        ) : (
          <>
            {/* Ligne jeu + pourcentage de gain */}
            <View style={styles.assetRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('Jeu : {name}. Changer de jeu.', { name: symbolDisplay(symbol) })}
                onPress={() => setAssetOpen(true)}
                style={styles.assetBtn}
              >
                <View style={[styles.assetDot, { backgroundColor: asset.color }]} />
                <Text style={styles.assetName} numberOfLines={1}>
                  {symbolDisplay(symbol)}
                </Text>
                <Text style={styles.payout}>{payoutPct}%</Text>
                <ChevronDownIcon size={16} color={INK.doux} />
              </TouchableOpacity>
            </View>

            {/* Durée + Investissement (deux cadres à étiquette flottante) */}
            <View style={styles.boxes}>
              <View style={styles.box}>
                <View style={styles.boxLabelWrap}>
                  <Text style={styles.boxLabel}>
                    {effectiveSlot != null ? t('Départ') : t('Durée')}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setDurSheetOpen(true)}
                  style={styles.minBtn}
                >
                  <Text style={styles.minVal} numberOfLines={1}>
                    {effectiveSlot != null ? fmtHM(effectiveSlot) : fmtDurMS(durationSec)}
                  </Text>
                  {effectiveSlot != null ? (
                    <Text style={styles.minSub} numberOfLines={1}>
                      {t('durée {dur}', { dur: fmtDurMS(durationSec) })}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              </View>

              <View style={styles.box}>
                <View style={styles.boxLabelWrap}>
                  <Text style={styles.boxLabel}>
                    {t('Investissement')} ({(CURRENCIES[currency] || CURRENCIES.USD)[0]})
                  </Text>
                </View>
                <View style={styles.invRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('Diminuer la mise')}
                    onPress={() => stepBet(-1)}
                    style={styles.stepBtn}
                  >
                    <MinusIcon size={14} color={INK.texte} />
                  </TouchableOpacity>
                  <TextInput
                    value={amountStr}
                    onChangeText={setAmountStr}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('Montant de la mise')}
                    style={styles.invInput}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('Augmenter la mise')}
                    onPress={() => stepBet(1)}
                    style={styles.stepBtn}
                  >
                    <PlusIcon size={14} color={INK.texte} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Gain potentiel avec pointillés */}
            <View style={styles.debRow}>
              <Text style={styles.debLabel}>{t('Gain potentiel')}</Text>
              <DottedLeader />
              <Text style={styles.debVal}>{payoutDisplay}</Text>
            </View>

            {/* Consigne de signal active / expirée / heure invalide */}
            {signalLive ? (
              <View style={styles.signalBox}>
                <Text style={styles.signalText}>
                  {signalArmed ? (
                    <>
                      {t("C'est le moment : appuie sur")}{' '}
                      <Text style={styles.signalClock}>{signalLabel}</Text>
                    </>
                  ) : (
                    <>
                      {t('Dans')}{' '}
                      <Text style={styles.signalClock}>{fmtRemain(signalRemainMs)}</Text>
                      {t(', appuie sur')}{' '}
                      <Text style={styles.signalClock}>{signalLabel}</Text>
                    </>
                  )}
                </Text>
              </View>
            ) : null}

            {signal && !signalLive ? (
              <View style={styles.lateBox}>
                <Text style={styles.lateText}>
                  {t('Trop tard : ce coup est passé. Choisis une autre heure dans « Départ ».')}
                </Text>
              </View>
            ) : null}

            {slotInvalid ? (
              <Text style={styles.hintErr}>
                {quand === CONFIG.BAD_TIME
                  ? typedPassed
                    ? t('Heure passée : choisis une heure à venir.')
                    : typedTooSoon
                      ? t('Heure trop proche : choisis une heure plus tardive.')
                      : t('Choisis une heure à venir dans la liste.')
                  : t('Heure passée : choisis une autre heure.')}
              </Text>
            ) : null}

            {/* Boutons HAUSSE / BAISSE (style Quotex) */}
            <View style={styles.goRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('Hausse : je prédis que le prix va monter')}
                activeOpacity={0.85}
                disabled={placing !== null}
                onPress={() => pressDirection('UP')}
                style={[
                  styles.goBtn,
                  styles.goBuy,
                  placing !== null && styles.disabled,
                  signalLive && signal && signal.direction === 'UP' && styles.advised,
                ]}
              >
                {placing === 'UP' ? (
                  <Text style={styles.goText}>…</Text>
                ) : (
                  <>
                    <Text style={styles.goText}>{t('Hausse')}</Text>
                    <View style={styles.arrowDot}>
                      <ArrowUpIcon size={16} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('Baisse : je prédis que le prix va descendre')}
                activeOpacity={0.85}
                disabled={placing !== null}
                onPress={() => pressDirection('DOWN')}
                style={[
                  styles.goBtn,
                  styles.goSell,
                  placing !== null && styles.disabled,
                  signalLive && signal && signal.direction === 'DOWN' && styles.advised,
                ]}
              >
                {placing === 'DOWN' ? (
                  <Text style={styles.goText}>…</Text>
                ) : (
                  <>
                    <Text style={styles.goText}>{t('Baisse')}</Text>
                    <View style={styles.arrowDot}>
                      <ArrowDownIcon size={16} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
      </ScrollView>

      {/* BottomSheet 1 : Choix du jeu */}
      <SelectSheet
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        title={t('Choisir un jeu')}
        options={SYMBOLS.map((s) => ({
          value: s.id,
          label: symbolDisplay(s.id),
          color: s.color,
          badge: s.kind === 'otc' ? t('JEU') : null,
        }))}
        selectedValue={symbol}
        onSelect={pickSymbol}
      />

      {/* BottomSheet 2 : Durée et Départ au même endroit */}
      <BottomSheet
        open={durSheetOpen}
        onClose={() => setDurSheetOpen(false)}
        title={t('Durée ou départ')}
        hideTitle
      >
        <View style={styles.sheetSections}>
          <View>
            <Text style={styles.secTitle}>{t('Durée')}</Text>
            <View style={styles.gridRows}>
              {durationRows.map((row, rIdx) => (
                <View key={rIdx} style={styles.gridRow}>
                  {row.map((d) => {
                    const active = durationSec === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        accessibilityRole="button"
                        onPress={() => setDurationSec(d)}
                        style={[styles.cell, active ? styles.cellOn : styles.cellOff]}
                      >
                        <Text style={active ? styles.cellTextOn : styles.cellTextOff}>
                          {fmtDurMS(d)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }, (_, k) => (
                        <View key={`d-${k}`} style={styles.cellEmpty} />
                      ))
                    : null}
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.secTitle}>{t('Départ')}</Text>
            <View style={styles.gridRows}>
              {departRows.map((row, rIdx) => (
                <View key={rIdx} style={styles.gridRow}>
                  {row.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      accessibilityRole="button"
                      onPress={() => {
                        if (item.type === 'now') pickNow();
                        else if (item.type === 'slot') pickSlot(item.slot);
                        else {
                          setDraftTime(customTime);
                          setTimeSheetOpen(true);
                        }
                      }}
                      style={[styles.cell, item.active ? styles.cellOn : styles.cellOff]}
                    >
                      <Text style={item.active ? styles.cellTextOn : styles.cellTextOff}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }, (_, k) => (
                        <View key={`t-${k}`} style={styles.cellEmpty} />
                      ))
                    : null}
                </View>
              ))}
            </View>
          </View>
        </View>
      </BottomSheet>

      {/* BottomSheet 3 : Choisir l'heure (tranches de 15 min) */}
      <BottomSheet
        open={timeSheetOpen}
        onClose={() => setTimeSheetOpen(false)}
        title={t("Choisir l'heure")}
        hideTitle
      >
        <TimePickerPanel
          value={draftTime}
          nowMs={serverNowMs}
          onChange={setDraftTime}
          onConfirm={() => {
            onCustomTime(draftTime);
            setTimeSheetOpen(false);
            setDurSheetOpen(false);
          }}
          t={t}
        />
      </BottomSheet>

      {/* BottomSheet 4 : Prédictions en cours + programmées */}
      <BottomSheet
        open={encoursVisible}
        onClose={() => setTradesOpen(false)}
        title={
          sortedOpen.length > 0
            ? t('En cours ({n})', { n: sortedOpen.length })
            : t('Programmé(es) ({n})', { n: scheduledUp.length })
        }
        header={
          <View style={styles.encoursHead}>
            <Text style={styles.encoursHeadTitle}>
              {sortedOpen.length > 0 ? t('En cours') : t('Programmé(es)')}
            </Text>
            <View style={styles.encoursBadge}>
              <Text style={styles.encoursBadgeText}>
                {sortedOpen.length > 0 ? sortedOpen.length : scheduledUp.length}
              </Text>
            </View>
            <Text style={styles.encoursSum} numberOfLines={2}>
              {sortedOpen.length > 0 ? (
                <>
                  {t('Mises')}{' '}
                  <Text style={styles.encoursSumB}>
                    {money(totalStaked, totalStakedExact, currency, lang)}
                  </Text>{' '}
                  · {t('Fin dans')}{' '}
                  <Text style={styles.encoursSumB}>{fmtRemainShort(nearestMs)}</Text>
                </>
              ) : null}
              {sortedOpen.length > 0 && scheduledUp.length > 0 ? ' · ' : null}
              {scheduledUp.length > 0 ? (
                <>
                  {t('Programmé(es)')}{' '}
                  <Text style={styles.encoursSumB}>
                    {money(scheduledStaked, scheduledStakedExact, currency, lang)}
                  </Text>
                  {sortedOpen.length === 0 ? (
                    <>
                      {' '}· {t('Départ dans')}{' '}
                      <Text style={styles.encoursSumB}>{fmtRemainShort(nextSchedMs)}</Text>
                    </>
                  ) : null}
                </>
              ) : null}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              onPress={() => setTradesOpen(false)}
              style={styles.encoursClose}
            >
              <Text style={styles.encoursCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.encoursList}>
          {sortedOpen.map((trade) => (
            <ActiveTradeCard
              key={trade.id}
              trade={trade}
              price={priceOf(trade)}
              currency={currency}
              lang={lang}
              offsetMs={offsetMs}
              t={t}
            />
          ))}
          <ScheduledTrades
            trades={scheduledUp}
            currency={currency}
            lang={lang}
            t={t}
            onCancel={cancelScheduled}
          />
          {sortedOpen.length === 0 && scheduledUp.length === 0 ? (
            <Text style={styles.encoursEmpty}>{t('Aucun trade en cours')}</Text>
          ) : null}
        </View>
      </BottomSheet>

      {/* BottomSheet 5 : Résultat (un à la fois + bouton Rejouer) */}
      <BottomSheet
        open={results.length > 0}
        onClose={() => setResults((prev) => prev.slice(1))}
        title={t('Résultat')}
        header={
          <View style={styles.encoursHead}>
            <Text style={styles.encoursHeadTitle}>{t('Résultat')}</Text>
            <Text style={styles.encoursSum}>
              {t('Solde')}{' '}
              <Text style={styles.encoursSumB}>
                {money(user ? user.balance : 0, user && user.balanceExact, currency, lang)}
              </Text>
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              onPress={() => setResults((prev) => prev.slice(1))}
              style={styles.encoursClose}
            >
              <Text style={styles.encoursCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.sheetSections}>
          {results.length > 1 ? (
            <Text style={styles.moreResults}>
              {results.length > 2
                ? t('+{n} autres résultats après celui-ci', { n: results.length - 1 })
                : t('+{n} autre résultat après celui-ci', { n: results.length - 1 })}
            </Text>
          ) : null}
          {results[0] ? (
            <ResultCard
              trade={results[0]}
              currency={currency}
              lang={lang}
              t={t}
              onReplay={() => handleReplay(results[0])}
            />
          ) : null}
        </View>
      </BottomSheet>

      {/* Premier trade guidé */}
      {showGuide ? <GuideBubbles t={t} onDone={closeGuide} /> : null}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK.fond,
  },
  scroll: {
    flex: 1,
    backgroundColor: INK.fond,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  chartBox: {
    flex: 1,
    minHeight: 140,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    zIndex: 3,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.puce,
    paddingHorizontal: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK.action,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  panel: {
    borderRadius: 12,
    backgroundColor: INK.carte,
    padding: 12,
    gap: 8,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  assetName: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  payout: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.payout,
    fontVariant: ['tabular-nums'],
  },
  boxes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  box: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INK.cadre,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 12,
    justifyContent: 'center',
  },
  boxLabelWrap: {
    position: 'absolute',
    top: -8,
    left: 10,
    zIndex: 2,
    backgroundColor: INK.carte,
    paddingHorizontal: 4,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: INK.doux,
  },
  minBtn: {
    width: '100%',
  },
  minVal: {
    fontSize: 17,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  minSub: {
    fontSize: 11,
    fontWeight: '500',
    color: INK.doux,
    fontVariant: ['tabular-nums'],
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: INK.puce,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  debRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debLabel: {
    fontSize: 13,
    color: INK.doux,
  },
  debDotsWrap: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 4,
  },
  debVal: {
    fontSize: 13,
    fontWeight: '700',
    color: INK.hausse,
    fontVariant: ['tabular-nums'],
  },
  signalBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(46,153,251,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signalText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: INK.texte,
  },
  signalClock: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  lateBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(229,93,79,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lateText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: INK.baisse,
  },
  hintErr: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: INK.baisse,
  },
  goRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goBtn: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goBuy: {
    backgroundColor: INK.hausse,
  },
  goSell: {
    backgroundColor: INK.vente,
  },
  advised: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
  goText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  arrowDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(46,153,251,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  waitTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  waitClock: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  waitBtn: {
    marginTop: 8,
    width: '100%',
  },
  waitNote: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
    color: INK.doux,
  },
  errorBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(229,93,79,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: INK.baisse,
  },
  sheetSections: {
    gap: 10,
    paddingBottom: 8,
  },
  secTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  gridRows: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    flex: 1,
  },
  cellOn: {
    backgroundColor: INK.primary,
  },
  cellOff: {
    backgroundColor: INK.grille,
  },
  cellTextOn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  cellTextOff: {
    fontSize: 14,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  encoursHead: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  encoursHeadTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
  },
  encoursBadge: {
    borderRadius: 999,
    backgroundColor: INK.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  encoursBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  encoursSum: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    color: INK.doux,
  },
  encoursSumB: {
    fontWeight: '700',
    color: INK.texte,
  },
  encoursClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: INK.puce,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encoursCloseText: {
    fontSize: 13,
    color: INK.texte,
  },
  encoursList: {
    gap: 6,
    paddingBottom: 6,
  },
  encoursEmpty: {
    paddingHorizontal: 8,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 12,
    color: INK.doux,
  },
  moreResults: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: INK.doux,
  },
});
