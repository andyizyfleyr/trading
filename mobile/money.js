import bigInt from 'big-integer';

export const CURRENCIES = {
  USD: ['$', 2, '1', '1'],
  EUR: ['€', 2, '92', '100'],
  XOF: ['₣', 0, '60348044', '100000'],
  GBP: ['£', 2, '79', '100'],
  NGN: ['₦', 0, '1530', '1'],
  GHS: ['₵', 0, '152', '10'],
};

export function isCurrency(v) {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, v);
}

function reduceFrac(n, d) {
  if (d.isZero()) throw new Error('Division par zéro');
  if (d.isNegative()) {
    n = n.negate();
    d = d.negate();
  }
  if (n.isZero()) return { numerator: '0', denominator: '1' };
  const g = bigInt.gcd(n.abs(), d);
  return { numerator: n.divide(g).toString(), denominator: d.divide(g).toString() };
}

export function parseExact(exact) {
  if (exact && /^-?\d+$/.test(String(exact.numerator)) && /^\d+$/.test(String(exact.denominator))) {
    const d = bigInt(exact.denominator);
    if (!d.isZero()) return { n: bigInt(exact.numerator), d };
  }
  return null;
}

export function decimalToExact(value) {
  const s = String(value).trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const neg = s.startsWith('-');
  const clean = neg ? s.slice(1) : s;
  const [whole, frac = ''] = clean.split('.');
  const n = bigInt(whole + frac).multiply(neg ? -1 : 1);
  const d = bigInt(10).pow(frac.length);
  return reduceFrac(n, d);
}

export function compareExact(a, b) {
  const fa = parseExact(a);
  const fb = parseExact(b);
  if (!fa || !fb) return 0;
  return fa.n.multiply(fb.d).compare(fb.n.multiply(fa.d));
}

export function addExact(a, b) {
  const fa = parseExact(a);
  const fb = parseExact(b);
  if (!fa || !fb) return null;
  return reduceFrac(fa.n.multiply(fb.d).add(fb.n.multiply(fa.d)), fa.d.multiply(fb.d));
}

export function subtractExact(a, b) {
  const fa = parseExact(a);
  const fb = parseExact(b);
  if (!fa || !fb) return null;
  return reduceFrac(fa.n.multiply(fb.d).subtract(fb.n.multiply(fa.d)), fa.d.multiply(fb.d));
}

export function absExact(a) {
  const fa = parseExact(a);
  if (!fa) return undefined;
  return { numerator: fa.n.abs().toString(), denominator: fa.d.toString() };
}

export function exactGain(amountExact) {
  const fa = parseExact(amountExact);
  if (!fa) return undefined;
  return reduceFrac(fa.n.multiply(185), fa.d.multiply(100));
}

export function sumTradeAmounts(trades) {
  let sum = { numerator: '0', denominator: '1' };
  for (const trade of trades) {
    if (!trade.amountExact) return undefined;
    sum = addExact(sum, trade.amountExact);
    if (!sum) return undefined;
  }
  return sum;
}

function formatScaledInteger(scaled, places, symbol, lang) {
  const neg = scaled.isNegative();
  const digits = scaled.abs().toString().padStart(places + 1, '0');
  const whole = places ? digits.slice(0, -places) : digits;
  const group = lang === 'en' ? ',' : lang === 'es' ? '.' : ' ';
  const decimal = lang === 'en' ? '.' : ',';
  return `${neg ? '−' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, group)}${places ? decimal + digits.slice(-places) : ''} ${symbol}`;
}

function scaledToInputString(scaled, places) {
  const neg = scaled.isNegative();
  const digits = scaled.abs().toString().padStart(places + 1, '0');
  if (places === 0) return `${neg ? '-' : ''}${digits}`;
  const whole = digits.slice(0, -places);
  const frac = digits.slice(-places).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

// La division entière est volontaire : l'affichage coupe les décimales sans arrondir.
export function money(value, exact, currency = 'USD', lang = 'fr') {
  const [symbol, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  let n;
  let d;
  const parsed = parseExact(exact);
  if (parsed) {
    n = parsed.n;
    d = parsed.d;
  } else {
    const num = String(Number(value) || 0);
    const parts = num.split('.');
    if (/[eE]/.test(num)) return '—';
    n = bigInt(parts.join(''));
    d = bigInt(10).pow((parts[1] || '').length);
  }
  if (d.isZero()) return '—';
  const scaled = n.multiply(rateN).multiply(bigInt(10).pow(places)).divide(d.multiply(rateD));
  return formatScaledInteger(scaled, places, symbol, lang);
}

/** Formate un montant déjà dans la devise (ex. 0 ou gain théorique), tronqué. */
export function formatCurrencyLocal(amount, currency = 'USD', lang = 'fr') {
  const [symbol, places] = CURRENCIES[currency] || CURRENCIES.USD;
  const frac = decimalToExact(Number(amount) || 0);
  if (!frac) return `0 ${symbol}`;
  const parsed = parseExact(frac);
  const scaled = parsed.n.multiply(bigInt(10).pow(places)).divide(parsed.d);
  return formatScaledInteger(scaled, places, symbol, lang);
}

/** Convertit un montant USD vers la devise pour préremplir un champ (tronqué). */
export function convertUsdToInput(usd, currency = 'USD') {
  const [, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  const frac = decimalToExact(usd);
  if (!frac) return '0';
  const parsed = parseExact(frac);
  const scaled = parsed.n.multiply(rateN).multiply(bigInt(10).pow(places)).divide(parsed.d.multiply(rateD));
  return scaledToInputString(scaled, places);
}

/** Convertit une fraction exacte USD en chaîne de saisie dans la devise (tronquée). */
export function exactToInput(exact, currency = 'USD') {
  const [, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  const parsed = parseExact(exact);
  if (!parsed) return '0';
  const scaled = parsed.n.multiply(rateN).multiply(bigInt(10).pow(places)).divide(parsed.d.multiply(rateD));
  return scaledToInputString(scaled, places);
}

/** Convertit un montant dans la devise en USD flottant (accompagne amountExact). */
export function convertToUsdNumber(amount, currency = 'USD') {
  const [, , rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  const rate = Number(rateN) / Number(rateD);
  return Number(amount) / rate;
}

/** Incrémente/décrémente la mise (boutons − / +) au pas minimum, plafonné au solde. */
export function stepBetAmount(currentStr, dir, currency = 'USD', balance = 0, balanceExact = null, minBetUsd = 10, defaultBetUsd = 50) {
  const [, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  const scale = bigInt(10).pow(places);
  // Pas = ceil(minBetUsd * rate * 10^places)
  const stepNum = bigInt(minBetUsd).multiply(rateN).multiply(scale);
  const stepDen = bigInt(rateD);
  const divMod = stepNum.divmod(stepDen);
  const step = divMod.remainder.isZero() ? divMod.quotient : divMod.quotient.add(1);

  // Plafond = trunc(balance * rate * 10^places)
  const balParsed = parseExact(balanceExact) || parseExact(decimalToExact(Math.max(0, Number(balance) || 0)));
  let cap = bigInt(0);
  if (balParsed) {
    cap = balParsed.n.multiply(rateN).multiply(scale).divide(balParsed.d.multiply(rateD));
    if (cap.isNegative()) cap = bigInt(0);
  }

  // Valeur courante
  const cleaned = String(currentStr || '').trim().replace(',', '.');
  let cur;
  const curFrac = /^\d+(?:\.\d+)?$/.test(cleaned) ? parseExact(decimalToExact(cleaned)) : null;
  if (curFrac && curFrac.n.greater(0)) {
    cur = curFrac.n.multiply(scale).divide(curFrac.d);
  } else {
    const defFrac = parseExact(decimalToExact(defaultBetUsd));
    cur = defFrac.n.multiply(rateN).multiply(scale).divide(defFrac.d.multiply(rateD));
  }

  let next;
  if (dir > 0) {
    const candidate = cur.add(step);
    next = candidate.greater(cap) ? cap : candidate;
  } else {
    const candidate = cur.subtract(step);
    next = candidate.lesser(step) ? step : candidate;
  }
  if (next.isNegative()) next = bigInt(0);
  return scaledToInputString(next, places);
}

// Les fractions évitent toute perte lors des conversions périodiques vers USD.
export function localStake(input, currency) {
  const cleaned = String(input || '').trim().replace(',', '.');
  if (!/^\d{1,30}(?:\.\d{1,9})?$/.test(cleaned) || !CURRENCIES[currency]) {
    throw new Error('Montant de mise invalide.');
  }
  const [whole, decimals = ''] = cleaned.split('.');
  const [, , rateN, rateD] = CURRENCIES[currency];
  let n = bigInt(whole + decimals).multiply(rateD);
  let d = bigInt(10).pow(decimals.length).multiply(rateN);
  if (n.isZero()) throw new Error('Montant de mise invalide.');
  const g = bigInt.gcd(n, d);
  n = n.divide(g);
  d = d.divide(g);
  return { numerator: n.toString(), denominator: d.toString() };
}

export function potential(input, currency, legs = 1, exact = null, lang = 'fr') {
  try {
    const value = exact || localStake(input, currency);
    const n = bigInt(value.numerator).multiply(bigInt(185).pow(legs));
    const d = bigInt(value.denominator).multiply(bigInt(100).pow(legs));
    // Le combiné est plafonné par le serveur à 5 millions de dollars.
    const cap = bigInt(5000000);
    const limited =
      legs > 1 && n.greater(cap.multiply(d))
        ? { numerator: cap.toString(), denominator: '1' }
        : { numerator: n.toString(), denominator: d.toString() };
    return money(0, limited, currency, lang);
  } catch (_) {
    return '—';
  }
}
