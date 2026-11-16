const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const renderer = require('react-test-renderer');

const { act } = renderer;
const modules = {};
const calls = [];
const store = new Map();

const profile = {
  id: 1,
  email: 'test@example.com',
  currency: 'XOF',
  country: 'BJ',
  lang: 'fr',
  balance: 1000,
  balanceExact: { numerator: '1000', denominator: '1' },
};

const nowIso = new Date().toISOString();
const openTrade = {
  id: 42,
  symbol: 'EURUSDOTC',
  direction: 'UP',
  amount: 50,
  amountExact: { numerator: '50', denominator: '1' },
  openPrice: 7.777,
  closePrice: null,
  durationSec: 60,
  status: 'OPEN',
  result: null,
  payout: null,
  openedAt: nowIso,
  closesAt: new Date(Date.now() + 60000).toISOString(),
};
const settledTrade = {
  id: 41,
  symbol: 'EURUSDOTC',
  direction: 'UP',
  amount: 50,
  amountExact: { numerator: '50', denominator: '1' },
  openPrice: 7.77,
  closePrice: 7.78,
  durationSec: 60,
  status: 'SETTLED',
  result: 'WIN',
  payout: 92.5,
  payoutExact: { numerator: '185', denominator: '2' },
  openedAt: nowIso,
  closesAt: nowIso,
};

function makeAnimatedValue(initial) {
  return {
    _value: initial,
    setValue(v) {
      this._value = v;
    },
  };
}

const native = {
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert() {} },
  Animated: {
    Value: makeAnimatedValue,
    View: 'AnimatedView',
    loop: () => ({ start() {}, stop() {} }),
    sequence: () => ({ start() {}, stop() {} }),
    timing: () => ({ start() {}, stop() {} }),
  },
  AppState: { addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: ({ visible, children }) => (visible ? React.createElement('Modal', null, children) : null),
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  Share: { share: async () => ({}) },
  StatusBar: 'StatusBar',
  StyleSheet: { create: (s) => s, absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  Vibration: { vibrate() {} },
  View: 'View',
};

const svgMock = {
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  ClipPath: 'ClipPath',
  Defs: 'Defs',
  G: 'G',
  Line: 'Line',
  Path: 'Path',
  Rect: 'Rect',
  Text: 'SvgText',
};

const secureStoreMock = {
  getItemAsync: async (k) => (store.has(k) ? store.get(k) : null),
  setItemAsync: async (k, v) => {
    store.set(k, v);
  },
  deleteItemAsync: async (k) => {
    store.delete(k);
  },
};

const ROOT = path.resolve(__dirname, '..');

function resolveLocal(fromFile, req) {
  const base = path.resolve(path.dirname(fromFile), req);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  if (fs.existsSync(base + '.js')) return base + '.js';
  throw new Error(`Module introuvable: ${req} depuis ${fromFile}`);
}

function load(filePath) {
  const full = path.resolve(filePath);
  if (modules[full]) return modules[full].exports;
  const mod = { exports: {} };
  modules[full] = mod;
  const js = babel.transformSync(fs.readFileSync(full, 'utf8'), {
    plugins: [
      require('@babel/plugin-transform-react-jsx'),
      require('@babel/plugin-transform-modules-commonjs'),
    ],
    configFile: false,
    babelrc: false,
  }).code;

  const localRequire = (id) => {
    if (id === 'react') return React;
    if (id === 'react-native') return native;
    if (id === 'expo-secure-store') return secureStoreMock;
    if (id === 'react-native-svg') return svgMock;
    if (id.startsWith('.')) return load(resolveLocal(full, id));
    return require(id);
  };

  const fetchMock = async (url, opts = {}) => {
    const reqPath = url.replace('https://tradefacile-sand.vercel.app', '');
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ path: reqPath, method: opts.method || 'GET', body });
    let data = {};
    if (reqPath.includes('/auth/')) {
      data = { token: 'token', user: profile };
    } else if (reqPath === '/api/me') {
      data = { user: profile };
    } else if (reqPath.startsWith('/api/candles')) {
      data = {
        candles: [
          { time: 1700000000, open: 7.77, close: 7.775, high: 7.778, low: 7.768 },
          { time: 1700000060, open: 7.775, close: 7.777, high: 7.78, low: 7.772 },
        ],
      };
    } else if (reqPath.startsWith('/api/price')) {
      data = { price: 7.777, time: Date.now() };
    } else if (reqPath === '/api/trades/settle') {
      data = { settled: [], balance: 1000, balanceExact: profile.balanceExact };
    } else if (reqPath.startsWith('/api/trades?status=open')) {
      data = { trades: [] };
    } else if (reqPath.startsWith('/api/trades?status=scheduled')) {
      data = { trades: [] };
    } else if (reqPath.startsWith('/api/trades?status=all')) {
      data = { trades: [settledTrade] };
    } else if (reqPath === '/api/trades') {
      data = {
        trade: openTrade,
        balance: 950,
        balanceExact: { numerator: '950', denominator: '1' },
      };
    } else if (reqPath === '/api/scheduled') {
      data = {
        scheduled: { ...openTrade, id: 43, openedAt: new Date(body.slot * 1000).toISOString() },
        balance: 950,
        balanceExact: { numerator: '950', denominator: '1' },
      };
    } else if (reqPath.startsWith('/api/me/stats')) {
      data = {
        stats: {
          settled: 1,
          wins: 1,
          losses: 0,
          ties: 0,
          winRate: 100,
          pnl: 42.5,
          pnlExact: { numerator: '85', denominator: '2' },
        },
      };
    } else if (reqPath === '/api/me/deposit') {
      data = {
        user: {
          ...profile,
          balance: 2000,
          balanceExact: { numerator: '2000', denominator: '1' },
        },
      };
    } else if (reqPath === '/api/me/currency') {
      data = {
        user: {
          ...profile,
          currency: body.currency || 'EUR',
          country: body.country || profile.country,
        },
      };
    } else if (reqPath === '/api/me/lang') {
      data = { user: { ...profile, lang: body.lang } };
    }
    return { ok: true, json: async () => ({ data }) };
  };

  vm.runInNewContext(
    js,
    {
      module: mod,
      exports: mod.exports,
      require: localRequire,
      fetch: fetchMock,
      AbortController,
      Date,
      Math,
      Number,
      String,
      RegExp,
      JSON,
      Array,
      Object,
      Promise,
      Error,
      Map,
      Set,
      setTimeout,
      clearTimeout,
      setInterval: () => 1,
      clearInterval: () => {},
      console,
    },
    { filename: full }
  );
  return mod.exports;
}

const ENTRY = process.env.APP_ENTRY ? path.join(ROOT, process.env.APP_ENTRY) : path.join(ROOT, 'App.js');
const App = load(ENTRY).default;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function allText(node) {
  return node
    .findAllByType('Text')
    .map((t) =>
      t.children
        .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
        .join('')
    );
}

function hasText(root, needle) {
  return allText(root.root).some((txt) => txt.includes(needle));
}

function findButton(root, label) {
  const node = root.root
    .findAllByType('TouchableOpacity')
    .find((n) => allText(n).some((txt) => txt.includes(label)));
  assert.ok(node, 'Bouton manquant : ' + label);
  return node;
}

(async () => {
  // Marque le guide comme déjà vu pour tester le flux direct, puis teste Bienvenue + Connexion
  store.set('tf_guide', '1');
  let root;
  try {
  await act(async () => {
    root = renderer.create(React.createElement(App));
  });
  await flush();

  // 1. Connexion -> Bienvenue (3 slides) -> Inscription -> Connexion
  assert.ok(hasText(root, 'Bon retour !'), 'Écran Connexion attendu');
  await act(async () => findButton(root, "Découvrir l'app en 3 écrans").props.onPress());
  assert.ok(hasText(root, 'Prédis si le prix monte ou descend'), 'Slide 1 Bienvenue attendue');
  await act(async () => findButton(root, 'Suivant').props.onPress());
  assert.ok(hasText(root, '3 jeux, 100 % hasard'), 'Slide 2 Bienvenue attendue');
  await act(async () => findButton(root, 'Suivant').props.onPress());
  assert.ok(hasText(root, 'Apprends sans risque'), 'Slide 3 Bienvenue attendue');
  await act(async () => findButton(root, 'Commencer').props.onPress());
  assert.ok(hasText(root, 'Crée ton compte'), 'Écran Inscription attendu');
  await act(async () => findButton(root, 'Se connecter').props.onPress());

  // 2. Connexion avec email/mot de passe
  const inputs = root.root.findAllByType('TextInput');
  assert.equal(inputs.length, 2);
  await act(async () => {
    inputs[0].props.onChangeText('test@example.com');
    inputs[1].props.onChangeText('password123');
  });
  await act(async () => findButton(root, 'Se connecter').props.onPress());
  await flush();
  assert.ok(calls.some((c) => c.path === '/api/auth/login'), 'Appel login attendu');

  // 3. Écran Trader : panneau Quotex (Lucky 7, 85%, Durée 01:00, Investissement, Gain potentiel, Hausse/Baisse)
  assert.ok(hasText(root, 'Lucky 7'), 'Jeu Lucky 7 attendu');
  assert.ok(hasText(root, '85%'), 'Payout 85% attendu');
  assert.ok(hasText(root, '01:00'), 'Durée par défaut 01:00 attendue');
  assert.ok(hasText(root, 'Investissement (₣)'), 'Étiquette Investissement (₣) attendue');
  assert.ok(hasText(root, 'Gain potentiel'), 'Ligne Gain potentiel attendue');

  // Modifie la mise à 10000 ₣ et clique sur Hausse
  const betInput = root.root.findAllByType('TextInput')[0];
  await act(async () => betInput.props.onChangeText('10000'));
  await act(async () => findButton(root, 'Hausse').props.onPress());
  await flush();
  const tradeCall = calls.find((c) => c.path === '/api/trades' && c.method === 'POST');
  assert.ok(tradeCall, 'Appel POST /api/trades attendu');
  assert.equal(tradeCall.body.direction, 'UP');
  assert.equal(tradeCall.body.amountExact.numerator, '250000000');
  assert.equal(tradeCall.body.amountExact.denominator, '15087011');
  assert.ok(hasText(root, '1 en cours'), 'Pastille 1 en cours attendue');

  // 4. Écran Signaux : consigne géante + 20 coups + Préparer ma mise →
  await act(async () => findButton(root, 'Signaux').props.onPress());
  await flush();
  assert.ok(hasText(root, 'Signaux casino'), 'Titre Signaux casino attendu');
  assert.ok(hasText(root, 'Comment ne pas louper le coup'), 'Section Comment faire attendue');
  assert.ok(hasText(root, 'Les coups à venir'), 'Section Les coups à venir attendue');
  assert.ok(hasText(root, 'À JOUER'), 'Badge À JOUER attendu');
  await act(async () => findButton(root, 'Préparer ma mise →').props.onPress());
  await flush();
  assert.ok(hasText(root, 'appuie sur'), 'Bannière signal active attendue sur Trader');

  // Vérifie le panneau Durée ou départ + Autre (TimePicker)
  await act(async () => findButton(root, '01:00').props.onPress());
  assert.ok(hasText(root, 'Maintenant'), 'Panneau Durée/Départ attendu');
  await act(async () => findButton(root, 'Autre').props.onPress());
  assert.ok(hasText(root, 'Revenir à Maintenant'), 'TimePicker attendu');
  await act(async () => findButton(root, 'Revenir à Maintenant').props.onPress());

  // 5. Écran Historique : stats 3 colonnes, filtres, lignes groupées par jour
  await act(async () => findButton(root, 'Historique').props.onPress());
  await flush();
  assert.ok(hasText(root, 'Terminés'), 'Stat Terminés attendue');
  assert.ok(hasText(root, 'Réussite'), 'Stat Réussite attendue');
  assert.ok(hasText(root, 'Tous les jeux'), 'Filtre Tous les jeux attendu');
  assert.ok(hasText(root, "Aujourd'hui"), 'Groupe Aujourd hui attendu');

  // 6. Écran Profil : Ajouter (BottomSheet), Devise, Langue, Réduire les animations
  const headerPill = root.root
    .findAllByType('TouchableOpacity')
    .find((n) => (n.props.accessibilityLabel || '').includes('Aller au profil'));
  assert.ok(headerPill, 'Pastille solde du header attendue');
  await act(async () => headerPill.props.onPress());
  await flush();
  assert.ok(hasText(root, 'Profil'), 'Titre Profil attendu');
  assert.ok(hasText(root, 'Réduire les animations'), 'Option Réduire les animations attendue');

  // Ouvre le panneau Ajouter et ajoute +1000 USD
  await act(async () => findButton(root, 'Ajouter').props.onPress());
  assert.ok(hasText(root, 'Ajouter au solde'), 'Panneau Ajouter au solde attendu');
  const modal = root.root.findByType('Modal');
  const depositOpt = modal
    .findAllByType('TouchableOpacity')
    .find((n) => allText(n).some((txt) => txt.includes('603 480 ₣')));
  assert.ok(depositOpt, 'Option dépôt 1000 USD en XOF attendue');
  await act(async () => depositOpt.props.onPress());
  await flush();
  assert.ok(calls.some((c) => c.path === '/api/me/deposit' && c.body.amount === 1000));

  // Change la langue vers English via le sélecteur Langue
  const langBtn = root.root
    .findAllByType('TouchableOpacity')
    .find((n) => n.props.accessibilityLabel === 'Langue');
  assert.ok(langBtn, 'Bouton Langue attendu');
  await act(async () => langBtn.props.onPress());
  await act(async () => findButton(root, 'English').props.onPress());
  await flush();
  assert.ok(calls.some((c) => c.path === '/api/me/lang' && c.body.lang === 'en'));
  assert.ok(hasText(root, 'Profile'), 'Traduction anglaise Profile attendue');

  console.log('Parité mobile complète : Bienvenue, Connexion, Trader (Quotex), Signaux, Historique et Profil testés.');
  } finally {
    if (root) {
      await act(async () => root.unmount());
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
