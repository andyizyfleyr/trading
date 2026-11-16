// Cartes En cours, Résultat, Mises programmées et Sélecteur d'heure : miroir exact du web.
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { exactGain, money } from '../money';
import {
  CONFIG,
  RING_CFG,
  RULES,
  durationLabel,
  fmtGamePrice,
  fmtHM,
  fmtHM24,
  fmtSigned,
  fmtSlot,
  symbolDisplay,
  useTheme,
  useThemedStyles,
} from '../theme';
import { Btn, CountdownRing } from './Ui';

function slotOf(trade) {
  return Math.floor(new Date(trade.openedAt).getTime() / 1000);
}

/* ---------- Prédiction en cours (identique à ENCOURS.card) ---------- */

export const ActiveTradeCard = React.memo(function ActiveTradeCard({
  trade,
  price,
  currency,
  lang,
  offsetMs,
  t,
}) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isUp = trade.direction === 'UP';
  const diff = price == null ? null : price - trade.openPrice;
  const score = diff == null ? 0 : diff * (isUp ? 1 : -1);
  const winning = score > 0 ? true : score < 0 ? false : null;

  const borderLeftColor = winning == null ? ink.doux : winning ? ink.hausse : ink.baisse;
  const toneColor = winning == null ? ink.texte : winning ? ink.hausse : ink.baisse;
  const arrow = diff == null || diff === 0 ? '' : diff > 0 ? '▲ ' : '▼ ';

  const gainExact = trade.amountExact ? exactGain(trade.amountExact) : undefined;
  const est =
    winning == null
      ? '='
      : winning
        ? `+${money(trade.amount * (1 + RULES.WIN_PAYOUT_RATIO), gainExact, currency, lang)}`
        : `−${money(trade.amount, trade.amountExact, currency, lang)}`;

  return (
    <View style={[styles.encoursCard, { borderLeftColor }]}>
      <CountdownRing
        closesAt={trade.closesAt}
        durationSec={trade.durationSec}
        offsetMs={offsetMs}
        t={t}
        size={RING_CFG.mini}
        compact
      />
      <View style={styles.encoursMid}>
        <View style={styles.encoursMid1}>
          <View style={[styles.dirBadge, isUp ? styles.dirUpBg : styles.dirDownBg]}>
            <Text style={[styles.dirBadgeText, isUp ? styles.textWin : styles.textLoss]}>
              {isUp ? t('Hausse ▲') : t('Baisse ▼')}
            </Text>
          </View>
          <Text style={styles.encoursName} numberOfLines={1}>
            {symbolDisplay(trade.symbol)} · {durationLabel(trade.durationSec)}
          </Text>
        </View>
        <Text style={styles.encoursMid2} numberOfLines={1}>
          {t('Mise')}{' '}
          <Text style={styles.encoursMid2B}>{money(trade.amount, trade.amountExact, currency, lang)}</Text> ·{' '}
          {t('Départ')}{' '}
          <Text style={styles.encoursMid2B}>{fmtGamePrice(trade.symbol, trade.openPrice, lang)}</Text>
        </Text>
      </View>
      <View style={styles.encoursRight}>
        <Text style={[styles.encoursCur, { color: toneColor }]}>
          {price == null ? '…' : `${arrow}${fmtGamePrice(trade.symbol, price, lang)}`}
        </Text>
        <Text style={[styles.encoursEst, { color: toneColor }]}>{est}</Text>
      </View>
    </View>
  );
});

/* ---------- Résultat (identique à RESULT) ---------- */

export const ResultCard = React.memo(function ResultCard({ trade, currency, lang, t, onReplay }) {
  const styles = useThemedStyles(makeStyles);
  const isUp = trade.direction === 'UP';
  const won = trade.result === 'WIN';
  const lost = trade.result === 'LOSS';
  const move = trade.closePrice == null ? null : trade.closePrice - trade.openPrice;

  const title = won
    ? t('Prédiction gagnée')
    : lost
      ? t('Prédiction ratée')
      : t('Égalité : mise rendue');
  const amount = won
    ? `+${money(trade.payout ?? 0, trade.payoutExact, currency, lang)}`
    : lost
      ? `−${money(trade.amount, trade.amountExact, currency, lang)}`
      : fmtSigned(0, lang);
  const moveArrow = move == null || move === 0 ? '' : move > 0 ? '▲ ' : '▼ ';

  return (
    <View>
      <View
        style={[
          styles.resultBox,
          won ? styles.resultBoxWin : lost ? styles.resultBoxLoss : styles.resultBoxTie,
        ]}
      >
        <View style={styles.resultTop}>
          <View
            style={[
              styles.resultIcon,
              won ? styles.resultIconWin : lost ? styles.resultIconLoss : styles.resultIconTie,
            ]}
          >
            <Text
              style={[
                styles.resultIconText,
                won ? styles.textWin : lost ? styles.textLoss : styles.textMuted,
              ]}
            >
              {won ? '✓' : lost ? '✕' : '='}
            </Text>
          </View>
          <View style={styles.resultTitleCol}>
            <Text style={styles.resultTitle}>{title}</Text>
            <Text style={styles.resultSub}>
              {isUp ? t('Hausse ▲') : t('Baisse ▼')} · {symbolDisplay(trade.symbol)} ·{' '}
              {durationLabel(trade.durationSec)}
            </Text>
          </View>
          <Text
            style={[
              styles.resultAmt,
              won ? styles.textWin : lost ? styles.textLoss : styles.textFlat,
            ]}
          >
            {amount}
          </Text>
        </View>
        <View style={styles.resultMove}>
          <Text style={styles.resultMoveText}>
            {t('Départ')}{' '}
            <Text style={styles.resultMoveB}>{fmtGamePrice(trade.symbol, trade.openPrice, lang)}</Text>
          </Text>
          <Text style={styles.resultMoveText}>→</Text>
          <Text style={styles.resultMoveText}>
            {t('Arrivée')}{' '}
            <Text style={styles.resultMoveB}>
              {trade.closePrice != null ? fmtGamePrice(trade.symbol, trade.closePrice, lang) : '…'}
            </Text>
          </Text>
          <Text style={[styles.resultMoveText, styles.resultMoveFar]}>
            {move == null ? '…' : `${moveArrow}${fmtGamePrice(trade.symbol, Math.abs(move), lang)}`}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={onReplay}
        style={styles.replayBtn}
      >
        <Text style={styles.replayBtnText}>
          {t('Rejouer')} · {money(trade.amount, trade.amountExact, currency, lang)} {isUp ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

/* ---------- Mises programmées (identique à TRADER.soon*) ---------- */

export const ScheduledTrades = React.memo(function ScheduledTrades({
  trades,
  currency,
  lang,
  t,
  onCancel,
}) {
  const styles = useThemedStyles(makeStyles);
  if (!trades || trades.length === 0) return null;
  return (
    <View style={styles.soonBox}>
      <Text style={styles.soonTitle}>
        {trades.length > 1
          ? t('Programmées ({n}/{max})', { n: trades.length, max: RULES.MAX_SCHEDULED })
          : t('Programmé ({n}/{max})', { n: trades.length, max: RULES.MAX_SCHEDULED })}
      </Text>
      <View style={styles.soonList}>
        {trades.map((trade) => {
          const slot = slotOf(trade);
          return (
            <View key={trade.id} style={styles.soonRow}>
              <Text style={styles.soonMain} numberOfLines={1}>
                {trade.direction === 'UP' ? t('Hausse ▲') : t('Baisse ▼')}{' '}
                {money(trade.amount, trade.amountExact, currency, lang)}{' '}
                <Text style={styles.soonSub}>
                  {symbolDisplay(trade.symbol)} {t('à')} {fmtHM(slot)}
                </Text>
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('Annuler la mise programmée à {hm} (remboursée)', {
                  hm: fmtSlot(slot),
                })}
                onPress={() => onCancel(trade.id)}
                style={styles.soonX}
              >
                <Text style={styles.soonXText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
});

/* ---------- Sélecteur d'heure (identique à components/TimePicker.tsx) ---------- */

function parseHM(v) {
  const m = /^(\d{2})[:h](\d{2})$/.exec(v || '');
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function nextOccurrence(hour, minute, fromMs) {
  const d = new Date(fromMs);
  d.setHours(hour, minute, 0, 0);
  let slot = Math.floor(d.getTime() / 1000);
  if (slot * 1000 <= fromMs) slot += 24 * 3600;
  return slot;
}

function isNextDay(slot, fromMs) {
  return new Date(slot * 1000).getDate() !== new Date(fromMs).getDate();
}

export function chunkRows(items, cols) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

export const TimePickerPanel = React.memo(function TimePickerPanel({
  value,
  nowMs,
  onChange,
  onConfirm,
  t,
}) {
  const styles = useThemedStyles(makeStyles);
  const { list, selected } = useMemo(() => {
    const step = CONFIG.TIME_SLOT_STEP_MIN * 60;
    const first = Math.ceil((nowMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS) / (step * 1000)) * step;
    const slots = Array.from({ length: CONFIG.TIME_SLOT_COUNT }, (_, i) => first + i * step);
    const preset = parseHM(value);
    const sel = preset ? nextOccurrence(preset.hour, preset.minute, nowMs) : null;
    if (sel != null && !slots.includes(sel)) {
      slots.push(sel);
      slots.sort((a, b) => a - b);
    }
    return { list: slots, selected: sel };
  }, [value, nowMs]);

  const selectedTomorrow = selected != null && isNextDay(selected, nowMs);
  const toggle = (slot) => onChange(slot === selected ? '' : fmtHM24(slot));
  const rows = chunkRows(list, 3);

  return (
    <View style={styles.pickerWrap}>
      <View style={styles.gridRows}>
        {rows.map((row, rIdx) => (
          <View key={rIdx} style={styles.gridRow}>
            {row.map((s) => {
              const active = s === selected;
              return (
                <TouchableOpacity
                  key={s}
                  accessibilityRole="button"
                  onPress={() => toggle(s)}
                  style={[styles.cell, active ? styles.cellOn : styles.cellOff]}
                >
                  <Text style={active ? styles.cellTextOn : styles.cellTextOff}>{fmtHM(s)}</Text>
                </TouchableOpacity>
              );
            })}
            {row.length < 3
              ? Array.from({ length: 3 - row.length }, (_, k) => <View key={`e-${k}`} style={styles.cellEmpty} />)
              : null}
          </View>
        ))}
      </View>
      <Btn onPress={onConfirm} style={styles.confirmBtn}>
        {value === '' || selected == null
          ? t('Revenir à Maintenant')
          : selectedTomorrow
            ? t('Valider demain {hm} →', { hm: fmtHM(selected) })
            : t('Valider {hm} →', { hm: fmtHM(selected) })}
      </Btn>
    </View>
  );
});

const makeStyles = (INK) =>
  StyleSheet.create({
    encoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INK.ligne,
    borderLeftWidth: 3,
    backgroundColor: INK.fond,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  encoursMid: {
    flex: 1,
    minWidth: 0,
  },
  encoursMid1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dirBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dirUpBg: {
    backgroundColor: 'rgba(12,175,86,0.15)',
  },
  dirDownBg: {
    backgroundColor: 'rgba(229,93,79,0.15)',
  },
  dirBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  encoursName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: INK.texte,
  },
  encoursMid2: {
    marginTop: 4,
    fontSize: 11,
    color: INK.doux,
  },
  encoursMid2B: {
    fontWeight: '600',
    color: INK.texte,
  },
  encoursRight: {
    alignItems: 'flex-end',
  },
  encoursCur: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  encoursEst: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  textWin: {
    color: INK.hausse,
  },
  textLoss: {
    color: INK.baisse,
  },
  textFlat: {
    color: INK.texte,
  },
  textMuted: {
    color: INK.doux,
  },
  resultBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    borderLeftWidth: 3,
    backgroundColor: INK.fond,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultBoxWin: {
    borderLeftColor: INK.hausse,
    backgroundColor: 'rgba(12,175,86,0.08)',
  },
  resultBoxLoss: {
    borderLeftColor: INK.baisse,
    backgroundColor: 'rgba(229,93,79,0.09)',
  },
  resultBoxTie: {
    borderLeftColor: INK.doux,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconWin: {
    backgroundColor: 'rgba(12,175,86,0.18)',
  },
  resultIconLoss: {
    backgroundColor: 'rgba(229,93,79,0.18)',
  },
  resultIconTie: {
    backgroundColor: INK.puce,
  },
  resultIconText: {
    fontSize: 15,
    fontWeight: '800',
  },
  resultTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: INK.texte,
  },
  resultSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '500',
    color: INK.doux,
  },
  resultAmt: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  resultMove: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: INK.ligne,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultMoveText: {
    fontSize: 11,
    color: INK.doux,
    fontVariant: ['tabular-nums'],
  },
  resultMoveB: {
    fontWeight: '600',
    color: INK.texte,
  },
  resultMoveFar: {
    marginLeft: 'auto',
  },
  replayBtn: {
    marginTop: 8,
    height: 42,
    borderRadius: 10,
    backgroundColor: INK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  soonBox: {
    borderRadius: 12,
    backgroundColor: INK.fond,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  soonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  soonList: {
    marginTop: 6,
    gap: 6,
  },
  soonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  soonMain: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  soonSub: {
    fontWeight: '500',
    color: INK.doux,
  },
  soonX: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonXText: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.doux,
  },
  pickerWrap: {
    gap: 10,
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
  confirmBtn: {
    width: '100%',
  },
});
