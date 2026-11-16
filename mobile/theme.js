// Système design, configuration, jeux et formatages : miroir exact du site web.
import React, { createContext, useContext, useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { tr } from './i18n';

/** Palette Quotex sombre — identique à tailwind.config.ts et lib/design.ts. */
export const INK_DARK = {
  fond: '#1C1F2E',
  carte: '#2A3040',
  ligne: '#3D4356',
  texte: '#F0F0F0',
  doux: '#8E93A7',
  hausse: '#0CAF56',
  baisse: '#E55D4F',
  chartDown: '#E55D4F',
  action: '#2E99FB',
  primary: '#0270D1',
  vente: '#DC4633',
  puce: '#424554',
  tag: '#7AA2FF',
  tagfond: '#16275A',
  vertfonce: '#06210F',
  payout: '#E09038',
  cadre: '#4E5463',
  grille: '#474955',
  onglet: '#353A4D',
  pill: '#2E99FB',
  countBg: '#303040',
  skelBg: '#283044',
  toastBg: 'rgba(28, 31, 46, 0.94)',
  guideVeil: 'rgba(28, 31, 46, 0.6)',
  dotsStroke: 'rgba(142, 147, 167, 0.6)',
};

/** Palette Quotex claire — identique à app/globals.css (:root[data-theme="light"]) et lib/design.ts. */
export const INK_LIGHT = {
  fond: '#F3F5FA',
  carte: '#FFFFFF',
  ligne: '#DCE1EC',
  texte: '#151926',
  doux: '#5E667A',
  hausse: '#0A994B',
  baisse: '#DC3E30',
  chartDown: '#DC3E30',
  action: '#1A7FE8',
  primary: '#0270D1',
  vente: '#D43D2B',
  puce: '#E5E9F2',
  tag: '#1D56C8',
  tagfond: '#E2EBFF',
  vertfonce: '#FFFFFF',
  payout: '#C7761B',
  cadre: '#C5CCD9',
  grille: '#E7EBF4',
  onglet: '#E9EDF5',
  pill: '#1A7FE8',
  countBg: '#E2E6F0',
  skelBg: '#E2E7F2',
  toastBg: 'rgba(255, 255, 255, 0.96)',
  guideVeil: 'rgba(21, 25, 38, 0.45)',
  dotsStroke: 'rgba(94, 102, 122, 0.45)',
};

export const INK = INK_DARK;

export function getThemeInk(mode) {
  return mode === 'light' ? INK_LIGHT : INK_DARK;
}

/** Applique le thème actif sur la StatusBar native (empêche tout changement de couleur intempestif sur Android). */
export function syncStatusBar(theme) {
  const light = theme === 'light';
  const palette = getThemeInk(theme);
  try {
    if (StatusBar && typeof StatusBar.setBarStyle === 'function') {
      StatusBar.setBarStyle(light ? 'dark-content' : 'light-content', false);
    }
    if (Platform.OS === 'android') {
      if (StatusBar && typeof StatusBar.setTranslucent === 'function') {
        StatusBar.setTranslucent(false);
      }
      if (StatusBar && typeof StatusBar.setBackgroundColor === 'function') {
        StatusBar.setBackgroundColor(palette.fond, false);
      }
    }
  } catch {
    /* ignore */
  }
}

export const ThemeContext = createContext({
  theme: 'dark',
  isLight: false,
  ink: INK_DARK,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemedStyles(factory) {
  const { ink, isLight } = useTheme();
  return useMemo(() => factory(ink, isLight), [factory, ink, isLight]);
}

export const CHART_CFG = {
  stepDef: 9,
  stepMin: 3,
  stepMax: 28,
  tapSlop: 24,
  pulseMs: 150,
  tweenMs: 350,
  axisW: 48,
  axisBottom: 18,
  gridLines: 6,
  timeLabels: 5,
  timePad: 5,
  timeEdge: 24,
  tickLen: 3,
  padTop: 6,
  padBottom: 12,
  rangePad: 0.1,
  spikeHi: 2,
  spikeLo: 0.5,
};

export const RING_CFG = {
  track: INK_DARK.ligne,
  line: INK_DARK.action,
  urgent: INK_DARK.baisse,
  bigFrom: 76,
  strokeBig: 8,
  strokeSmall: 6,
  big: 84,
  mini: 38,
  miniR: 15,
  strokeMini: 3.5,
  miniLine: INK_DARK.primary,
};

export const SYMBOLS = [
  { id: 'EURUSDOTC', base: 'Lucky 7', color: '#FBBF24', kind: 'otc', decimals: 3 },
  { id: 'GBPUSDOTC', base: 'Jackpot', color: '#A78BFA', kind: 'otc', decimals: 2 },
  { id: 'USDJPYOTC', base: 'Turbo', color: '#F472B6', kind: 'otc', decimals: 2 },
];

export const DURATIONS = [3, 10, 30, 60, 300];

export const CURRENCY_LABELS = {
  USD: 'Dollar américain',
  EUR: 'Euro',
  XOF: 'Franc CFA (UEMOA)',
  GBP: 'Livre sterling',
  NGN: 'Naira',
  GHS: 'Cedi',
};

export const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', currency: 'XOF' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF' },
  { code: 'GW', name: 'Guinée-Bissau', currency: 'XOF' },
  { code: 'ML', name: 'Mali', currency: 'XOF' },
  { code: 'NE', name: 'Niger', currency: 'XOF' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF' },
  { code: 'TG', name: 'Togo', currency: 'XOF' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'US', name: 'États-Unis', currency: 'USD' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Allemagne', currency: 'EUR' },
  { code: 'BE', name: 'Belgique', currency: 'EUR' },
  { code: 'ES', name: 'Espagne', currency: 'EUR' },
  { code: 'IT', name: 'Italie', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'NL', name: 'Pays-Bas', currency: 'EUR' },
  { code: 'EU', name: 'Autre zone euro', currency: 'EUR' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP' },
];

export const RULES = {
  MIN_BET: 10,
  MIN_DEPOSIT: 100,
  MAX_DEPOSIT: 50000,
  MIN_WITHDRAW: 100,
  WIN_PAYOUT_RATIO: 0.85,
  MAX_TRADES_PER_MINUTE: 20,
  MAX_SCHEDULED: 50,
  COMBO_MIN_LEGS: 2,
  COMBO_MAX_LEGS: 5,
  COMBO_MAX_PAYOUT: 5000000,
};

export const CONFIG = {
  DEFAULT_BET: 50,
  DEPOSIT_OPTIONS: [1000, 5000, 10000],
  WITHDRAW_OPTIONS: [1000, 5000],
  DEFAULT_DURATION_SEC: 60,
  DEFAULT_INTERVAL: '1m',
  TRADES_PAGE_LIMIT: 50,
  HISTORY_LIMIT: 200,
  CANDLES_LIMIT: 200,
  RESULTS_SHOWN: 5,
  TIME_SLOT_COUNT: 12,
  TIME_SLOT_STEP_MIN: 15,
  TIME_SLOT_BOOK_MARGIN_MS: 8000,
  SIGNAL_SLOT_COUNT: 20,
  SIGNAL_LATE_MS: 30000,
  SIGNAL_PRESS_WINDOW_MS: 3000,
  CLOCK_SYNC_MS: 30000,
  CANDLES_REFRESH_MS: 15000,
  SCHEDULED_REFRESH_MS: 30000,
  TRADES_REFRESH_MS: 15000,
  LIVE_POLL_MS: 4000,
  SETTLE_TICK_MS: 1000,
  SETTLE_RETRY_MS: 5000,
  FLOAT_TICK_MS: 1000,
  SIGNAL_TICK_MS: 250,
  PENDING_TICK_MS: 250,
  RING_TICK_MS: 200,
  COUNTDOWN_TICK_MS: 150,
  RING_URGENT_MS: 10000,
  GO_THRESHOLD_MS: 1000,
  SHOT_DELAY_MS: 150,
  BAD_TIME: '__bad',
  DOUBLE_TAP_MS: 350,
  PASSWORD_MIN: 6,
  API_TIMEOUT_MS: 15000,
  SPLASH_MIN_MS: 900,
  SPLASH_FADE_MS: 300,
  COPIED_MS: 1500,
  TOAST_MS: 2200,
  VIBRATE: { tap: 15, action: 20, settle: 30 },
  CSV: { sep: ',', header: 'jeu,duree,sens,mise,depart,arrivee,resultat,date' },
  STORE: {
    token: 'tradefacile_session',
    symbol: 'tf_symbol',
    order: 'tf_order',
    guide: 'tf_guide',
    calm: 'tf_calme',
    lang: 'tf_lang',
    theme: 'tf_theme',
  },
};

export function isOtc(symbol) {
  return SYMBOLS.find((s) => s.id === symbol)?.kind === 'otc';
}

export function isDuration(v) {
  return v === 3 || v === 10 || v === 30 || v === 60 || v === 300;
}

export function symbolDisplay(symbol) {
  const found = SYMBOLS.find((s) => s.id === symbol);
  return found ? found.base : symbol;
}

export function symbolDecimals(symbol) {
  return SYMBOLS.find((s) => s.id === symbol)?.decimals ?? 2;
}

export function durationLabel(sec) {
  if (sec === 3) return '3 s';
  if (sec === 10) return '10 s';
  if (sec === 30) return '30 s';
  if (sec === 60) return '1 min';
  if (sec === 300) return '5 min';
  return `${sec} s`;
}

const LOCALES = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

function formatDecimalNumber(value, decimals, lang = 'fr') {
  const v = Number(value) || 0;
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(decimals);
  const [whole, frac] = fixed.split('.');
  const group = lang === 'en' ? ',' : lang === 'es' ? '.' : ' ';
  const sep = lang === 'en' ? '.' : ',';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${neg ? '-' : ''}${grouped}${frac !== undefined ? sep + frac : ''}`;
}

export function fmtGamePrice(symbol, p, lang = 'fr') {
  const dec = symbolDecimals(symbol) >= 3 ? 3 : 2;
  return formatDecimalNumber(p, dec, lang);
}

export function fmtSigned(n, lang = 'fr') {
  const v = Math.round(Number(n) || 0);
  if (v > 0) return `+${formatDecimalNumber(v, 0, lang)}`;
  if (v < 0) return `-${formatDecimalNumber(Math.abs(v), 0, lang)}`;
  return '±0';
}

export function fmtTime(iso, lang = 'fr') {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function fmtDurMS(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtRemain(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtRemainShort(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${s}s`;
}

export function fmtDay(iso, lang = 'fr') {
  try {
    const d = new Date(iso);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((midnight.getTime() - day.getTime()) / 86400000);
    if (diff === 0) return tr(lang, "Aujourd'hui");
    if (diff === 1) return tr(lang, 'Hier');
    return d.toLocaleDateString(LOCALES[lang] || LOCALES.fr, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function fmtSlot(slotSec) {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}:00`;
}

export function fmtHM(slotSec) {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtHM24(slotSec) {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
