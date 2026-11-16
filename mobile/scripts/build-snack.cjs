#!/usr/bin/env node
// Génère un fichier unique mobile/snack/App.js prêt à coller dans Expo Snack (SDK 52).
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'snack', 'App.js');

const FILES = [
  'i18n.js',
  'otc.js',
  'theme.js',
  'money.js',
  'api.js',
  'components/Icons.js',
  'components/Ui.js',
  'components/CandleChart.js',
  'components/TradeCards.js',
  'components/ComboSheet.js',
  'screens/AuthScreens.js',
  'screens/TraderScreen.js',
  'screens/SignauxScreen.js',
  'screens/HistoriqueScreen.js',
  'screens/ProfilScreen.js',
  'App.js',
];

function resolveId(fromRel, req) {
  if (!req.startsWith('.')) return req;
  const fromDir = path.dirname(fromRel);
  let joined = path.posix.normalize(path.posix.join(fromDir, req));
  if (!joined.endsWith('.js')) joined += '.js';
  if (!FILES.includes(joined)) {
    throw new Error(`Module local inconnu: ${req} depuis ${fromRel} -> ${joined}`);
  }
  return './' + joined;
}

const rnNamed = new Set();
const reactNamed = new Set();
const svgNamed = new Set();

function collectAndRewritePlugin(fromRel) {
  return function () {
    return {
      visitor: {
        ImportDeclaration(p) {
          const src = p.node.source.value;
          for (const spec of p.node.specifiers) {
            if (spec.type === 'ImportSpecifier') {
              const name = spec.imported.name;
              if (src === 'react-native') rnNamed.add(name);
              else if (src === 'react') reactNamed.add(name);
              else if (src === 'react-native-svg') svgNamed.add(name);
            }
          }
        },
        CallExpression(p) {
          if (
            p.node.callee.type === 'Identifier' &&
            p.node.callee.name === 'require' &&
            p.node.arguments.length === 1 &&
            p.node.arguments[0].type === 'StringLiteral'
          ) {
            p.node.callee.name = '__req';
            p.node.arguments[0].value = resolveId(fromRel, p.node.arguments[0].value);
          }
        },
      },
    };
  };
}

const chunks = [];
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  const src = fs.readFileSync(full, 'utf8');
  const transformed = babel.transformSync(src, {
    filename: rel,
    comments: false,
    compact: true,
    configFile: false,
    babelrc: false,
    plugins: [
      require('@babel/plugin-transform-react-jsx'),
      require('@babel/plugin-transform-modules-commonjs'),
      collectAndRewritePlugin(rel),
    ],
  });
  chunks.push(`  ${JSON.stringify('./' + rel)}: function(module, exports, __req) {\n${transformed.code}\n  }`);
}

const rnList = [...rnNamed].sort();
const reactList = [...reactNamed].sort();
const svgList = [...svgNamed].sort();

const svgImportSpecs = svgList.map((n) => (n === 'Text' ? 'Text as _SvgText' : n));
const svgExportEntries = svgList.map((n) => (n === 'Text' ? 'Text: _SvgText' : n));

const output = `/* eslint-disable */
// TradeFacile mobile — Fichier unique pour Expo Snack (SDK 52).
// Généré automatiquement depuis mobile/ via : node scripts/build-snack.cjs
// Dépendances Snack (package.json) :
//   "big-integer": "^1.6.52",
//   "expo-secure-store": "~14.0.1",
//   "react-native-svg": "15.8.0"
import React, { ${reactList.join(', ')} } from 'react';
import { ${rnList.join(', ')} } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Svg, { ${svgImportSpecs.join(', ')} } from 'react-native-svg';
import bigInt from 'big-integer';

const __externals = {
  react: { __esModule: true, default: React, ${reactList.join(', ')} },
  'react-native': { __esModule: true, ${rnList.join(', ')} },
  'expo-secure-store': {
    __esModule: true,
    getItemAsync: SecureStore.getItemAsync,
    setItemAsync: SecureStore.setItemAsync,
    deleteItemAsync: SecureStore.deleteItemAsync,
  },
  'react-native-svg': { __esModule: true, default: Svg, ${svgExportEntries.join(', ')} },
  'big-integer': bigInt,
};

const __modules = {
${chunks.join(',\n')}
};

const __cache = {};
function __req(id) {
  if (Object.prototype.hasOwnProperty.call(__externals, id)) return __externals[id];
  if (__cache[id]) return __cache[id].exports;
  const factory = __modules[id];
  if (!factory) throw new Error('Module introuvable: ' + id);
  const mod = { exports: {} };
  __cache[id] = mod;
  factory(mod, mod.exports, __req);
  return mod.exports;
}

export default __req('./App.js').default;
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, output, 'utf8');
console.log(`Généré ${path.relative(ROOT, OUT)} (${(output.length / 1024).toFixed(1)} Ko, ${FILES.length} modules).`);
