const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const ts = require('@babel/plugin-transform-typescript');
const commonjs = require('@babel/plugin-transform-modules-commonjs');
function load(source, typescript = false) {
  const code = babel.transformSync(source, { plugins: [...(typescript ? [ts] : []), commonjs], configFile:false, babelrc:false }).code;
  const module = {exports:{}};
  vm.runInNewContext(code, {module,exports:module.exports,Math,require});
  return module.exports;
}
const site = fs.readFileSync('../lib/otc.ts','utf8');
const source = 'const symbolDecimals = (s: string) => s === "EURUSDOTC" ? 3 : 2;\ntype Interval = "1m" | "5m" | "15m";\n' + site.slice(site.indexOf('/**'),site.indexOf('/** Prix casino actuel'));
const web = load(source,true), mobile = load(fs.readFileSync('otc.js','utf8'));
for (const game of ['EURUSDOTC','GBPUSDOTC','USDJPYOTC']) for (let t=1700000000;t<1700001000;t+=7) assert.equal(mobile.otcPriceAt(game,t),web.otcPriceAt(game,t),`${game} ${t}`);
console.log('Signaux natifs : prix identiques au moteur du site.');
