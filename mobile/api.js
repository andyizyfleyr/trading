// Client HTTP identique à lib/api.ts : Bearer token, x-lang, timeout 15 s.
import { CONFIG, SYMBOLS } from './theme';

export const SITE = 'https://tradefacile-sand.vercel.app';

export class ApiError extends Error {
  constructor(message, code = 'ERREUR', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

let sessionContext = {
  token: null,
  lang: 'fr',
  onExpired: null,
  onNetworkState: null,
};

export function configureApi(next) {
  sessionContext = { ...sessionContext, ...next };
}

export async function request(path, options = {}) {
  const { method, body, token: tokenOverride, lang: langOverride } = options;
  const token = tokenOverride !== undefined ? tokenOverride : sessionContext.token;
  const lang = langOverride !== undefined ? langOverride : sessionContext.lang || 'fr';

  const headers = {
    'Content-Type': 'application/json',
    'x-lang': lang,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.API_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(SITE + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (sessionContext.onNetworkState) sessionContext.onNetworkState(true);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new ApiError('Le serveur met trop longtemps à répondre.', 'DELAI_DEPASSE', 0);
    }
    if (sessionContext.onNetworkState) sessionContext.onNetworkState(false);
    throw new ApiError('Pas de connexion Internet. Vérifiez votre connexion.', 'HORS_LIGNE', 0);
  } finally {
    clearTimeout(timer);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = json && json.error;
    if ((res.status === 401 || res.status === 403) && !path.startsWith('/api/auth/') && sessionContext.onExpired) {
      sessionContext.onExpired();
    }
    throw new ApiError(
      (err && err.message) || 'Une erreur est survenue.',
      (err && err.code) || 'ERREUR',
      res.status
    );
  }
  return json && json.data;
}

export const apiRegister = (email, password) =>
  request('/api/auth/register', { method: 'POST', body: { email, password }, token: null });

export const apiLogin = (email, password) =>
  request('/api/auth/login', { method: 'POST', body: { email, password }, token: null });

export const apiMe = (tokenOverride) =>
  request('/api/me', tokenOverride !== undefined ? { token: tokenOverride } : {});

export const apiDeposit = (amount) =>
  request('/api/me/deposit', { method: 'POST', body: { amount } });

export const apiWithdraw = (amount) =>
  request('/api/me/withdraw', { method: 'POST', body: { amount } });

export const apiSetCurrency = (input) =>
  request('/api/me/currency', { method: 'PUT', body: input });

export const apiSetLang = (lang) =>
  request('/api/me/lang', { method: 'PUT', body: { lang } });

export const apiMyStats = (symbol) =>
  request(symbol ? `/api/me/stats?symbol=${encodeURIComponent(symbol)}` : '/api/me/stats');

export const apiCandles = (symbol, interval = '1m', limit = CONFIG.CANDLES_LIMIT) =>
  request(
    `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
  );

export const apiGetPrice = async (symbol) => {
  const d = await request(`/api/price?symbol=${encodeURIComponent(symbol)}`);
  return d.price;
};

export const apiServerTime = async () => {
  const d = await request(`/api/price?symbol=${encodeURIComponent(SYMBOLS[0].id)}`);
  return d.time;
};

export const apiMyTrades = (status = 'all', limit = CONFIG.TRADES_PAGE_LIMIT) =>
  request(`/api/trades?status=${status}&limit=${limit}`);

export const apiScheduleTrade = (input) =>
  request('/api/scheduled', { method: 'POST', body: input });

export const apiCancelScheduled = (id) =>
  request(`/api/scheduled/${id}`, { method: 'DELETE' });

export const apiOpenTrade = (input) =>
  request('/api/trades', { method: 'POST', body: input });

export const apiSettle = (ids) =>
  request('/api/trades/settle', { method: 'POST', body: ids ? { ids } : {} });

export const apiPlaceCombo = (amount, legs, amountExact) =>
  request('/api/combos', {
    method: 'POST',
    body: { amount, legs, ...(amountExact ? { amountExact } : {}) },
  });

export const apiMyCombos = (limit = CONFIG.TRADES_PAGE_LIMIT) =>
  request(`/api/combos?limit=${limit}`);
