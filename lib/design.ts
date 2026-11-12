/**
 * Système design : TOUTES les tailles, couleurs et recettes visuelles de l'app.
 * Les pages et composants importent d'ici — rien en dur ailleurs.
 * (Chaînes complètes volontairement : Tailwind les détecte au scan.)
 */

/** Couleurs pour le JS (graphique, anneau, SVG) : miroir du thème Tailwind. */
export const INK = {
  fond: "#0A0F1E",
  carte: "#121A2E",
  ligne: "#222D4A",
  texte: "#E8EDF8",
  doux: "#7F8CAB",
  hausse: "#22C55E",
  baisse: "#EF4444",
  chartDown: "#E5322D",
  action: "#3B82F6",
  primary: "#2F66F0",
  vente: "#DC2626",
  puce: "#1A2440",
  tag: "#7AA2FF",
  tagfond: "#16275A",
  vertfonce: "#06210F",
} as const;

/** Réglages du graphique maison (canvas) : grille, bougies, prix. */
export const CHART = {
  visible: 70,
  axisW: 44,
  axisBottom: 18,
  gridLines: 6,
  timeLabels: 5,
  timePad: 6,
  timeEdge: 24,
  tickLen: 3,
  font: "10px system-ui",
  fontBold: "700 10px system-ui",
  dash: [3, 3],
  padTop: 6,
  padBottom: 12,
  rangePad: 0.1,
  /** Garde-fou : ignore les prix aberrants (×2 ou ÷2 par rapport à la clôture). */
  spikeHi: 2,
  spikeLo: 0.5,
  load: "absolute inset-0 flex items-end gap-1 p-4",
  bar: "skeleton flex-1 rounded",
  errBox: "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-carte/95 p-6 text-center",
  errText: "text-base",
  canvas: "block h-full w-full",
} as const;

/** Anneau de compte à rebours. */
export const RING = {
  track: INK.ligne,
  line: INK.action,
  urgent: INK.baisse,
  /** Taille à partir de laquelle l'anneau passe en grand (gros chiffres). */
  bigFrom: 76,
  strokeBig: 8,
  strokeSmall: 6,
  /** Taille par défaut (grande). */
  big: 84,
  /** Mini-anneau compact (« En cours ») : 38 px, rayon 15, trait 3,5, bleu. */
  mini: 38,
  miniR: 15,
  strokeMini: 3.5,
  miniLine: INK.primary,
} as const;

/** Tailles d'icônes. */
export const ICON = {
  dot: "h-2.5 w-2.5",
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  nav: "h-[18px] w-[18px]",
  xl: "h-8 w-8",
} as const;

/** Typographies. */
export const TEXT = {
  pageTitle: "text-[15px] font-extrabold",
  sectionTitle: "text-sm font-extrabold",
  authTitle: "text-lg font-extrabold",
  body: "text-[13px]",
  bodyMuted: "text-[13px] text-doux",
  small: "text-xs",
  smallMuted: "text-xs text-doux",
  tiny: "text-[11px]",
  tinyMuted: "text-[11px] text-doux",
  micro: "text-[10px]",
} as const;

/** Proportions flex (pastilles qui s'étirent). */
export const FLEX = {
  fill: "flex-1",
  input: "flex-[1.7]",
  now: "flex-[1.6]",
  wide: "flex-[2]",
} as const;

/** Piles verticales courantes. */
export const STACK = {
  c1: "flex flex-col gap-1",
  c15: "flex flex-col gap-1.5",
  c2: "flex flex-col gap-2",
} as const;

/** Lignes centrées courantes. */
export const ROW = {
  center: "flex items-center justify-center gap-2",
  centerTight: "flex items-center justify-center gap-1.5",
  between: "flex items-center justify-between gap-2",
} as const;

/* ---------- Coquille (fond, entête, navigation) ---------- */

export const SHELL = {
  root: "min-h-dvh bg-fond text-texte",
  desktop: "lg:pl-[280px]",
  bare: "min-h-dvh bg-fond text-texte",
  main: "mx-auto max-w-[520px] px-3 pb-28 pt-2 lg:max-w-6xl lg:px-6 lg:pb-10",
  loadBox: "mx-auto flex max-w-[520px] flex-col lg:max-w-3xl gap-3 p-4",
  loadBig: "skeleton h-40 rounded-xl",
  loadSmall: "skeleton h-24 rounded-xl",
} as const;

export const HEADER = {
  bar: "safe-top sticky top-0 z-40 border-b border-ligne bg-fond/95 backdrop-blur",
  wrap: "mx-auto flex h-11 max-w-xl items-center justify-between gap-2 px-3 lg:max-w-6xl lg:px-6",
  logo: "flex items-center gap-1.5",
  mark: "flex flex-col text-[9px] font-bold leading-[0.9]",
  markUp: "text-hausse",
  markDown: "text-baisse",
  name: "text-[15px] font-bold",
  side: "flex items-center gap-1.5",
  pill: "flex items-center gap-1.5 rounded-[10px] border border-ligne bg-carte px-2.5 py-[5px] text-[13px] font-bold tabular-nums",
  pillIcon: "h-3.5 w-3.5 text-action",
  avatar: "hidden h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white lg:flex",
} as const;

export const NAV = {
  bar: "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ligne bg-carte/95 backdrop-blur lg:hidden",
  grid: "mx-auto grid max-w-[520px] grid-cols-2",
  tab: "relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors duration-200",
  on: "text-texte",
  off: "text-doux",
  icon: "h-[18px] w-[18px]",
  tick: "absolute top-0 h-[2px] w-[22px] rounded-full bg-primary",
} as const;

/* ---------- Trader ---------- */

export const TRADER = {
  root: "flex h-[calc(100dvh-106px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] -mb-[104px] flex-col gap-2 overflow-hidden lg:mb-0 lg:grid lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-4 lg:overflow-visible",
  assetBtn:
    "flex h-[34px] w-full shrink-0 items-center gap-[7px] rounded-[10px] border border-ligne bg-carte px-2.5 active:bg-ligne lg:col-span-2 lg:max-w-xl",
  assetMain: "flex items-center gap-[7px] text-sm font-bold",
  dot: "h-2.5 w-2.5 rounded-full",
  tag: "shrink-0 rounded-md bg-tagfond px-1.5 py-0.5 text-[10px] font-bold text-tag",
  assetRight: "flex items-center gap-1.5",
  assetPrice: "text-[13px] font-bold tabular-nums text-doux",
  chevron: "h-3.5 w-3.5 text-doux",
  chartBox: "min-h-[120px] flex-1 lg:col-start-1 lg:row-start-2 lg:min-h-0",
  chartCard: "relative h-full w-full overflow-hidden rounded-xl border border-ligne bg-carte",
  sideCol:
    "shrink-0 lg:col-start-2 lg:row-start-2 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto",
  panel: "flex flex-col gap-1.5 rounded-xl border border-ligne bg-carte p-2",
  row: "flex items-center gap-[5px]",
  label: "flex w-[46px] flex-none items-center gap-[3px] text-[11px] text-doux",
  chipsBox: "flex min-w-0 flex-1 gap-0.5 rounded-[10px] border border-ligne bg-fond p-0.5",
  chipOff:
    "h-[26px] min-w-0 rounded-lg border-0 bg-transparent p-0 text-xs font-semibold text-doux",
  chipOn:
    "h-[26px] min-w-0 rounded-lg border-0 bg-primary p-0 text-xs font-semibold text-white",
  amount:
    "h-[26px] min-w-0 rounded-lg border-0 bg-puce p-0 text-center text-sm font-bold tabular-nums text-texte outline-none focus:ring-[1.5px] focus:ring-action",
  goGain: "text-[11px] font-bold opacity-85",
  goRow: "flex gap-1.5 border-t border-ligne pt-2",
  go: "flex h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-sm font-extrabold transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  buy: "bg-hausse text-vertfonce",
  sell: "bg-vente text-white",
  advised: "animate-pulse ring-4 ring-white",
  hintOk: "text-center text-[11px] font-bold text-action",
  hintErr: "text-center text-[11px] font-bold text-baisse",
  error: "anim-in rounded-xl bg-baisse/10 px-3 py-1.5 text-center text-[13px] font-medium text-baisse",
  waitBox: "anim-in rounded-xl bg-action/15 px-3 py-2",
  waitTitle: "text-center text-sm font-extrabold",
  waitClock: "text-center text-2xl font-extrabold tabular-nums",
  waitWarn: "mt-1 rounded-lg bg-baisse/10 px-2 py-1 text-center text-[13px] font-bold text-baisse",
  waitNote: "mt-1 text-center text-[11px] text-doux",
  doneTitle: "text-center text-sm font-extrabold text-hausse",
  doneText: "mt-0.5 text-center text-[13px] font-bold",
  doneNote: "mt-0.5 text-center text-[11px] text-doux",
  doneBtns: "mt-1.5 grid grid-cols-2 gap-1.5",
  soonBox: "rounded-xl bg-fond px-2.5 py-2",
  soonTitle: "text-sm font-extrabold",
  soonList: "mt-1 flex flex-col gap-1",
  soonRow: "flex items-center justify-between gap-2 text-[13px]",
  soonMain: "min-w-0 truncate font-bold tabular-nums",
  soonSub: "font-medium text-doux",
  soonX:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ligne bg-carte text-sm font-extrabold text-doux active:text-texte",
  signalBox: "anim-in rounded-xl bg-action/15 px-3 py-2 text-center",
  signalText: "text-[13px] font-bold",
  signalClock: "text-sm font-extrabold tabular-nums",
  lateBox: "anim-in rounded-xl bg-baisse/10 px-3 py-2 text-center",
  lateText: "text-[13px] font-bold text-baisse",
  floatBtn:
    "anim-in fixed bottom-[3.75rem] right-4 z-30 flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold tabular-nums text-white shadow-xl active:bg-blue-700 lg:hidden",
  floatDot: "pulse-dot h-2.5 w-2.5 rounded-full bg-white",
  openPanel: "flex flex-col gap-2 rounded-xl border border-ligne bg-carte p-3",
  openHead: "flex items-center justify-between gap-2 text-sm",
  openTitle: "font-extrabold",
  openSoon: "font-bold tabular-nums text-action",
  openStaked: "-mt-1 text-[11px] tabular-nums text-doux",
  moreResults: "text-center text-[13px] font-semibold text-doux",
  waitBtn: "mt-1.5 w-full font-extrabold",
  formWrap: "lg:shrink-0",
  doneBox: "anim-in rounded-xl bg-hausse/15 px-3 py-2",
  onlyDesktop: "hidden lg:block",
  toast: "pointer-events-none absolute left-1/2 top-2.5 z-[5] -translate-x-1/2 whitespace-nowrap rounded-full border border-ligne bg-puce px-3 py-1.5 text-xs font-bold transition-all duration-[250ms] motion-reduce:transition-none",
  toastShow: "translate-y-0 opacity-100",
  toastHide: "-translate-y-[30px] opacity-0",
  toastWin: "text-hausse",
  toastLoss: "text-baisse",
} as const;

/* ---------- « En cours » compact (maquette) ---------- */

export const ENCOURS = {
  head: "mb-2 flex items-center gap-2",
  title: "text-[15px] font-extrabold",
  badge: "rounded-full bg-primary px-[7px] py-[2px] text-[11px] font-extrabold text-white",
  sum: "ml-auto text-right text-[11px] text-doux",
  sumB: "font-bold text-texte",
  close:
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-puce text-[13px] text-texte",
  list: "flex flex-col gap-1.5 pb-2",
  card: "grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border border-ligne border-l-[3px] bg-fond px-2.5 py-[7px]",
  toneFlat: "border-l-doux",
  toneWin: "border-l-hausse",
  /** Rouge maquette (#E5322D, comme les bougies baissières du graphique). */
  toneLoss: "border-l-[#E5322D]",
  mid: "min-w-0",
  mid1: "flex items-center gap-1.5 text-xs font-bold",
  dirUp: "rounded-[5px] bg-[#0F3A20] px-1.5 py-0.5 text-[10px] font-extrabold text-hausse",
  dirDown: "rounded-[5px] bg-[#451413] px-1.5 py-0.5 text-[10px] font-extrabold text-[#FF6B66]",
  mid2: "mt-1 text-[11px] text-doux",
  mid2B: "font-semibold text-texte",
  right: "text-right tabular-nums",
  cur: "text-[13px] font-extrabold",
  est: "mt-[3px] text-[11px] font-bold",
  textFlat: "text-texte",
  textWin: "text-hausse",
  textLoss: "text-[#E5322D]",
} as const;

/* ---------- Panneaux (bottom sheets) ---------- */

export const SHEET = {
  root: "fixed inset-0 z-50 lg:flex lg:items-center lg:justify-center lg:p-6",
  fade: "anim-fade absolute inset-0 bg-fond/70",
  box: "sheet-in absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-[520px] flex-col rounded-t-3xl border-t border-ligne bg-carte px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 lg:relative lg:inset-auto lg:mx-0 lg:max-h-[85vh] lg:max-w-md lg:rounded-3xl lg:border lg:pb-4 lg:pt-3 lg:shadow-2xl",
  handle: "mx-auto mb-1 h-1.5 w-12 shrink-0 rounded-full bg-ligne lg:hidden",
  head: "flex min-h-[44px] shrink-0 items-center justify-between gap-2",
  title: "text-sm font-extrabold",
  close: "flex h-9 w-9 items-center justify-center rounded-full bg-fond text-doux active:text-texte",
  closeIcon: "h-4 w-4",
  body: "no-scrollbar min-h-0 overflow-y-auto pb-1",
  row: "flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left active:bg-ligne",
  rowOn: "bg-fond",
  rowName: "min-w-0 flex-1 truncate text-sm font-extrabold",
  rowCheck: "h-4 w-4 shrink-0 text-hausse",
  helpBtn: "flex items-center justify-center p-1.5 -m-1.5",
  helpDot:
    "flex h-[13px] w-[13px] items-center justify-center rounded-full bg-puce text-[8px] font-bold text-doux active:text-texte",
  helpText: "pb-2 text-[13px] leading-relaxed",
  list1: "flex flex-col gap-1 pb-2",
  list2: "flex flex-col gap-2 pb-2",
  dot: "h-3.5 w-3.5 shrink-0 rounded-full",
} as const;

/* ---------- Boutons, cartes, champs partagés ---------- */

export const BTN = {
  base: "min-h-[42px] rounded-[10px] px-4 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
  primary: "bg-primary text-white active:bg-blue-700",
  green: "bg-hausse text-vertfonce active:bg-green-400",
  red: "bg-vente text-white active:bg-red-700",
  ghost: "border border-ligne bg-transparent text-texte active:bg-carte",
  card: "border border-ligne bg-carte text-texte active:bg-ligne",
  danger: "border border-baisse/50 bg-transparent text-baisse active:bg-baisse/10",
  block: "w-full font-extrabold",
} as const;

export const CARD = {
  base: "rounded-xl border border-ligne bg-carte p-3",
  result: "anim-in rounded-xl border border-transparent p-3",
} as const;

export const FORM = {
  label: "mb-1.5 flex items-center gap-1.5 text-sm font-medium text-doux",
  input:
    "h-[42px] w-full rounded-[10px] border border-ligne bg-carte px-3 outline-none placeholder:text-doux focus:border-action",
} as const;

export const STATE = {
  emptyBox:
    "flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-ligne bg-carte px-4 py-5 text-center",
  emptyIcon: "text-doux",
  emptyTitle: "text-sm font-bold",
  emptyText: "text-[13px] text-doux",
  errorBox: "flex flex-col items-center gap-2 rounded-xl border border-baisse/40 bg-carte px-4 py-5 text-center",
  errorText: "text-[13px]",
} as const;

/** Squelette de chargement générique. */
export const SKELETON = {
  base: "skeleton rounded-xl",
} as const;

/* ---------- Pastilles et tons ---------- */

export const TONE = {
  up: "rounded-lg bg-hausse/15 px-2 py-0.5 text-[13px] font-extrabold text-hausse",
  down: "rounded-lg bg-baisse/15 px-2 py-0.5 text-[13px] font-extrabold text-baisse",
  badgeUp: "shrink-0 rounded-lg bg-hausse/15 px-2 py-1 text-[13px] font-extrabold tabular-nums text-hausse",
  badgeDown: "shrink-0 rounded-lg bg-baisse/15 px-2 py-1 text-[13px] font-extrabold tabular-nums text-baisse",
  badgeInfo: "shrink-0 rounded-lg bg-action/15 px-2 py-1 text-[13px] font-extrabold text-action",
  badgePass: "shrink-0 rounded-lg bg-fond px-2 py-1 text-[13px] font-extrabold text-doux",
} as const;

/* ---------- Cartes de prédiction ---------- */

export const TRADE = {
  statUp: "text-hausse",
  statDown: "text-baisse",
  resultTitle: "text-sm font-semibold",
  resultNet: "text-2xl font-extrabold tabular-nums",
  resultLine: "text-[13px] tabular-nums",
  resultWin: "font-bold",
  resultMuted: "text-doux",
  resultMeta: "mt-1 text-[11px] tabular-nums text-doux",
} as const;

/** Anneau : chiffres et unités (grand / carte). */
export const RINGTEXT = {
  numBig: "text-lg font-extrabold tabular-nums leading-none",
  numSmall: "text-base font-extrabold tabular-nums leading-none",
  numMini: "text-[10px] font-extrabold tabular-nums leading-none",
  unitBig: "text-xs font-semibold text-doux",
  unitSmall: "text-[10px] font-semibold text-doux",
} as const;

/* ---------- Signaux ---------- */

export const SIGNAL = {
  consigne: "rounded-xl border-2 border-action bg-carte p-3",
  head: "flex items-center gap-2",
  dot: "h-3.5 w-3.5 shrink-0 rounded-full",
  title: "min-w-0 flex-1 truncate text-sm font-extrabold",
  titleSub: "font-bold text-doux",
  verdictLine: "mt-2 text-center text-[13px] font-bold text-doux",
  verdictTime: "text-sm font-extrabold tabular-nums text-texte",
  pill: "mx-auto mt-1 w-fit rounded-xl px-6 py-2 text-center text-3xl font-extrabold",
  pillUp: "bg-hausse text-vertfonce",
  pillDown: "bg-vente text-white",
  miseDans: "mt-2 text-center text-[13px] font-bold text-doux",
  countdown: "text-center text-5xl font-extrabold tabular-nums",
  track: "mt-2 h-2 overflow-hidden rounded-full bg-fond",
  fill: "h-full rounded-full bg-action",
  prepareWrap: "mt-3 block",
  prepareNote: "mt-1.5 text-center text-[11px] text-doux",
  howto: "rounded-xl border border-ligne bg-carte p-3",
  steps: "mt-1.5 flex flex-col gap-1.5",
  step: "flex items-start gap-2 text-[13px]",
  stepNum:
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-extrabold text-white",
  stepText: "pt-0.5 font-medium",
  note: "mt-2 text-[13px] text-doux",
  pickTitle: "mb-1 text-sm font-extrabold",
  gameGrid: "grid grid-cols-3 gap-1.5",
  durGrid: "grid grid-cols-5 gap-1.5",
  gameOn: "flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-action bg-action/15 px-2 text-[13px] font-extrabold text-texte",
  gameOff:
    "flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-ligne bg-carte px-2 text-[13px] font-extrabold text-doux",
  gameDot: "h-2.5 w-2.5 shrink-0 rounded-full",
  durOn: "min-h-[40px] rounded-xl border border-action bg-action/15 text-[13px] font-extrabold tabular-nums text-texte",
  durOff:
    "min-h-[40px] rounded-xl border border-ligne bg-carte text-[13px] font-extrabold tabular-nums text-doux",
  list: "overflow-hidden rounded-xl border border-ligne bg-carte",
  listHead: "border-b border-ligne px-3 py-2 text-sm font-extrabold",
  listRow: "flex items-center justify-between gap-2 px-3 py-2",
  listHot: "bg-action/10",
  listTime: "shrink-0 text-sm font-extrabold tabular-nums",
  listPlay: "shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-white",
  listFoot: "border-t border-ligne px-3 py-2 text-[13px] text-doux",
  skelTitle: "skeleton h-8 w-48 rounded-xl",
  skelBar: "skeleton h-12 rounded-xl",
  skelBig: "skeleton h-64 rounded-xl",
  root: "flex flex-col gap-3",
  prepare: "min-h-[56px] w-full text-lg font-extrabold",
  slotMain: "flex min-w-0 items-center gap-1.5",
  idle: "mt-2 py-4 text-center text-base font-bold text-doux",
} as const;

/* ---------- Historique ---------- */

export const HISTORY = {
  head: "flex items-center justify-between gap-2",
  tools: "flex items-center gap-1.5",
  iconBtn:
    "flex h-9 w-9 items-center justify-center rounded-[10px] border border-ligne bg-carte text-doux active:text-texte",
  select:
    "h-[42px] flex-1 rounded-[10px] border border-ligne bg-carte px-2 font-bold outline-none focus:border-action lg:max-w-xs",
  filters: "grid grid-cols-3 gap-1.5 lg:max-w-md",
  filterOn: "min-h-[40px] rounded-xl bg-primary text-[13px] font-bold text-white transition-colors duration-200",
  filterOff:
    "min-h-[40px] rounded-xl border border-ligne bg-carte text-[13px] font-bold text-doux transition-colors duration-200 active:text-texte",
  row: "rounded-xl border border-ligne bg-carte p-2.5",
  rowMeta: "mt-0.5 truncate text-[11px] tabular-nums text-doux",
  rowLink: "font-semibold text-action underline",
  exportBtn:
    "flex min-h-[40px] items-center rounded-xl border border-ligne bg-carte px-3 text-[13px] font-bold text-doux active:text-texte disabled:opacity-50",
  skel: "h-16",
  grid: "grid gap-2 lg:grid-cols-2",
  rowMain: "flex min-w-0 items-center gap-1.5",
  rowName: "truncate text-sm font-bold",
  rowSub: "font-medium text-doux",
} as const;

/* ---------- Profil ---------- */

export const PROFILE = {
  root: "flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3",
  idCard: "flex items-center gap-2.5 rounded-xl border border-ligne bg-carte p-2.5 lg:col-span-2",
  avatar: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white",
  mail: "truncate text-[13px] font-bold",
  balance: "text-xl font-extrabold tabular-nums",
  msgOk: "anim-in rounded-xl bg-hausse/10 px-3 py-1.5 text-center text-[13px] font-medium text-hausse lg:col-span-2",
  msgErr: "anim-in rounded-xl bg-baisse/10 px-3 py-1.5 text-center text-[13px] font-medium text-baisse lg:col-span-2",
  addRow: "grid grid-cols-2 gap-2",
  resetIdle:
    "flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] border border-ligne bg-carte text-[13px] font-bold transition-colors duration-200 disabled:opacity-50",
  resetConfirm:
    "flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] border border-baisse text-[13px] font-bold text-baisse transition-colors duration-200 disabled:opacity-50",
  prefRow:
    "flex min-h-[48px] items-center justify-between gap-3 rounded-[10px] border border-ligne bg-carte px-3 text-left",
  prefLabel: "text-[13px] font-medium",
  calmOn: "flex h-7 w-12 shrink-0 items-center justify-end rounded-full bg-hausse p-1 transition-colors duration-200",
  calmOff: "flex h-7 w-12 shrink-0 items-center justify-start rounded-full bg-ligne p-1 transition-colors duration-200",
  calmKnob: "h-5 w-5 rounded-full bg-white",
  sheetNote: "text-center text-[11px] text-doux",
  title: "text-[15px] font-extrabold lg:col-span-2",
  bigBtn: "flex min-h-[52px] items-center justify-center gap-1.5 text-base",
  logout: "flex min-h-[48px] items-center justify-center gap-2 border-baisse/50 text-sm text-baisse",
  optBtn: "flex items-center justify-center gap-1.5 tabular-nums",
} as const;

/* ---------- Authentification et bienvenue ---------- */

export const AUTH = {
  shell: "mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-3 py-6",
  brandRow: "mb-4 flex items-center gap-2",
  brandMark: "flex h-9 w-9 items-center justify-center rounded-xl bg-carte text-base font-extrabold",
  brandUp: "text-hausse",
  brandDown: "text-baisse",
  brandName: "text-[15px] font-extrabold",
  title: "text-lg font-extrabold",
  sub: "mt-1 text-[13px] text-doux",
  form: "mt-4 flex flex-col gap-3",
  foot: "mt-4 text-center text-[13px] text-doux",
  link: "font-bold text-action underline",
  topRow: "flex items-center justify-between",
  skip: "min-h-[42px] px-3 text-sm font-semibold text-doux active:text-texte",
  slideBox: "anim-in flex flex-1 flex-col justify-center gap-4 py-8 text-center",
  art: "h-40 w-full",
  slideText: "text-[13px] text-doux",
  dots: "flex items-center justify-center gap-2 pb-6",
  dotOn: "h-2 w-8 rounded-full bg-action transition-all duration-200",
  dotOff: "h-2 w-2 rounded-full bg-ligne transition-all duration-200",
  bottomBar: "safe-bottom flex gap-2 pb-2",
} as const;

/* ---------- Guide et latéral (desktop) ---------- */

export const GUIDE = {
  veil: "pointer-events-none fixed inset-0 z-40 bg-fond/60",
  pos: "fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xl lg:bottom-8",
  card: "anim-in rounded-xl border border-action bg-carte p-3 shadow-2xl",
  step: "text-[11px] font-semibold text-doux",
  title: "mt-1 text-[15px] font-extrabold",
  text: "mt-1 text-[13px] text-texte",
  btns: "mt-3 flex gap-2",
} as const;

export const SIDE = {
  bar: "fixed bottom-0 left-0 top-0 z-40 hidden w-[280px] flex-col gap-4 overflow-y-auto border-r border-ligne bg-fond p-4 lg:flex",
  logo: "flex items-center gap-2 px-1",
  logoMark: "flex h-8 w-8 items-center justify-center rounded-lg bg-carte text-base font-extrabold",
  logoName: "text-[15px] font-extrabold tracking-tight",
  nav: "flex flex-col gap-1",
  linkOn: "flex min-h-[44px] items-center gap-3 rounded-xl bg-carte px-3 text-sm font-bold text-white transition-colors duration-200",
  linkOff:
    "flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-bold text-doux transition-colors duration-200 hover:bg-carte hover:text-texte",
  linkIcon: "h-5 w-5 shrink-0",
  card: "rounded-2xl border border-ligne bg-carte p-3",
  cardTitle: "text-xs font-bold uppercase tracking-wide text-doux",
  acctRow: "mt-2 flex items-center gap-2.5",
  acctAvatar: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white",
  acctMail: "truncate text-sm font-bold",
  acctBal: "text-lg font-extrabold tabular-nums",
  statsGrid: "mt-2 grid grid-cols-2 gap-2 text-center",
  statTile: "rounded-xl bg-fond p-2",
  statNum: "text-lg font-extrabold tabular-nums",
  statLabel: "text-xs leading-tight text-doux",
  pnlRow: "flex items-center justify-between rounded-xl bg-fond px-2.5 py-2",
  pnlLabel: "text-xs font-bold text-doux",
  pnlVal: "text-base font-extrabold tabular-nums",
  logout:
    "flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-ligne bg-transparent text-sm font-bold text-doux transition-colors duration-200 hover:text-baisse",
  statsWrap: "mt-2 flex flex-col gap-2",
  skelGrid: "mt-2 grid grid-cols-2 gap-2",
  skel: "skeleton h-14 rounded-xl",
  spacer: "flex-1",
  acctMain: "min-w-0 flex-1",
} as const;

/* ---------- Sélecteur d'heure ---------- */

export const TIME = {
  box: "rounded-[10px] border border-ligne bg-fond p-0.5",
  grid: "grid grid-cols-3 gap-0.5",
} as const;

/* ---------- Tons de résultat ---------- */

export const RESULT = {
  col: "flex flex-col items-center gap-1 text-center",
  winText: "text-hausse",
  winBg: "bg-hausse/15",
  lossText: "text-baisse",
  lossBg: "bg-baisse/15",
  tieText: "text-action",
  tieBg: "bg-action/15",
  btn: "mt-2 w-full",
} as const;

/* ---------- Atomes de mise en page ---------- */

export const LAYOUT = {
  ringWrap: "relative shrink-0",
  /** L'anneau démarre en haut (le cercle SVG démarre à droite par défaut). */
  ringFlip: "-rotate-90",
  ringCenter: "absolute inset-0 flex flex-col items-center justify-center",
  helpWrap: "inline-flex",
  field: "block",
} as const;
