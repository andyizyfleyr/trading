// Composants UI partagés : miroir exact de components/ui.tsx, CountdownRing, SplashScreen, GuideBubbles.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CONFIG, DURATIONS, INK, RING_CFG, RULES, SYMBOLS, durationLabel, fmtRemainShort } from '../theme';
import { CheckIcon, XIcon } from './Icons';

/* ---------- Bouton (identique à BTN) ---------- */

export function Btn({
  children,
  variant = 'primary',
  disabled = false,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const variantStyle =
    variant === 'primary' ? styles.btnPrimary : variant === 'ghost' ? styles.btnGhost : styles.btnCard;
  const variantText = variant === 'primary' ? styles.btnTextPrimary : styles.btnTextDefault;
  const isString = typeof children === 'string' || typeof children === 'number';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={[styles.btnBase, variantStyle, disabled && styles.btnDisabled, style]}
    >
      {isString ? <Text style={[styles.btnText, variantText, textStyle]}>{children}</Text> : children}
    </TouchableOpacity>
  );
}

/* ---------- Champ de formulaire (identique à FORM) ---------- */

export function Field({ label, children }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/* ---------- Squelette de chargement ---------- */

export function Skeleton({ style, calm = false }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (calm) {
      pulse.setValue(0.65);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [calm, pulse]);

  return <Animated.View style={[styles.skeleton, { opacity: pulse }, style]} />;
}

/* ---------- État vide ---------- */

export function EmptyState({ icon, title, text, action }) {
  return (
    <View style={styles.emptyBox}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action || null}
    </View>
  );
}

/* ---------- État d'erreur ---------- */

export function ErrorState({ text, retry, retryLabel = 'Réessayer' }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{text}</Text>
      {retry ? (
        <Btn variant="ghost" onPress={retry}>
          {retryLabel}
        </Btn>
      ) : null}
    </View>
  );
}

/* ---------- Bottom Sheet (identique à SHEET) ---------- */

export function BottomSheet({ open, onClose, title, children, hideTitle = false, header }) {
  if (!open) return null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetFade} onPress={onClose} accessibilityLabel={title} />
        <View style={styles.sheetBox}>
          <View style={styles.sheetHandle} />
          {header || (
            <View style={styles.sheetHead}>
              {hideTitle ? <View /> : <Text style={styles.sheetTitle}>{title}</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={onClose}
                style={styles.sheetClose}
              >
                <XIcon size={16} color={INK.doux} />
              </TouchableOpacity>
            </View>
          )}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Liste déroulante en BottomSheet (remplace <select>) ---------- */

export function SelectSheet({ open, onClose, title, options, selectedValue, onSelect }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <View style={styles.list1}>
        {options.map((opt) => {
          const active = opt.value === selectedValue;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              accessibilityRole="button"
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
              style={[styles.sheetRow, active && styles.sheetRowOn]}
            >
              {opt.color ? <View style={[styles.sheetDot, { backgroundColor: opt.color }]} /> : null}
              <Text style={styles.sheetRowName} numberOfLines={1}>
                {opt.label}
              </Text>
              {opt.badge ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{opt.badge}</Text>
                </View>
              ) : null}
              {active ? <CheckIcon size={16} color={INK.hausse} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

/* ---------- Anneau de compte à rebours (identique à CountdownRing.tsx) ---------- */

export function CountdownRing({
  closesAt,
  durationSec,
  offsetMs = 0,
  t,
  size = RING_CFG.big,
  compact = false,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CONFIG.RING_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const end = new Date(closesAt).getTime();
  const total = Math.max(1, durationSec * 1000);
  const remaining = Math.max(0, end - (now + (offsetMs || 0)));
  const frac = Math.min(1, remaining / total);
  const secs = remaining <= 0 ? 0 : Math.max(1, Math.floor(remaining / 1000));
  const urgent = remaining <= CONFIG.RING_URGENT_MS;

  const big = size >= RING_CFG.bigFrom;
  const stroke = compact ? RING_CFG.strokeMini : big ? RING_CFG.strokeBig : RING_CFG.strokeSmall;
  const r = compact ? RING_CFG.miniR : (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const strokeColor = compact ? RING_CFG.miniLine : urgent ? RING_CFG.urgent : RING_CFG.line;

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={RING_CFG.track} strokeWidth={stroke} />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          rotation={-90}
          originX={cx}
          originY={cy}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        {compact ? (
          <Text style={styles.ringNumMini}>{fmtRemainShort(remaining)}</Text>
        ) : (
          <>
            <Text style={big ? styles.ringNumBig : styles.ringNumSmall}>
              {remaining <= 0
                ? '…'
                : secs >= 60
                  ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
                  : String(secs)}
            </Text>
            <Text style={big ? styles.ringUnitBig : styles.ringUnitSmall}>
              {remaining <= 0 ? t('résultat…') : secs >= 60 ? t('min') : t('sec')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/* ---------- Écran d'ouverture animé (identique à SplashScreen.tsx) ---------- */

const SPLASH_CANDLES = [
  INK.hausse,
  INK.hausse,
  INK.baisse,
  INK.hausse,
  INK.baisse,
  INK.baisse,
  INK.hausse,
];

function SplashCandle({ color, delay, calm }) {
  const anim = useRef(new Animated.Value(calm ? 0.85 : 0.25)).current;

  useEffect(() => {
    if (calm) return;
    let stopped = false;
    let loop = null;
    const timer = setTimeout(() => {
      if (stopped) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
    }, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (loop) loop.stop();
    };
  }, [anim, delay, calm]);

  return (
    <Animated.View
      style={[
        styles.splashCandle,
        {
          backgroundColor: color,
          opacity: anim,
          transform: [{ scaleY: anim }],
        },
      ]}
    />
  );
}

export function SplashScreen({ calm = false }) {
  return (
    <View style={styles.splashRoot}>
      <View style={styles.splashCandles}>
        {SPLASH_CANDLES.map((color, i) => (
          <SplashCandle key={i} color={color} delay={i * 120} calm={calm} />
        ))}
      </View>
    </View>
  );
}

/* ---------- Premier trade guidé (identique à GuideBubbles.tsx) ---------- */

export function GuideBubbles({ t, onDone }) {
  const [step, setStep] = useState(0);
  const gamesList = SYMBOLS.map((s) => s.base).join(', ');
  const durationsList = DURATIONS.map((d) => durationLabel(d)).join(', ');

  const steps = [
    {
      title: t('1. Choisis un jeu'),
      text: t('Touche « {game} » pour ouvrir la liste des {n} jeux : {list} (badge JEU).', {
        game: SYMBOLS[0].base,
        n: SYMBOLS.length,
        list: gamesList,
      }),
    },
    {
      title: t('2. Lis le graphique'),
      text: t('Bougie verte ▲ : le prix a monté. Bougie rouge ▼ : il a baissé.'),
    },
    {
      title: t('3. Choisis une durée'),
      text: t('{list}. À la fin du compte à rebours, on compare le prix de fin au prix de départ.', {
        list: durationsList,
      }),
    },
    {
      title: t('4. Choisis ta mise'),
      text: t('Tape un montant ou ajuste avec − et +. Si tu gagnes : mise rendue + {pct} % de bénéfice.', {
        pct: Math.round(RULES.WIN_PAYOUT_RATIO * 100),
      }),
    },
    {
      title: t('5. Prédis la direction'),
      text: t(
        "Hausse ▲ si ça monte, Baisse ▼ si ça descend. Tes prédictions en cours s'affichent ici : touche la pastille « N en cours » sur le graphique pour les suivre avec leur compte à rebours."
      ),
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <View style={styles.guideOverlay} pointerEvents="box-none">
      <View style={styles.guideVeil} pointerEvents="none" />
      <View style={styles.guidePos}>
        <View style={styles.guideCard}>
          <Text style={styles.guideStep}>
            {t('Premier trade guidé · {a}/{b}', { a: step + 1, b: steps.length })}
          </Text>
          <Text style={styles.guideTitle}>{current.title}</Text>
          <Text style={styles.guideText}>{current.text}</Text>
          <View style={styles.guideBtns}>
            <Btn variant="ghost" onPress={onDone} style={{ flex: 1 }}>
              {t('Passer')}
            </Btn>
            <Btn onPress={() => (last ? onDone() : setStep((s) => s + 1))} style={{ flex: 2 }}>
              {last ? t("C'est parti !") : t('Suivant')}
            </Btn>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: INK.primary,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: INK.ligne,
  },
  btnCard: {
    backgroundColor: INK.carte,
    borderWidth: 1,
    borderColor: INK.ligne,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnTextDefault: {
    color: INK.texte,
  },
  fieldWrap: {
    width: '100%',
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
    color: INK.doux,
  },
  skeleton: {
    backgroundColor: '#283044',
    borderRadius: 12,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyIcon: {
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK.texte,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: INK.doux,
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,93,79,0.4)',
    backgroundColor: INK.carte,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 13,
    color: INK.texte,
    textAlign: 'center',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetBox: {
    maxHeight: '75%',
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: INK.ligne,
    backgroundColor: INK.carte,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: INK.ligne,
    marginBottom: 8,
  },
  sheetHead: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INK.fond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyContent: {
    paddingBottom: 6,
  },
  list1: {
    gap: 4,
    paddingBottom: 8,
  },
  sheetRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  sheetRowOn: {
    backgroundColor: INK.fond,
  },
  sheetDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sheetRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: INK.texte,
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
  ringWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumMini: {
    fontSize: 10,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  ringNumBig: {
    fontSize: 18,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  ringNumSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: INK.texte,
    fontVariant: ['tabular-nums'],
  },
  ringUnitBig: {
    fontSize: 12,
    fontWeight: '600',
    color: INK.doux,
  },
  ringUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: INK.doux,
  },
  splashRoot: {
    flex: 1,
    backgroundColor: INK.fond,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  splashCandles: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  splashCandle: {
    width: 8,
    height: 40,
    borderRadius: 999,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'flex-end',
  },
  guideVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,31,46,0.6)',
  },
  guidePos: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  guideCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INK.action,
    backgroundColor: INK.carte,
    padding: 12,
    elevation: 10,
  },
  guideStep: {
    fontSize: 11,
    fontWeight: '600',
    color: INK.doux,
  },
  guideTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: INK.texte,
  },
  guideText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: INK.texte,
  },
  guideBtns: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
});
