const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const commonjs = require('@babel/plugin-transform-modules-commonjs');
const code = babel.transformSync(fs.readFileSync('money.js','utf8'), {plugins:[commonjs],configFile:false,babelrc:false}).code;
const moduleObj={exports:{}}; vm.runInNewContext(code,{module:moduleObj,exports:moduleObj.exports,require});
const {localStake,money,potential}=moduleObj.exports;
for(const currency of ['USD','EUR','GBP','XOF','NGN','GHS']) {
  const n= ['XOF','NGN','GHS'].includes(currency)?'10000':'100';
  const exact=localStake(n,currency);
  const visible=money(0,exact,currency);
  assert.ok(visible.startsWith(n==='10000'?'10 000':'100,00'),currency+' '+visible);
  assert.equal(potential(n,currency),n==='10000' ? `18 500 ${currency==='XOF'?'₣':currency==='NGN'?'₦':'₵'}` : `185,00 ${currency==='USD'?'$':currency==='EUR'?'€':'£'}`);
}
assert.throws(()=>localStake('-1','USD')); assert.throws(()=>localStake('0','USD')); assert.throws(()=>localStake('x','USD'));
assert.equal(money(0,{numerator:'-12999',denominator:'1000'},'USD'),'−12,99 $');
console.log('Montants exacts : six devises, gains et troncature.');
assert.equal(money(0,localStake('1000.25','USD'),'USD','en'),'1,000.25 $');
assert.equal(money(0,localStake('1000.25','USD'),'USD','es'),'1.000,25 $');
