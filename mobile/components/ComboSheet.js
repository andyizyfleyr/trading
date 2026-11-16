// Panneau et carte Combiné (2 à 5 prédictions) : miroir exact de components/ComboSheet.tsx.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { apiPlaceCombo, ApiError } from '../api';
import {
  CURRENCIES,
  compareExact,
  convertToUsdNumber,
  convertUsdToInput,
  decimalToExact,
  localStake,
  money,
  potential,
  stepBetAmount,
} from '../money';
import {
  CONFIG,
  DURATIONS,
  RULES,
  SYMBOLS,
  durationLabel,
  fmtRemainShort,
  fmtTime,
  symbolDisplay,
  useTheme,
  useThemedStyles,
} from '../theme';
import { MinusIcon, PlusIcon } from './Icons';
import { BottomSheet, Btn } from './Ui';

export function comboMultiplier(legsCount) {
  if (legsCount < RULES.COMBO_MIN_LEGS) return 1;
  return Math.pow(1 + RULES.WIN_PAYOUT_RATIO, legsCount);
}

function parseAmount(raw) {
  const cleaned = String(raw || '').replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const ComboCard = React.memo(function ComboCard({ combo, now, currency, lang, t }) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const open = combo.status === 'OPEN';
  const won = combo.result === 'WIN';
  const lost = combo.result === 'LOSS';
  const mult = comboMultiplier(combo.legs.length);
  const multLabel = mult.toFixed(2).replace('.', lang === 'en' ? '.' : ',');

  const right = open
    ? t('En cours')
    : won
      ? `+${money(combo.payout ?? 0, combo.payoutExact, currency, lang)}`
      : lost
        ? `−${money(combo.amount, combo.amountExact, currency, lang)}`
        : '±0';

  const borderLeftColor = open ? ink.doux : won ? ink.hausse : lost ? ink.baisse : ink.doux;
  const rightColor = open ? ink.action : won ? ink.hausse : lost ? ink.baisse : ink.texte;

  return (
    <View style={[styles.card, { borderLeftColor }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleCol}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {t('Combiné · {n} jambes', { n: combo.legs.length })}{' '}
            <Text style={styles.cardMult}>×{multLabel}</Text>
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {t('Mise')}{' '}
            <Text style={styles.cardMetaB}>{money(combo.amount, combo.amountExact, currency, lang)}</Text> ·{' '}
            {fmtTime(combo.createdAt, lang)}
          </Text>
        </View>
        <Text style={[styles.cardRight, { color: rightColor }]}>{right}</Text>
      </View>

      <View style={styles.legsBox}>
        {combo.legs.map((leg) => {
          const sym = SYMBOLS.find((s) => s.id === leg.symbol);
          const isUp = leg.direction === 'UP';
          const legOpen = leg.status === 'OPEN';
          const remain = Math.max(0, new Date(leg.closesAt).getTime() - now);
          const badge = legOpen
            ? t('Fin {x}', { x: fmtRemainShort(remain) })
            : leg.result === 'WIN'
              ? t('Gagnée')
              : leg.result === 'LOSS'
                ? t('Perdue')
                : leg.result === 'VOID'
                  ? t('Annulée')
                  : t('Nul');
          const badgeColor = legOpen
            ? ink.action
            : leg.result === 'WIN'
              ? ink.hausse
              : leg.result === 'LOSS'
                ? ink.baisse
                : ink.doux;
          return (
            <View key={leg.id} style={styles.legRow}>
              <View style={styles.legLeft}>
                <View style={[styles.legDot, { backgroundColor: (sym && sym.color) || ink.doux }]} />
                <Text style={styles.legSym} numberOfLines={1}>
                  {symbolDisplay(leg.symbol)}
                </Text>
                <Text style={styles.legDur}>· {durationLabel(leg.durationSec)}</Text>
                <Text style={[styles.legArrow, { color: isUp ? ink.hausse : ink.baisse }]}>
                  {isUp ? '▲' : '▼'}
                </Text>
              </View>
              <Text style={[styles.legBadge, { color: badgeColor }]}>{badge}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export const ComboSheet = React.memo(function ComboSheet({
  open,
  onClose,
  defaultSymbol,
  user,
  currency,
  lang,
  calm,
  online,
  legs,
  onLegsChange,
  onPlaced,
  t,
}) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pickSym, setPickSym] = useState(defaultSymbol || SYMBOLS[0].id);
  const [pickDur, setPickDur] = useState(CONFIG.DEFAULT_DURATION_SEC);
  const [amountStr, setAmountStr] = useState(() => convertUsdToInput(CONFIG.DEFAULT_BET, currency));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
  const minBetExact = useMemo(() => decimalToExact(RULES.MIN_BET), []);

  const mult = comboMultiplier(legs.length);
  const multStr = mult.toFixed(2).replace('.', lang === 'en' ? '.' : ',');
  const payoutDisplay =
    legs.length >= RULES.COMBO_MIN_LEGS && amountExact
      ? potential(amountStr, currency, legs.length, amountExact, lang)
      : '—';

  const vibrateMs = (ms) => {
    if (calm) return;
    try {
      if (Vibration && typeof Vibration.vibrate === 'function') Vibration.vibrate(ms);
    } catch {
      /* ignore */
    }
  };

  const addLeg = (direction) => {
    setError(null);
    if (legs.length >= RULES.COMBO_MAX_LEGS) {
      setError(t('Maximum {max} prédictions par combiné.', { max: RULES.COMBO_MAX_LEGS }));
      return;
    }
    const dup = legs.some(
      (l) => l.symbol === pickSym && l.durationSec === pickDur && l.direction === direction
    );
    if (dup) {
      setError(t('Deux jambes identiques : ça ne compte pas double.'));
      return;
    }
    const opp = legs.some(
      (l) => l.symbol === pickSym && l.durationSec === pickDur && l.direction !== direction
    );
    if (opp) {
      setError(t("Hausse et Baisse sur le même jeu : combiné perdu d'avance."));
      return;
    }
    onLegsChange([...legs, { symbol: pickSym, direction, durationSec: pickDur }]);
    vibrateMs(CONFIG.VIBRATE.tap);
  };

  const removeLeg = (idx) => {
    setError(null);
    onLegsChange(legs.filter((_, i) => i !== idx));
  };

  const stepBet = (dir) => {
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
  };

  const submit = async () => {
    setError(null);
    if (!online) {
      setError(t('Hors ligne : reconnectez-vous pour jouer.'));
      return;
    }
    if (legs.length < RULES.COMBO_MIN_LEGS || legs.length > RULES.COMBO_MAX_LEGS) {
      setError(t("Un combiné, c'est 2 à 5 prédictions."));
      return;
    }
    if (amountUsd == null || amountUsd <= 0 || !amountExact) {
      setError(t('Entrez un montant de mise.'));
      return;
    }
    if (compareExact(amountExact, minBetExact) < 0) {
      setError(t('La mise minimum est de {min}.', { min: money(RULES.MIN_BET, null, currency, lang) }));
      return;
    }
    const overBal =
      user && user.balanceExact
        ? compareExact(amountExact, user.balanceExact) > 0
        : amountUsd > maxBet;
    if (overBal) {
      setError(t('Solde insuffisant pour cette mise.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPlaceCombo(amountUsd, legs, amountExact);
      vibrateMs(CONFIG.VIBRATE.action);
      onLegsChange([]);
      onPlaced(res.combo, res.balance, res.balanceExact);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Combiné impossible pour le moment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('Combiné (2 à 5 prédictions)')}>
      <View style={styles.sections}>
        <Text style={styles.hint}>
          {legs.length >= RULES.COMBO_MIN_LEGS
            ? t('Toutes les prédictions doivent gagner (cote ×{mult}).', { mult: multStr })
            : t('Ajoute 2 à 5 prédictions pour multiplier tes gains.')}
        </Text>

        {/* 1. Constructeur de jambe */}
        <View style={styles.builder}>
          <Text style={styles.secTitle}>{t('Ajouter une prédiction')}</Text>

          <View style={styles.symRow}>
            {SYMBOLS.map((s) => {
              const on = s.id === pickSym;
              return (
                <TouchableOpacity
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => setPickSym(s.id)}
                  style={[styles.symBtn, on ? styles.pillOn : styles.pillOff]}
                >
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={on ? styles.pillTextOn : styles.pillTextOff} numberOfLines={1}>
                    {s.base}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.durRow}>
            {DURATIONS.map((d) => {
              const on = d === pickDur;
              return (
                <TouchableOpacity
                  key={d}
                  accessibilityRole="button"
                  onPress={() => setPickDur(d)}
                  style={[styles.durBtn, on ? styles.pillOn : styles.pillOff]}
                >
                  <Text style={[styles.durText, on ? styles.pillTextOn : styles.pillTextOff]}>
                    {durationLabel(d)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.dirRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={legs.length >= RULES.COMBO_MAX_LEGS}
              onPress={() => addLeg('UP')}
              style={[
                styles.dirBtn,
                styles.dirBuy,
                legs.length >= RULES.COMBO_MAX_LEGS && styles.disabled,
              ]}
            >
              <Text style={styles.dirBtnText}>{t('+ Hausse ▲')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={legs.length >= RULES.COMBO_MAX_LEGS}
              onPress={() => addLeg('DOWN')}
              style={[
                styles.dirBtn,
                styles.dirSell,
                legs.length >= RULES.COMBO_MAX_LEGS && styles.disabled,
              ]}
            >
              <Text style={styles.dirBtnText}>{t('+ Baisse ▼')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Liste des jambes choisies */}
        <View style={styles.picksBlock}>
          <Text style={styles.secTitle}>
            {t('Ta sélection ({n}/{max})', { n: legs.length, max: RULES.COMBO_MAX_LEGS })}
          </Text>
          {legs.length === 0 ? (
            <View style={styles.emptyLegs}>
              <Text style={styles.emptyLegsText}>
                {t('Ajoute au moins 2 prédictions ci-dessus.')}
              </Text>
            </View>
          ) : (
            <View style={styles.picksList}>
              {legs.map((l, idx) => {
                const sym = SYMBOLS.find((s) => s.id === l.symbol);
                const isUp = l.direction === 'UP';
                return (
                  <View key={`${l.symbol}-${l.durationSec}-${l.direction}-${idx}`} style={styles.pickRow}>
                    <View style={styles.pickLeft}>
                      <View style={[styles.dot, { backgroundColor: (sym && sym.color) || ink.doux }]} />
                      <Text style={styles.pickSym} numberOfLines={1}>
                        {symbolDisplay(l.symbol)}
                      </Text>
                      <Text style={styles.pickDur}>· {durationLabel(l.durationSec)}</Text>
                      <View style={[styles.pickBadge, isUp ? styles.dirUpBg : styles.dirDownBg]}>
                        <Text style={[styles.pickBadgeText, { color: isUp ? ink.hausse : ink.baisse }]}>
                          {isUp ? t('Hausse ▲') : t('Baisse ▼')}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('Fermer')}
                      onPress={() => removeLeg(idx)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 3. Mise + Cote + Gain potentiel */}
        <View style={styles.stakeBox}>
          <View style={styles.stakeLabelWrap}>
            <Text style={styles.stakeLabel}>
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
              <MinusIcon size={14} color={ink.texte} />
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
              <PlusIcon size={14} color={ink.texte} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('Cote totale')}</Text>
            <Text style={styles.summaryMult}>×{multStr}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('Gain potentiel')}</Text>
            <Text style={styles.summaryGain}>{payoutDisplay}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Btn
          onPress={submit}
          disabled={submitting || legs.length < RULES.COMBO_MIN_LEGS}
          style={styles.submitBtn}
        >
          {submitting ? '…' : t('Valider le combiné ({n})', { n: legs.length })}
        </Btn>
      </View>
    </BottomSheet>
  );
});

const makeStyles = (INK) =>
  StyleSheet.create({
    card: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: INK.ligne,
      borderLeftWidth: 3,
      backgroundColor: INK.fond,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitleCol: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: INK.texte,
    },
    cardMult: {
      fontWeight: '700',
      color: INK.payout,
    },
    cardMeta: {
      marginTop: 2,
      fontSize: 11,
      color: INK.doux,
      fontVariant: ['tabular-nums'],
    },
    cardMetaB: {
      fontWeight: '600',
      color: INK.texte,
    },
    cardRight: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    legsBox: {
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: INK.ligne,
      gap: 4,
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    legLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legSym: {
      fontSize: 11,
      fontWeight: '700',
      color: INK.texte,
    },
    legDur: {
      fontSize: 11,
      color: INK.doux,
    },
    legArrow: {
      fontSize: 11,
      fontWeight: '800',
    },
    legBadge: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    sections: {
      gap: 10,
      paddingBottom: 8,
    },
    hint: {
      fontSize: 12,
      color: INK.doux,
    },
    builder: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: INK.ligne,
      backgroundColor: INK.fond,
      padding: 10,
      gap: 8,
    },
    secTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: INK.texte,
    },
    symRow: {
      flexDirection: 'row',
      gap: 6,
    },
    symBtn: {
      flex: 1,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 6,
    },
    durRow: {
      flexDirection: 'row',
      gap: 4,
    },
    durBtn: {
      flex: 1,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durText: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    pillOn: {
      borderColor: INK.primary,
      backgroundColor: INK.primary,
    },
    pillOff: {
      borderColor: INK.ligne,
      backgroundColor: INK.carte,
    },
    pillTextOn: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    pillTextOff: {
      fontSize: 12,
      fontWeight: '700',
      color: INK.texte,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dirRow: {
      flexDirection: 'row',
      gap: 8,
    },
    dirBtn: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dirBuy: {
      backgroundColor: INK.hausse,
    },
    dirSell: {
      backgroundColor: INK.vente,
    },
    dirBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    disabled: {
      opacity: 0.45,
    },
    picksBlock: {
      gap: 6,
    },
    emptyLegs: {
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: INK.ligne,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    emptyLegsText: {
      textAlign: 'center',
      fontSize: 12,
      color: INK.doux,
    },
    picksList: {
      gap: 5,
    },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: INK.ligne,
      backgroundColor: INK.fond,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    pickLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pickSym: {
      fontSize: 12,
      fontWeight: '700',
      color: INK.texte,
    },
    pickDur: {
      fontSize: 12,
      color: INK.doux,
    },
    pickBadge: {
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    dirUpBg: {
      backgroundColor: 'rgba(12,175,86,0.15)',
    },
    dirDownBg: {
      backgroundColor: 'rgba(229,93,79,0.15)',
    },
    pickBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: INK.puce,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: INK.texte,
    },
    stakeBox: {
      position: 'relative',
      overflow: 'visible',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: INK.cadre,
      paddingHorizontal: 8,
      paddingBottom: 8,
      paddingTop: 12,
      marginTop: 4,
    },
    stakeLabelWrap: {
      position: 'absolute',
      top: -8,
      left: 10,
      zIndex: 2,
      backgroundColor: INK.carte,
      paddingHorizontal: 4,
    },
    stakeLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: INK.doux,
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
    summaryBlock: {
      gap: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryLabel: {
      fontSize: 13,
      color: INK.doux,
    },
    summaryMult: {
      fontSize: 13,
      fontWeight: '800',
      color: INK.payout,
      fontVariant: ['tabular-nums'],
    },
    summaryGain: {
      fontSize: 13,
      fontWeight: '700',
      color: INK.hausse,
      fontVariant: ['tabular-nums'],
    },
    errorBox: {
      borderRadius: 12,
      backgroundColor: 'rgba(229,93,79,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    errorText: {
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '500',
      color: INK.baisse,
    },
    submitBtn: {
      width: '100%',
    },
  });
