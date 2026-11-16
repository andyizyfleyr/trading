// Écran Historique : miroir exact de app/historique/page.tsx.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiMyStats, apiMyTrades, apiSettle, ApiError } from '../api';
import { absExact, addExact, money, subtractExact } from '../money';
import {
  CONFIG,
  SYMBOLS,
  durationLabel,
  fmtDateTime,
  fmtDay,
  fmtGamePrice,
  fmtRemainShort,
  fmtTime,
  symbolDisplay,
  useTheme,
  useThemedStyles,
} from '../theme';
import { ChevronDownIcon } from '../components/Icons';
import { ErrorState, SelectSheet, Skeleton } from '../components/Ui';

const FILTERS = ['all', 'open', 'settled'];

const TradeRow = React.memo(function TradeRow({ trade, now, currency, lang, t }) {
  const styles = useThemedStyles(makeStyles);
  const isUp = trade.direction === 'UP';
  const open = trade.status === 'OPEN';
  const won = trade.result === 'WIN';
  const lost = trade.result === 'LOSS';
  const gain = won ? (trade.payout ?? 0) : 0;

  const right = open
    ? t('Fin {x}', { x: fmtRemainShort(new Date(trade.closesAt).getTime() - now) })
    : won
      ? `+${money(gain, trade.payoutExact, currency, lang)}`
      : lost
        ? `−${money(trade.amount, trade.amountExact, currency, lang)}`
        : '±0';

  return (
    <View style={styles.hrow}>
      <View
        style={[
          styles.hicon,
          won ? styles.hiconWin : lost ? styles.hiconLoss : null,
        ]}
      >
        <Text
          style={[
            styles.hiconText,
            won ? styles.textWin : lost ? styles.textLoss : null,
          ]}
        >
          {isUp ? '▲' : '▼'}
        </Text>
      </View>

      <View style={styles.hmid}>
        <Text style={styles.hmidTitle} numberOfLines={1}>
          {symbolDisplay(trade.symbol)}{' '}
          <Text style={styles.hsub}>· {durationLabel(trade.durationSec)}</Text>
        </Text>
        <Text style={styles.hmeta} numberOfLines={1}>
          {t('Mise')} {money(trade.amount, trade.amountExact, currency, lang)} ·{' '}
          {fmtGamePrice(trade.symbol, trade.openPrice, lang)} →{' '}
          {trade.closePrice != null ? fmtGamePrice(trade.symbol, trade.closePrice, lang) : '…'}
        </Text>
      </View>

      <View style={styles.hrightWrap}>
        <Text
          style={[
            styles.hright,
            open
              ? styles.hrightRun
              : won
                ? styles.textWin
                : lost
                  ? styles.textLoss
                  : null,
          ]}
        >
          {right}
        </Text>
        <Text style={styles.htime}>{fmtTime(trade.openedAt, lang)}</Text>
      </View>
    </View>
  );
});

export const HistoriqueScreen = React.memo(function HistoriqueScreen({
  currency,
  lang,
  calm,
  offsetMs,
  t,
  isActive = true,
  onBalance,
  onRefresh,
}) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [filter, setFilter] = useState('all');
  const [asset, setAsset] = useState('all');
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [exported, setExported] = useState('idle');

  const loadingRef = useRef(false);
  const queuedRef = useRef(false);
  const assetRef = useRef(asset);
  assetRef.current = asset;
  const exportTimerRef = useRef(null);
  const retryRef = useRef(new Map());

  const serverNow = now + (offsetMs || 0);

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts && opts.silent);
    if (loadingRef.current) {
      queuedRef.current = true;
      return;
    }
    loadingRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      do {
        queuedRef.current = false;
        const scope = assetRef.current;
        try {
          const s = await apiSettle();
          if (s && onBalance) onBalance(s.balance, s.balanceExact);
        } catch {
          /* affiche l'historique malgré tout */
        }
        const res = await apiMyTrades('all', CONFIG.HISTORY_LIMIT);
        setTrades((res && res.trades) || []);
        try {
          const stRes = await apiMyStats(scope === 'all' ? undefined : scope);
          if (scope === assetRef.current) setStats((stRes && stRes.stats) || null);
        } catch {
          if (scope === assetRef.current) setStats(null);
        }
      } while (queuedRef.current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Historique indisponible.'));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [onBalance, t]);

  const handlePullRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        load({ silent: true }),
        onRefresh ? onRefresh() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, load, onRefresh]);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    load({ silent: hasLoadedRef.current });
    hasLoadedRef.current = true;
  }, [load, asset, isActive]);

  const hasOpenTrades = useMemo(
    () => trades.some((tr) => tr.status === 'OPEN'),
    [trades]
  );

  useEffect(() => {
    if (!isActive || !hasOpenTrades) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CONFIG.SETTLE_TICK_MS);
    return () => clearInterval(timer);
  }, [isActive, hasOpenTrades]);

  // Clôture automatique des trades ouverts arrivés à échéance.
  useEffect(() => {
    if (!isActive || !hasOpenTrades) return undefined;
    const openIds = new Set(trades.filter((tr) => tr.status === 'OPEN').map((tr) => tr.id));
    retryRef.current.forEach((_, id) => {
      if (!openIds.has(id)) retryRef.current.delete(id);
    });
    const due = trades.filter(
      (tr) =>
        tr.status === 'OPEN' &&
        new Date(tr.closesAt).getTime() <= serverNow &&
        (retryRef.current.get(tr.id) ?? 0) <= serverNow
    );
    if (due.length === 0) return undefined;
    due.forEach((tr) => retryRef.current.set(tr.id, serverNow + CONFIG.SETTLE_RETRY_MS));
    let cancelled = false;
    (async () => {
      try {
        const res = await apiSettle(due.map((tr) => tr.id));
        if (!cancelled && res && res.settled && res.settled.length > 0) {
          load({ silent: true });
        }
      } catch {
        /* réessaiera plus tard */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isActive, hasOpenTrades, serverNow, trades, load]);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  const { visible, finished, settledCount, winRate, net, netText, groups } = useMemo(() => {
    const vis = trades
      .filter(
        (tr) =>
          (filter === 'all' ? true : filter === 'open' ? tr.status === 'OPEN' : tr.status === 'SETTLED') &&
          (asset === 'all' || tr.symbol === asset)
      )
      .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));

    const fin = trades.filter(
      (tr) => tr.status === 'SETTLED' && (asset === 'all' || tr.symbol === asset)
    );
    const localWins = fin.filter((tr) => tr.result === 'WIN').length;
    const wonAmount = fin
      .filter((tr) => tr.result === 'WIN')
      .reduce((sum, tr) => sum + ((tr.payout ?? 0) - tr.amount), 0);
    const lostAmount = fin
      .filter((tr) => tr.result === 'LOSS')
      .reduce((sum, tr) => sum + ((tr.payout ?? 0) - tr.amount), 0);

    const sCount = stats ? stats.settled : fin.length;
    const wRate = stats
      ? stats.winRate
      : fin.length === 0
        ? 0
        : Math.round((localWins / fin.length) * 100);
    const netVal = stats ? stats.pnl : wonAmount + lostAmount;

    let fallbackExact = { numerator: '0', denominator: '1' };
    let hasExact = true;
    for (const tr of fin) {
      if (tr.result !== 'WIN' && tr.result !== 'LOSS') continue;
      if (!tr.amountExact || !tr.payoutExact) {
        hasExact = false;
        break;
      }
      const diff = subtractExact(tr.payoutExact, tr.amountExact);
      if (!diff) {
        hasExact = false;
        break;
      }
      fallbackExact = addExact(fallbackExact, diff);
    }
    const netExact = (stats && stats.pnlExact) || (hasExact ? fallbackExact : undefined);
    const nText =
      netVal > 0
        ? `+${money(netVal, netExact, currency, lang)}`
        : netVal < 0
          ? `−${money(Math.abs(netVal), absExact(netExact), currency, lang)}`
          : money(0, null, currency, lang);

    const grp = [];
    for (const tr of vis) {
      const day = fmtDay(tr.openedAt, lang);
      const last = grp[grp.length - 1];
      if (last && last.day === day) last.rows.push(tr);
      else grp.push({ day, rows: [tr] });
    }

    return {
      visible: vis,
      finished: fin,
      settledCount: sCount,
      winRate: wRate,
      net: netVal,
      netText: nText,
      groups: grp,
    };
  }, [trades, filter, asset, stats, currency, lang]);

  const assetOptions = useMemo(
    () => [
      { value: 'all', label: t('Tous les jeux') },
      ...SYMBOLS.map((s) => ({
        value: s.id,
        label: symbolDisplay(s.id),
        color: s.color,
      })),
    ],
    [t]
  );

  const exportCsv = async () => {
    const done = trades.filter((tr) => tr.status === 'SETTLED');
    const lines = done.map((tr) =>
      [
        symbolDisplay(tr.symbol),
        durationLabel(tr.durationSec),
        tr.direction === 'UP' ? 'hausse' : 'baisse',
        String(tr.amount),
        String(tr.openPrice),
        tr.closePrice != null ? String(tr.closePrice) : '',
        tr.result === 'WIN' ? 'gagne' : tr.result === 'LOSS' ? 'perdu' : 'nul',
        fmtDateTime(tr.openedAt),
      ].join(CONFIG.CSV.sep)
    );
    try {
      await Share.share({ message: [CONFIG.CSV.header, ...lines].join('\n') });
      setExported('copied');
    } catch {
      setExported('error');
    }
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => setExported('idle'), CONFIG.COPIED_MS);
  };

  const assetLabel = asset === 'all' ? t('Tous les jeux') : symbolDisplay(asset);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={ink.action}
          colors={[ink.action, ink.hausse]}
          progressBackgroundColor={ink.carte}
        />
      }
    >
      {/* En-tête compacte : titre + Exporter + ↻ */}
      <View style={styles.head}>
        <Text style={styles.title}>{t('Historique')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={finished.length === 0}
          onPress={exportCsv}
          style={[styles.exportBtn, finished.length === 0 && styles.disabled]}
        >
          <Text style={styles.exportText}>
            {t(exported === 'copied' ? 'Copié ✓' : exported === 'error' ? 'Erreur' : 'Exporter')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('Actualiser')}
          onPress={load}
          style={styles.iconBtn}
        >
          <Text style={styles.iconBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Bandeau 3 statistiques */}
      <View style={styles.stats}>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statNum}>{settledCount}</Text>
          <Text style={styles.statLabel}>{t('Terminés')}</Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statNum}>{winRate} %</Text>
          <Text style={styles.statLabel}>{t('Réussite')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, net >= 0 ? styles.textWin : styles.textLoss]} numberOfLines={1}>
            {netText}
          </Text>
          <Text style={styles.statLabel}>{t('Net')}</Text>
        </View>
      </View>

      {/* Filtres : sélecteur de jeu + onglets Toutes / En cours / Terminées */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('Filtrer par jeu')}
          onPress={() => setAssetSheetOpen(true)}
          style={styles.selectBtn}
        >
          <Text style={styles.selectText} numberOfLines={1}>
            {assetLabel}
          </Text>
          <ChevronDownIcon size={14} color={ink.doux} />
        </TouchableOpacity>

        <View style={styles.chipsBox}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                accessibilityRole="button"
                onPress={() => setFilter(f)}
                style={[styles.chip, active && styles.chipOn]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]} numberOfLines={1}>
                  {t(f === 'all' ? 'Toutes' : f === 'open' ? 'En cours' : 'Terminées')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.skelList}>
          <Skeleton calm={calm} style={styles.skel} />
          <Skeleton calm={calm} style={styles.skel} />
          <Skeleton calm={calm} style={styles.skel} />
          <Skeleton calm={calm} style={styles.skel} />
        </View>
      ) : error ? (
        <ErrorState text={error} retry={load} retryLabel={t('Réessayer')} />
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>{t('Aucun trade')}</Text>
      ) : (
        <View style={styles.grid}>
          {groups.map((g) => (
            <View key={g.day} style={styles.grid}>
              <Text style={styles.group}>{g.day}</Text>
              {g.rows.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  now={trade.status === 'OPEN' ? serverNow : 0}
                  currency={currency}
                  lang={lang}
                  t={t}
                />
              ))}
            </View>
          ))}
          {trades.length >= CONFIG.HISTORY_LIMIT ? (
            <Text style={styles.capped}>
              {t('Les {n} derniers affichés : les statistiques, elles, comptent tout.', {
                n: CONFIG.HISTORY_LIMIT,
              })}
            </Text>
          ) : null}
        </View>
      )}

      {/* BottomSheet choix du jeu */}
      <SelectSheet
        open={assetSheetOpen}
        onClose={() => setAssetSheetOpen(false)}
        title={t('Filtrer par jeu')}
        options={assetOptions}
        selectedValue={asset}
        onSelect={setAsset}
      />
    </ScrollView>
  );
});

const makeStyles = (INK) =>
  StyleSheet.create({
    scroll: {
    flex: 1,
    backgroundColor: INK.fond,
  },
  root: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    marginRight: 'auto',
    fontSize: 16,
    fontWeight: '800',
    color: INK.texte,
  },
  exportBtn: {
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK.texte,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 14,
    color: INK.texte,
  },
  disabled: {
    opacity: 0.5,
  },
  stats: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingVertical: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: INK.ligne,
  },
  statNum: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: INK.doux,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  selectBtn: {
    flex: 1.1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: INK.texte,
  },
  chipsBox: {
    flex: 2,
    height: 32,
    flexDirection: 'row',
    gap: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    padding: 2,
  },
  chip: {
    flex: 1,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: INK.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  chipTextOff: {
    color: INK.doux,
  },
  skelList: {
    gap: 8,
  },
  skel: {
    height: 64,
  },
  empty: {
    paddingHorizontal: 8,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 12,
    color: INK.doux,
  },
  grid: {
    gap: 5,
  },
  group: {
    paddingHorizontal: 2,
    paddingTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: INK.doux,
  },
  hrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hicon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: INK.puce,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiconWin: {
    backgroundColor: 'rgba(12,175,86,0.15)',
  },
  hiconLoss: {
    backgroundColor: 'rgba(229,93,79,0.15)',
  },
  hiconText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK.doux,
  },
  hmid: {
    flex: 1,
    minWidth: 0,
  },
  hmidTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: INK.texte,
  },
  hsub: {
    fontWeight: '500',
    color: INK.doux,
  },
  hmeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '500',
    color: INK.doux,
    fontVariant: ['tabular-nums'],
  },
  hrightWrap: {
    alignItems: 'flex-end',
  },
  hright: {
    fontSize: 13,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  hrightRun: {
    color: INK.action,
  },
  htime: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '500',
    color: INK.doux,
  },
  textWin: {
    color: INK.hausse,
  },
  textLoss: {
    color: INK.baisse,
  },
  capped: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
    color: INK.doux,
  },
});
