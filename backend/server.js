import { createServer as nodeCreateServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']);
const DEFAULT_MAX_ORDER = 25;
const DEFAULT_MIN_ORDER = 10;
const WINDOW_MS = 60_000;
const generalHits = new Map();
const orderHits = new Map();
let exchangeFilters = { updatedAt: 0, symbols: new Map() };

export function configFrom(env = process.env) {
  const testnet = env.BINANCE_TESTNET !== 'false';
  const liveEnabled = !testnet && env.LIVE_TRADING_ENABLED === 'true';
  const token = env.APP_ACCESS_TOKEN || '';
  return {
    testnet,
    liveEnabled,
    token,
    apiKey: env.BINANCE_API_KEY || '',
    apiSecret: env.BINANCE_API_SECRET || '',
    maxOrder: positiveNumber(env.MAX_ORDER_USDT, DEFAULT_MAX_ORDER),
    minOrder: positiveNumber(env.MIN_ORDER_USDT, DEFAULT_MIN_ORDER),
    host: testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com',
    origins: (env.APP_ORIGINS || 'https://localhost,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  };
}
function positiveNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
export function floorToStep(value, stepText) {
  const valueN = Number(value), stepN = Number(stepText);
  if (!Number.isFinite(valueN) || !Number.isFinite(stepN) || valueN <= 0 || stepN <= 0) return '0';
  const decimals = Math.min(12, (String(stepText).split('.')[1] || '').length);
  const factor = 10 ** decimals;
  const valueInt = Math.floor(valueN * factor + 1e-8);
  const stepInt = Math.round(stepN * factor);
  if (!stepInt) return '0';
  return ((Math.floor(valueInt / stepInt) * stepInt) / factor).toFixed(decimals);
}
export function signQuery(params, secret) {
  const query = new URLSearchParams(params).toString();
  const signature = createHmac('sha256', secret).update(query).digest('hex');
  return `${query}&signature=${signature}`;
}
export function validOrderInput(body, cfg) {
  if (!body || body.confirm !== true) return { error: 'Explicit order confirmation is required.' };
  if (!SYMBOLS.has(body.symbol)) return { error: 'This symbol is not enabled.' };
  if (!['BUY', 'SELL'].includes(body.side)) return { error: 'Only spot BUY and SELL are supported.' };
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Order amount must be a positive number.' };
  if (body.side === 'BUY') {
    if (amount < cfg.minOrder) return { error: `Minimum simulated order input is ${cfg.minOrder} USDT.` };
    if (amount > cfg.maxOrder) return { error: `Order exceeds the configured ${cfg.maxOrder} USDT per-order cap.` };
  }
  return { symbol: body.symbol, side: body.side, amount };
}
function tokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function limited(map, key, limit) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) { entry = { start: now, count: 0 }; map.set(key, entry); }
  entry.count++;
  if (map.size > 3000) for (const [k, v] of map) if (now - v.start >= WINDOW_MS) map.delete(k);
  return entry.count <= limit;
}
function reply(res, status, body, corsOrigin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Max-Age'] = '600';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}
function requestJson(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(9_000) }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Exchange rejected the request (${response.status}).`);
      error.status = response.status;
      error.exchangeMessage = typeof data.msg === 'string' ? data.msg.slice(0, 180) : '';
      throw error;
    }
    return data;
  });
}
async function signedRequest(cfg, path, params = {}, method = 'GET') {
  if (!cfg.apiKey || !cfg.apiSecret) { const error = new Error('Binance API credentials are not configured on the backend.'); error.status = 503; throw error; }
  const allParams = { ...params, recvWindow: '5000', timestamp: String(Date.now()) };
  const query = signQuery(allParams, cfg.apiSecret);
  return requestJson(`${cfg.host}${path}?${query}`, { method, headers: { 'X-MBX-APIKEY': cfg.apiKey } });
}
async function getPrice(cfg, symbol) {
  if (!SYMBOLS.has(symbol)) throw Object.assign(new Error('Unsupported symbol.'), { status: 400 });
  const response = await requestJson(`${cfg.host}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`);
  const price = Number(response.price);
  if (!Number.isFinite(price) || price <= 0) throw Object.assign(new Error('Exchange returned an invalid quote.'), { status: 502 });
  return price;
}
async function getSymbolFilters(cfg, symbol) {
  if (Date.now() - exchangeFilters.updatedAt > 5 * 60_000 || !exchangeFilters.symbols.has(symbol)) {
    const info = await requestJson(`${cfg.host}/api/v3/exchangeInfo?symbols=${encodeURIComponent(JSON.stringify([...SYMBOLS]))}`);
    const symbols = new Map();
    for (const item of info.symbols || []) {
      const filters = Object.fromEntries((item.filters || []).map(f => [f.filterType, f]));
      symbols.set(item.symbol, {
        stepSize: filters.LOT_SIZE?.stepSize || '0.000001',
        minQty: Number(filters.LOT_SIZE?.minQty || 0),
        minNotional: Number(filters.NOTIONAL?.minNotional || filters.MIN_NOTIONAL?.minNotional || 0),
        quoteOrderQtyMarketAllowed: item.quoteOrderQtyMarketAllowed !== false,
      });
    }
    exchangeFilters = { updatedAt: Date.now(), symbols };
  }
  const result = exchangeFilters.symbols.get(symbol);
  if (!result) throw Object.assign(new Error('Symbol trading rules are unavailable.'), { status: 503 });
  return result;
}
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }); }
}
function publicStatus(cfg) {
  const credentialsConfigured = Boolean(cfg.apiKey && cfg.apiSecret);
  const ordersEnabled = credentialsConfigured && (cfg.testnet || cfg.liveEnabled);
  return {
    mode: cfg.testnet ? 'TESTNET' : 'LIVE SPOT',
    liveTradingEnabled: cfg.liveEnabled,
    credentialsConfigured,
    ordersEnabled,
    maxOrderUsdt: cfg.maxOrder,
    minOrderUsdt: cfg.minOrder,
    symbols: [...SYMBOLS],
    note: cfg.testnet ? 'Orders use Binance Spot Testnet funds.' : cfg.liveEnabled ? 'Real spot orders are enabled; every order requires a user confirmation.' : 'Real orders are disabled by backend configuration.',
  };
}

export function createApiServer({ env = process.env } = {}) {
  const cfg = configFrom(env);
  return nodeCreateServer(async (req, res) => {
    const origin = req.headers.origin || '';
    const corsOrigin = origin && cfg.origins.includes(origin) ? origin : '';
    if (origin && !corsOrigin) { reply(res, 403, { error: 'This app origin is not allowed by backend configuration.' }); return; }
    if (req.method === 'OPTIONS') { reply(res, 204, {}, corsOrigin); return; }
    const address = req.socket.remoteAddress || 'unknown';
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health' && req.method === 'GET') { reply(res, 200, { status: 'ok' }, corsOrigin); return; }
    if (!url.pathname.startsWith('/api/')) { reply(res, 404, { error: 'Not found.' }, corsOrigin); return; }
    if (!limited(generalHits, address, 120)) { reply(res, 429, { error: 'Request rate limit reached. Try again shortly.' }, corsOrigin); return; }
    const auth = String(req.headers.authorization || '');
    const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!tokenMatches(supplied, cfg.token)) { reply(res, 401, { error: 'Backend access token is missing or invalid.' }, corsOrigin); return; }
    try {
      if (url.pathname === '/api/status' && req.method === 'GET') {
        reply(res, 200, publicStatus(cfg), corsOrigin); return;
      }
      if (url.pathname === '/api/quote' && req.method === 'GET') {
        const symbol = url.searchParams.get('symbol');
        const price = await getPrice(cfg, symbol);
        reply(res, 200, { symbol, price, mode: cfg.testnet ? 'TESTNET' : 'LIVE SPOT', updatedAt: Date.now() }, corsOrigin); return;
      }
      if (url.pathname === '/api/account' && req.method === 'GET') {
        const data = await signedRequest(cfg, '/api/v3/account', { omitZeroBalances: 'true' });
        const allowedAssets = new Set(['USDT', 'BTC', 'ETH', 'SOL', 'BNB']);
        const balances = (data.balances || []).filter(x => allowedAssets.has(x.asset)).map(x => ({ asset: x.asset, free: String(x.free), locked: String(x.locked) }));
        reply(res, 200, { balances, mode: cfg.testnet ? 'TESTNET' : 'LIVE SPOT', fetchedAt: Date.now() }, corsOrigin); return;
      }
      if (url.pathname === '/api/order' && req.method === 'POST') {
        if (!limited(orderHits, address, 8)) { reply(res, 429, { error: 'Order request limit reached. Try again later.' }, corsOrigin); return; }
        if (!cfg.testnet && !cfg.liveEnabled) { reply(res, 403, { error: 'Live trading is disabled on this backend.' }, corsOrigin); return; }
        const body = await readBody(req);
        const order = validOrderInput(body, cfg);
        if (order.error) { reply(res, 400, { error: order.error }, corsOrigin); return; }
        const [price, filters] = await Promise.all([getPrice(cfg, order.symbol), getSymbolFilters(cfg, order.symbol)]);
        let params;
        if (order.side === 'BUY') {
          if (!filters.quoteOrderQtyMarketAllowed) { reply(res, 400, { error: 'This symbol does not allow market buys by quote amount.' }, corsOrigin); return; }
          if (order.amount * (1 + 0.002) > cfg.maxOrder) { reply(res, 400, { error: 'Order including a fee/slippage buffer exceeds the server cap.' }, corsOrigin); return; }
          if (filters.minNotional && order.amount < filters.minNotional) { reply(res, 400, { error: `Binance minimum notional is ${filters.minNotional} USDT.` }, corsOrigin); return; }
          params = { symbol: order.symbol, side: 'BUY', type: 'MARKET', quoteOrderQty: order.amount.toFixed(2), newOrderRespType: 'FULL' };
        } else {
          const filtersNow = filters;
          const sellQty = floorToStep(order.amount, filtersNow.stepSize);
          if (Number(sellQty) < filtersNow.minQty) { reply(res, 400, { error: 'Sell size is below Binance minimum quantity.' }, corsOrigin); return; }
          if (Number(sellQty) * price * (1 + 0.002) > cfg.maxOrder) { reply(res, 400, { error: 'Sell order including a fee/slippage buffer exceeds the server cap.' }, corsOrigin); return; }
          const account = await signedRequest(cfg, '/api/v3/account', { omitZeroBalances: 'true' });
          const asset = order.symbol.replace(/USDT$/, '');
          const available = Number(account.balances?.find(b => b.asset === asset)?.free || 0);
          if (!Number.isFinite(available) || Number(sellQty) > available) { reply(res, 400, { error: 'Sell quantity exceeds the available spot balance.' }, corsOrigin); return; }
          if (filtersNow.minNotional && Number(sellQty) * price < filtersNow.minNotional) { reply(res, 400, { error: `Binance minimum notional is ${filtersNow.minNotional} USDT.` }, corsOrigin); return; }
          params = { symbol: order.symbol, side: 'SELL', type: 'MARKET', quantity: sellQty, newOrderRespType: 'FULL' };
        }
        const result = await signedRequest(cfg, '/api/v3/order', params, 'POST');
        reply(res, 200, {
          order: {
            orderId: result.orderId, symbol: result.symbol, side: result.side, status: result.status,
            executedQty: result.executedQty, quoteQty: result.cummulativeQuoteQty,
            fills: Array.isArray(result.fills) ? result.fills.slice(0, 10).map(f => ({ price: f.price, qty: f.qty, commission: f.commission, commissionAsset: f.commissionAsset })) : [],
          }, mode: cfg.testnet ? 'TESTNET' : 'LIVE SPOT',
        }, corsOrigin); return;
      }
      reply(res, 404, { error: 'API endpoint not found.' }, corsOrigin);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 502;
      const message = error.exchangeMessage ? `${error.message} ${error.exchangeMessage}` : error.message;
      reply(res, status >= 400 && status < 600 ? status : 502, { error: message || 'Backend request failed.' }, corsOrigin);
    }
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const cfg = configFrom();
  const port = positiveNumber(process.env.PORT, 8787);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApiServer();
  server.listen(port, host, () => console.log(`CryptoLab private Binance proxy listening on ${host}:${port} (${cfg.testnet ? 'TESTNET' : 'LIVE SPOT'})`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
