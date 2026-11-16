// Écran Signaux : miroir exact de app/predictions/page.tsx.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { otcPriceAt } from '../otc';
import { CONFIG, DURATIONS, SYMBOLS, durationLabel, fmtRemain, fmtSlot, useTheme, useThemedStyles } from '../theme';
import { SignalIcon } from '../components/Icons';
import { Btn, EmptyState, ErrorState, Skeleton } from '../components/Ui';

const GAMES = SYMBOLS.filter((s) => s.kind === 'otc');

function getVerdict(symbol, fromSec, durationSec) {
  const from = otcPriceAt(symbol, fromSec);
  const to = otcPriceAt(symbol, fromSec + durationSec);
  return to > from ? 'UP' : to < from ? 'DOWN' : 'TIE';
}

function verdictLabel(v, t) {
  return v === 'UP' ? t('Hausse ▲') : v === 'DOWN' ? t('Baisse ▼') : t('Égalité =');
}

function computeFirstSlot(serverNowMs) {
  return Math.floor((serverNowMs + CONFIG.TIME_SLOT_BOOK_MARGIN_MS) / 60000 + 1) * 60;
}

/** Seul bloc qui avance seconde par seconde : évite de rerendre les 20 lignes à chaque tick. */
const SignalLiveMeter = React.memo(function SignalLiveMeter({
  targetStart,
  offsetMs,
  isActive,
  onSlotAdvance,
}) {
  const styles = useThemedStyles(makeStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (onSlotAdvance) onSlotAdvance(n);
    }, 250);
    return () => clearInterval(timer);
  }, [isActive, onSlotAdvance]);

  const serverNowMs = now + (offsetMs ?? 0);
  const remainingMs = Math.max(0, targetStart * 1000 - serverNowMs);
  const spanStartMs = (targetStart - 60) * 1000;
  const spanMs = Math.max(1, targetStart * 1000 - spanStartMs);
  const elapsedPct = Math.min(100, Math.max(0, ((serverNowMs - spanStartMs) / spanMs) * 100));

  return (
    <>
      <Text style={styles.countdown}>
        {remainingMs < CONFIG.GO_THRESHOLD_MS ? 'GO !' : fmtRemain(remainingMs)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${elapsedPct.toFixed(1)}%` }]} />
      </View>
    </>
  );
});

export const SignauxScreen = React.memo(function SignauxScreen({
  offsetMs,
  online,
  calm,
  t,
  isActive = true,
  onPrepare,
  onRetrySync,
  onRefresh,
}) {
  const { ink } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [gameId, setGameId] = useState(GAMES[0] ? GAMES[0].id : '');
  const [duration, setDuration] = useState(CONFIG.DEFAULT_DURATION_SEC);
  const [firstSlot, setFirstSlot] = useState(() => computeFirstSlot(Date.now() + (offsetMs ?? 0)));
  const [refreshing, setRefreshing] = useState(false);

  const game = GAMES.find((g) => g.id === gameId) || GAMES[0];

  const syncSlot = useCallback(
    (nowMs) => {
      const next = computeFirstSlot(nowMs + (offsetMs ?? 0));
      setFirstSlot((prev) => (prev === next ? prev : next));
    },
    [offsetMs]
  );

  useEffect(() => {
    if (isActive) syncSlot(Date.now());
  }, [isActive, syncSlot]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      else if (onRetrySync) await onRetrySync();
      syncSlot(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, onRefresh, onRetrySync, syncSlot]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={ink.action}
      colors={[ink.action, ink.hausse]}
      progressBackgroundColor={ink.carte}
    />
  );

  const slots = useMemo(() => {
    if (offsetMs == null || !game) return [];
    return Array.from({ length: CONFIG.SIGNAL_SLOT_COUNT }, (_, i) => {
      const start = firstSlot + i * 60;
      return { start, v: getVerdict(game.id, start, duration) };
    });
  }, [offsetMs, firstSlot, game, duration]);

  const target = slots.find((s) => s.v !== 'TIE') || slots[0];

  if (GAMES.length === 0) {
    return (
      <View style={styles.pad}>
        <EmptyState
          icon={<SignalIcon size={32} color={ink.doux} />}
          title={t('Pas de jeu casino')}
          text={t("Aucun jeu n'est disponible pour le moment.")}
        />
      </View>
    );
  }

  if (!online && offsetMs == null) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.pad, { flexGrow: 1 }]}
        overScrollMode="always"
        refreshControl={refreshControl}
      >
        <ErrorState
          text={t('Hors ligne : reconnecte-toi pour voir les signaux.')}
          retry={onRetrySync}
          retryLabel={t('Réessayer')}
        />
      </ScrollView>
    );
  }

  if (offsetMs == null || !game || !target) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.pad, styles.skelStack, { flexGrow: 1 }]}
        overScrollMode="always"
        refreshControl={refreshControl}
      >
        <Skeleton calm={calm} style={styles.skelTitle} />
        <Skeleton calm={calm} style={styles.skelBar} />
        <Skeleton calm={calm} style={styles.skelBig} />
      </ScrollView>
    );
  }

  const playable = target.v !== 'TIE';

  const howtoSteps = [
    t('Appuie sur « Préparer ma mise » : tout est déjà rempli.'),
    t('Choisis ta mise, puis attends la fin du décompte.'),
    t(
      'Dans les 3 dernières secondes, appuie sur le bouton conseillé : ta mise partira toute seule à la seconde pile.'
    ),
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      refreshControl={refreshControl}
    >
      {/* En-tête */}
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>{t('Signaux casino')}</Text>
        <Text style={styles.bodyMuted}>
          {t("On te dit à l'avance s'il faut appuyer sur Hausse ou Baisse, et à quelle seconde exacte.")}
        </Text>
      </View>

      {/* LA consigne : quoi miser et dans combien de temps */}
      <View style={styles.consigne}>
        <View style={styles.consigneHead}>
          <View style={[styles.dot, { backgroundColor: game.color }]} />
          <Text style={styles.consigneTitle} numberOfLines={1}>
            {game.base} <Text style={styles.consigneTitleSub}>· {durationLabel(duration)}</Text>
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{t('JEU')}</Text>
          </View>
        </View>

        {playable ? (
          <>
            <Text style={styles.verdictLine}>
              {t('À')} <Text style={styles.verdictTime}>{fmtSlot(target.start)}</Text>{' '}
              {t('précises, appuie sur :')}
            </Text>

            <View style={[styles.pill, target.v === 'UP' ? styles.pillUp : styles.pillDown]}>
              <Text style={[styles.pillText, target.v === 'UP' ? styles.pillTextUp : styles.pillTextDown]}>
                {verdictLabel(target.v, t)}
              </Text>
            </View>

            <Text style={styles.miseDans}>{t('Mise dans')}</Text>
            <SignalLiveMeter
              targetStart={target.start}
              offsetMs={offsetMs}
              isActive={isActive}
              onSlotAdvance={syncSlot}
            />

            <Btn
              onPress={() =>
                onPrepare({
                  symbol: game.id,
                  duration,
                  direction: target.v,
                  slot: target.start,
                })
              }
              style={styles.prepareBtn}
              textStyle={styles.prepareBtnText}
            >
              {t('Préparer ma mise →')}
            </Btn>

            <Text style={styles.prepareNote}>
              {t("Le jeu, la durée et le bouton sont déjà remplis sur l'écran suivant.")}
            </Text>
          </>
        ) : (
          <Text style={styles.idle}>
            {t("Pas de coup jouable pour l'instant : reviens dans une minute.")}
          </Text>
        )}
      </View>

      {/* Comment ne pas louper le coup */}
      <View style={styles.howto}>
        <Text style={styles.sectionTitle}>{t('Comment ne pas louper le coup')}</Text>
        <View style={styles.steps}>
          {howtoSteps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.howtoNote}>
          {t(
            "Trop tôt ? Attends : le bouton conseillé ne s'arme que dans les 3 dernières secondes. En retard ? Le coup est raté : attends le suivant. Astuce : sur le trader, choisis ton heure dans « Départ » et ta mise partira toute seule, même si tu quittes l'app."
          )}
        </Text>
      </View>

      {/* Choix du jeu */}
      <View>
        <Text style={styles.pickTitle}>{t('Quel jeu ?')}</Text>
        <View style={styles.gameGrid}>
          {GAMES.map((g) => {
            const selected = g.id === game.id;
            return (
              <TouchableOpacity
                key={g.id}
                accessibilityRole="button"
                onPress={() => setGameId(g.id)}
                style={[styles.gameBtn, selected ? styles.pickOn : styles.pickOff]}
              >
                <View style={[styles.gameDot, { backgroundColor: g.color }]} />
                <Text style={[styles.pickText, selected ? styles.pickTextOn : styles.pickTextOff]} numberOfLines={1}>
                  {g.base}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Choix de la durée */}
      <View>
        <Text style={styles.pickTitle}>{t('Quelle durée ?')}</Text>
        <View style={styles.durGrid}>
          {DURATIONS.map((d) => {
            const selected = d === duration;
            return (
              <TouchableOpacity
                key={d}
                accessibilityRole="button"
                onPress={() => setDuration(d)}
                style={[styles.durBtn, selected ? styles.pickOn : styles.pickOff]}
              >
                <Text style={[styles.pickText, selected ? styles.pickTextOn : styles.pickTextOff]}>
                  {durationLabel(d)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tous les coups à venir (20 créneaux) */}
      <View style={styles.list}>
        <View style={styles.listHead}>
          <Text style={styles.listHeadText}>{t('Les coups à venir')}</Text>
        </View>
        {slots.map((s) => {
          const isTarget = playable && s.start === target.start;
          return (
            <View key={s.start} style={[styles.listRow, isTarget && styles.listHot]}>
              <View style={styles.slotMain}>
                <Text style={styles.listTime}>{fmtSlot(s.start)}</Text>
                {isTarget ? (
                  <View style={styles.listPlay}>
                    <Text style={styles.listPlayText}>{t('À JOUER')}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.toneBadge,
                  s.v === 'UP'
                    ? styles.badgeUp
                    : s.v === 'DOWN'
                      ? styles.badgeDown
                      : styles.badgePass,
                ]}
              >
                <Text
                  style={[
                    styles.toneBadgeText,
                    s.v === 'UP'
                      ? styles.badgeUpText
                      : s.v === 'DOWN'
                        ? styles.badgeDownText
                        : styles.badgePassText,
                  ]}
                >
                  {verdictLabel(s.v, t)}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={styles.listFoot}>
          <Text style={styles.listFootText}>
            {t("« Égalité » = le prix ne bougera pas : garde ta mise pour le coup d'après.")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
});

const makeStyles = (INK) =>
  StyleSheet.create({
    scroll: {
    flex: 1,
    backgroundColor: INK.fond,
  },
  pad: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: INK.fond,
  },
  skelStack: {
    gap: 8,
  },
  skelTitle: {
    height: 32,
    width: 190,
  },
  skelBar: {
    height: 48,
    width: '100%',
  },
  skelBig: {
    height: 256,
    width: '100%',
  },
  root: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  headerBlock: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
  },
  bodyMuted: {
    fontSize: 13,
    lineHeight: 18,
    color: INK.doux,
  },
  consigne: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK.action,
    backgroundColor: INK.carte,
    padding: 12,
  },
  consigneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  consigneTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  consigneTitleSub: {
    fontWeight: '700',
    color: INK.doux,
  },
  tag: {
    borderRadius: 6,
    backgroundColor: INK.tagfond,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: INK.tag,
  },
  verdictLine: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: INK.doux,
  },
  verdictTime: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    alignSelf: 'center',
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  pillUp: {
    backgroundColor: INK.hausse,
  },
  pillDown: {
    backgroundColor: INK.vente,
  },
  pillText: {
    fontSize: 28,
    fontWeight: '800',
  },
  pillTextUp: {
    color: INK.vertfonce,
  },
  pillTextDown: {
    color: '#FFFFFF',
  },
  miseDans: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: INK.doux,
  },
  countdown: {
    textAlign: 'center',
    fontSize: 48,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  track: {
    marginTop: 8,
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: INK.fond,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: INK.action,
  },
  prepareBtn: {
    marginTop: 12,
    minHeight: 56,
    width: '100%',
  },
  prepareBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  prepareNote: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
    color: INK.doux,
  },
  idle: {
    marginTop: 8,
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: INK.doux,
  },
  howto: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  steps: {
    marginTop: 8,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: INK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    paddingTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: INK.texte,
  },
  howtoNote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: INK.doux,
  },
  pickTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  gameGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  gameBtn: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  gameDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  durGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  durBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  pickOn: {
    borderColor: INK.action,
    backgroundColor: 'rgba(46,153,251,0.15)',
  },
  pickOff: {
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
  },
  pickText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pickTextOn: {
    color: INK.texte,
  },
  pickTextOff: {
    color: INK.doux,
  },
  list: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
  },
  listHead: {
    borderBottomWidth: 1,
    borderBottomColor: INK.ligne,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listHeadText: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listHot: {
    backgroundColor: 'rgba(46,153,251,0.1)',
  },
  slotMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listTime: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  listPlay: {
    borderRadius: 6,
    backgroundColor: INK.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  listPlayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  toneBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeUp: {
    backgroundColor: 'rgba(12,175,86,0.15)',
  },
  badgeDown: {
    backgroundColor: 'rgba(229,93,79,0.15)',
  },
  badgePass: {
    backgroundColor: INK.fond,
  },
  toneBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badgeUpText: {
    color: INK.hausse,
  },
  badgeDownText: {
    color: INK.baisse,
  },
  badgePassText: {
    color: INK.doux,
  },
  listFoot: {
    borderTopWidth: 1,
    borderTopColor: INK.ligne,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listFootText: {
    fontSize: 13,
    lineHeight: 18,
    color: INK.doux,
  },
});
