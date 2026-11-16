import bigInt from 'big-integer';

export const CURRENCIES = { USD:['$',2,'1','1'], EUR:['€',2,'92','100'], XOF:['₣',0,'60348044','100000'], GBP:['£',2,'79','100'], NGN:['₦',0,'1530','1'], GHS:['₵',0,'152','10'] };

// La division entière est volontaire : l'affichage coupe les décimales sans arrondir.
export function money(value, exact, currency='USD', lang='fr') {
  const [symbol, places, rateN, rateD] = CURRENCIES[currency] || CURRENCIES.USD;
  let n, d;
  if (exact && /^-?\d+$/.test(exact.numerator) && /^\d+$/.test(exact.denominator)) {
    n = bigInt(exact.numerator); d = bigInt(exact.denominator);
  } else {
    const num = String(Number(value) || 0); const parts = num.split('.');
    if (/[eE]/.test(num)) return '—';
    n = bigInt(parts.join('')); d = bigInt(10).pow((parts[1] || '').length);
  }
  if (d.isZero()) return '—';
  const scaled = n.multiply(rateN).multiply(bigInt(10).pow(places)).divide(d.multiply(rateD));
  const neg = scaled.isNegative(); const digits = scaled.abs().toString().padStart(places + 1, '0');
  const whole = places ? digits.slice(0,-places) : digits;
  const group = lang === 'en' ? ',' : lang === 'es' ? '.' : ' '; const decimal = lang === 'en' ? '.' : ',';
  return `${neg ? '−' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, group)}${places ? decimal + digits.slice(-places) : ''} ${symbol}`;
}

// Les fractions évitent toute perte lors des conversions périodiques vers USD.
export function localStake(input, currency) {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d{1,30}(?:\.\d{1,9})?$/.test(cleaned) || !CURRENCIES[currency]) throw new Error('Montant de mise invalide.');
  const [whole, decimals = ''] = cleaned.split('.');
  const [, , rateN, rateD] = CURRENCIES[currency];
  let n = bigInt(whole + decimals).multiply(rateD), d = bigInt(10).pow(decimals.length).multiply(rateN);
  if (n.isZero()) throw new Error('Montant de mise invalide.');
  const g = bigInt.gcd(n, d); n = n.divide(g); d = d.divide(g);
  return { numerator: n.toString(), denominator: d.toString() };
}
export function potential(input, currency, legs = 1, exact = null, lang = 'fr') {
  try { const value = exact || localStake(input, currency); const n = bigInt(value.numerator).multiply(bigInt(185).pow(legs)); const d = bigInt(value.denominator).multiply(bigInt(100).pow(legs));
    // Le combiné est plafonné par le serveur à 5 millions de dollars.
    const cap = bigInt(5000000); const limited = legs > 1 && n.greater(cap.multiply(d)) ? {numerator:cap.toString(),denominator:'1'} : {numerator:n.toString(),denominator:d.toString()};
    return money(0, limited, currency, lang);
  } catch (_) { return '—'; }
}
