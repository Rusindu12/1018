/* =====================================================================
   CryptoAI PRO — smoke.test.mjs
   Boots the real single-file build inside jsdom with a stubbed exchange
   and a stubbed 2D canvas, then drives the UI the way a user would:
   tabs, chart, signals, a paper trade, the bot, alerts, settings and the
   Sinhala switch. Any uncaught error fails the suite.

   run:  cd mobile && npm test
   ===================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(root, 'www', 'index.html'), 'utf8');

/* ------------------------- fake market data -------------------------- */
function klines(n = 300, start = 60000) {
  const out = [];
  let p = start;
  const t0 = Date.now() - n * 300000;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o * (1 + Math.sin(i / 9) * 0.006 + (Math.random() - 0.5) * 0.004);
    out.push([t0 + i * 300000, String(o), String(Math.max(o, c) * 1.002), String(Math.min(o, c) * 0.998), String(c), String(50 + Math.random() * 90), 0, '0', 0, '0', '0', '0']);
    p = c;
  }
  return out;
}
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];
function tickers() {
  return SYMBOLS.map((s, i) => ({
    symbol: s, lastPrice: String(60000 / (i + 1)), priceChangePercent: String((i % 2 ? -1 : 1) * (0.5 + i * 0.3)),
    volume: '120000', quoteVolume: String(9e8 - i * 5e7), highPrice: '61000', lowPrice: '59000'
  }));
}

/* ------------------------- fake 2D canvas ---------------------------- */
function fakeCtx() {
  const noop = () => { };
  const ctx = {
    canvas: null,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1, lineCap: '', lineJoin: '',
    setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, stroke: noop, fill: noop, arc: noop, rect: noop, save: noop, restore: noop,
    setLineDash: noop, scale: noop, translate: noop, rotate: noop, clip: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fillText: noop, strokeText: noop, drawImage: noop, createLinearGradient: () => ({ addColorStop: noop }),
    measureText: (s) => ({ width: String(s).length * 6 })
  };
  return ctx;
}

/* ------------------------------ boot --------------------------------- */
const problems = [];
function boot() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => problems.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => problems.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://cryptoai.local/',
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = (url) => {
        const u = String(url);
        if (u.includes('/api/v3/ticker/24hr')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tickers()) });
        if (u.includes('/api/v3/klines')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(klines()) });
        if (u.includes('/api/v3/ticker/price')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ price: '60123.45' }) });
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      };
      w.HTMLCanvasElement.prototype.getContext = function () { const c = fakeCtx(); c.canvas = this; return c; };
      Object.defineProperty(w.navigator, 'vibrate', { value: () => true, configurable: true });
      w.Notification = function () { };
      w.Notification.permission = 'granted';
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() { }, removeListener() { } }));
    }
  });
  return dom;
}

async function waitFor(fn, ms = 4000, label = 'condition') {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch (e) { v = false; }
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + label);
    await new Promise((r) => setTimeout(r, 25));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = boot();
const w = dom.window;
const d = w.document;
const $ = (id) => d.getElementById(id);
const click = (id) => { const e = $(id); assert.ok(e, 'missing #' + id); e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const setVal = (id, v) => { const e = $(id); assert.ok(e, 'missing #' + id); e.value = String(v); e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); };

test('the app boots, connects to the stubbed exchange and paints every tab', async (t) => {
  await waitFor(() => w.App && w.App.R && w.App.R.booted, 3000, 'boot');
  const App = w.App;
  assert.equal(App.version, '5.0.0');
  assert.ok(w.TA && w.Patterns && w.Brain && w.I18N && w.SysMgmt, 'a module did not attach itself');

  await waitFor(() => App.R.conn === 'live' && App.R.tickers.length > 0, 5000, 'live market data');
  assert.equal(App.R.conn, 'live', 'should be live with the stubbed exchange');
  assert.ok($('mList').querySelectorAll('.mrow').length >= 5, 'market list is empty');
  assert.ok($('tickTrack').textContent.includes('BTC'), 'ticker strip is empty');
  assert.equal($('connTxt').textContent, 'Binance');
  assert.equal($('symName').textContent, 'BTC/USDT');

  /* chart + signals must be populated from the fetched candles */
  await waitFor(() => App.R.sig && App.R.sig.ok, 4000, 'a signal');
  assert.ok(Math.abs(App.R.sig.score) <= 100);
  assert.ok($('sigVerdict').textContent.length > 3, 'verdict box is empty');
  assert.ok($('sigReasons').querySelectorAll('.reason').length > 0, 'no reasons rendered');
  assert.equal($('sigMetrics').querySelectorAll('.metric').length, 15);
  assert.equal($('sigLevels').querySelectorAll('.lvl').length, 6);
  assert.ok($('chartStats').textContent.includes('ATR'));
  assert.ok($('aiOut').textContent.length > 100, 'the offline explanation did not render');

  /* every tab switches */
  for (const tab of ['markets', 'chart', 'signals', 'trade', 'bot', 'sys']) {
    d.querySelector(`#nav button[data-tab="${tab}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert.ok($('t-' + tab).classList.contains('on'), tab + ' did not activate');
    await sleep(30);
  }

  /* the System tab mounts the supervisor */
  await waitFor(() => $('smProcs') && $('smProcs').querySelectorAll('.sm-prow').length === 8, 2500, 'system processes');
  assert.equal($('smStats').querySelectorAll('.sm-stat').length, 8);
  assert.ok($('smDevice').textContent.includes('CryptoAI') || $('smDevice').textContent.length > 100);
  assert.ok($('smChip').textContent.length > 1);

  /* bot tab is fully populated */
  click('nav') ; // no-op guard, keeps lint quiet
  d.querySelector('#nav button[data-tab="bot"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal($('bStrat').options.length, w.Brain.STRATEGIES.length);
  assert.ok($('bStratDesc').textContent.length > 40);
  assert.ok($('bSymbols').querySelectorAll('.chip').length >= 4);
  assert.equal($('brainWeights').querySelectorAll('.sm-kv').length, 12);
  assert.ok($('botLog').textContent.length > 0, 'the boot log line is missing');

  assert.deepEqual(problems, [], 'uncaught errors while booting:\n' + problems.join('\n'));
});

test('a paper trade opens, is marked to market, and closes into history', async () => {
  const App = w.App;
  d.querySelector('#nav button[data-tab="trade"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const cashBefore = App.S.paper.cash;
  assert.equal(cashBefore, 10000);
  assert.ok($('balBody').textContent.includes('10,000'), 'balance card did not render');

  setVal('ordAmt', 250);
  setVal('ordTp', 2);
  setVal('ordSl', 1);
  click('buyBtn');
  await sleep(60);

  assert.equal(App.S.paper.positions.length, 1);
  const pos = App.S.paper.positions[0];
  assert.equal(pos.side, 'long');
  assert.equal(pos.tp, 2);
  assert.ok(App.S.paper.cash < cashBefore - 250, 'cash was not debited');
  assert.equal($('posList').querySelectorAll('.pos').length, 1);
  assert.equal($('navBadge').textContent, '1');
  assert.equal($('navBadge').style.display, '', 'the nav badge should be visible');

  /* a limit order reserves cash and shows up in the order list */
  d.querySelector('#typeSeg button[data-t="limit"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  setVal('ordPrice', pos.entry * 0.9);
  setVal('ordAmt', 100);
  click('buyBtn');
  await sleep(40);
  assert.equal(App.S.paper.orders.length, 1);
  assert.ok($('ordList').textContent.includes('Cancel') || $('ordList').textContent.length > 20);

  /* close the position through the UI's confirm sheet */
  d.querySelector('[data-close-pos]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  assert.ok($('okModal').classList.contains('on'), 'the confirm sheet did not open');
  click('okYes');
  await sleep(60);

  assert.equal(App.S.paper.positions.length, 0);
  assert.equal(App.S.paper.history.length, 1);
  assert.equal(App.S.paper.history[0].reason, 'manual');
  assert.ok(Number.isFinite(App.S.paper.history[0].pnl));
  assert.ok($('histList').textContent.length > 10);
  assert.equal($('statsBody').querySelectorAll('.metric').length, 8);

  /* cancel the resting limit order and get the cash back */
  const cashBeforeCancel = App.S.paper.cash;
  d.querySelector('[data-cancel]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(40);
  assert.equal(App.S.paper.orders.length, 0);
  assert.ok(App.S.paper.cash > cashBeforeCancel, 'cancelling did not release the reserved cash');

  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the position-size calculator and the backtest produce numbers', async () => {
  d.querySelector('#nav button[data-tab="trade"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  setVal('calcAcct', 1000);
  setVal('calcRisk', 1);
  const px = w.App.priceOf('BTC/USDT');
  setVal('calcStop', px * 0.98);
  await sleep(220);
  const size = $('calcSize').textContent;
  assert.ok(size.includes('BTC'), 'calculator size is empty: ' + size);
  assert.ok($('calcNotional').textContent.includes('USDT'));
  assert.ok(parseFloat($('calcRiskAmt').textContent.replace(/[^0-9.]/g, '')) === 10);

  d.querySelector('#nav button[data-tab="signals"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click('btBtn');
  await waitFor(() => $('btOut').textContent.length > 60, 3000, 'backtest output');
  assert.ok(/Trades|වෙළඳාම්/.test($('btOut').textContent), 'backtest summary missing: ' + $('btOut').textContent.slice(0, 80));
  assert.ok(w.App.R.lastBt && w.App.R.lastBt.ok);
  assert.equal(w.App.R.lastBt.equity.length, w.App.R.lastBt.trades + 1);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the bot starts, scans its symbols, and stops cleanly', async () => {
  const App = w.App;
  d.querySelector('#nav button[data-tab="bot"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  setVal('bSize', 50);
  setVal('bEntry', 5);            // low threshold so the stubbed market produces an entry
  setVal('bMaxPos', 3);
  click('botStart');
  await sleep(80);
  assert.equal(App.S.bot.running, true);
  assert.ok($('botDot').classList.contains('run'), 'the bot dot is not lit');
  assert.ok(/Running|ධාවනය/.test($('botState').textContent));

  await waitFor(() => App.S.bot.stats.scans >= 1, 8000, 'one bot pass');
  assert.ok(App.S.bot.stats.scans >= 1);
  assert.ok($('botLog').textContent.length > 40, 'the bot log is empty');
  assert.ok($('botStats').querySelectorAll('.metric').length === 4);

  /* pause / resume a process from the System tab supervisor */
  d.querySelector('#nav button[data-tab="sys"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(80);
  const pauseBtn = d.querySelector('[data-act="toggle"][data-proc="feed"]');
  assert.ok(pauseBtn, 'no pause button for the market feed');
  pauseBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  assert.equal(w.SysMgmt.PROCS.find((p) => p.id === 'feed').state, 'pause');
  pauseBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(40);

  click('botStop');
  await sleep(60);
  assert.equal(App.S.bot.running, false);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('alerts, favourites, symbol picking and the signal scan all work', async () => {
  const App = w.App;
  d.querySelector('#nav button[data-tab="chart"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click('alertBtn');
  await sleep(40);
  assert.ok($('alertModal').classList.contains('on'));
  setVal('alertPrice', 1e9);         // far above the market → "falls below" fires at once
  setVal('alertWhen', 'below');
  click('alertAdd');
  await sleep(60);
  assert.equal(App.S.alerts.length, 1);
  App.checkAlerts(App.priceOf(App.S.symbol));
  await sleep(60);
  assert.equal(App.S.alerts.length, 0, 'the alert did not fire');
  assert.ok($('toasts').children.length > 0, 'no toast was shown');

  /* favourite a market and filter the list by it */
  const star = d.querySelector('#mList [data-fav]');
  assert.ok(star, 'no star button in the market list');
  const sym = star.getAttribute('data-fav');
  const had = App.S.favs.includes(sym);
  star.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(50);
  assert.equal(App.S.favs.includes(sym), !had);

  /* symbol sheet */
  click('symBtn');
  await sleep(50);
  assert.ok($('symModal').classList.contains('on'));
  assert.ok($('symList').querySelectorAll('[data-pick]').length >= 5);
  setVal('symSearch', 'ETH');
  await sleep(220);
  assert.ok($('symList').querySelectorAll('[data-pick]').length >= 1);
  d.querySelector('#symList [data-pick]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  assert.equal(App.S.symbol, 'ETH/USDT');
  assert.equal($('symName').textContent, 'ETH/USDT');
  assert.ok($('symModal').classList.contains('on') === false, 'the sheet should close after picking');

  /* scan */
  d.querySelector('#nav button[data-tab="markets"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click('scanBtn');
  await waitFor(() => $('scanList').querySelectorAll('[data-scansym]').length >= 3, 9000, 'scan results');
  assert.ok($('scanSummary').textContent.length > 4);
  click('scanStop');
  await sleep(40);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('settings, language switching and persistence behave', async () => {
  const App = w.App;
  click('setBtn');
  await sleep(50);
  assert.ok($('setModal').classList.contains('on'));
  assert.equal($('setEx').options.length, Object.keys(App.EX).length);
  assert.ok($('setVersion').textContent.includes('5.0.0'));
  assert.ok($('setEngine').textContent.includes('TA'));
  assert.ok($('setRuntime').textContent.length > 3);

  /* Sinhala */
  click('langBtn');
  await sleep(80);
  assert.equal(App.S.lang, 'si');
  assert.equal(d.querySelector('[data-i18n="nav.markets"]').textContent, 'වෙළඳපොළ');
  assert.equal($('langBtn').textContent, 'සිං');
  assert.ok($('sigVerdict').textContent.length > 2);
  click('langBtn');
  await sleep(80);
  assert.equal(App.S.lang, 'en');
  assert.equal(d.querySelector('[data-i18n="nav.markets"]').textContent, 'Markets');

  /* switches + AI provider reveal */
  const sound = $('setSound');
  sound.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.ok(sound.classList.contains('on'));
  setVal('setAiProvider', 'openrouter');
  await sleep(40);
  assert.equal(App.S.ai.provider, 'openrouter');
  assert.notEqual($('aiKeyWrap').style.display, 'none');
  assert.equal($('aiBaseWrap').style.display, 'none');
  setVal('setAiProvider', 'custom');
  await sleep(40);
  assert.notEqual($('aiBaseWrap').style.display, 'none');
  setVal('setAiProvider', 'off');

  /* exchange switch wipes the cache and refetches */
  setVal('setEx', 'bybit');
  await sleep(200);
  assert.equal(App.S.exchange, 'bybit');
  assert.ok(!Object.keys(App.R.candles).some((k) => k.startsWith('binance:')), 'the old exchange cache survived the switch');
  /* the stub only serves Binance, so Bybit must degrade to demo data instead of dying */
  assert.equal(App.R.conn, 'demo', 'an unreachable exchange should fall back to demo data');
  assert.ok(App.R.tickers.length > 0 && App.R.tickers.every((t) => t.demo), 'demo tickers should backfill the list');
  setVal('setEx', 'binance');
  await sleep(300);
  await waitFor(() => App.R.tickers.length > 0, 4000, 'binance tickers again');

  /* persistence */
  const raw = w.localStorage.getItem(App.STORE_KEY);
  assert.ok(raw, 'nothing was persisted');
  const saved = JSON.parse(raw);
  assert.equal(saved.lang, 'en');
  assert.equal(saved.exchange, 'binance');
  assert.ok(Object.keys(saved.weights).length === 12);
  assert.ok(Array.isArray(saved.paper.equity));

  /* reset the paper account through the confirm sheet */
  click('setResetPaper');
  await sleep(40);
  assert.ok($('okModal').classList.contains('on'));
  click('okYes');
  await sleep(120);
  assert.equal(App.S.paper.cash, 10000);
  assert.equal(App.S.paper.history.length, 0);
  click('setBtn');   // close the sheet again
  await sleep(30);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the brain trains on history and the weights feed the signal', async () => {
  const App = w.App;
  d.querySelector('#nav button[data-tab="chart"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d.querySelector('#tfChips .chip[data-tf="1h"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(600);
  const before = JSON.stringify(App.S.weights);
  d.querySelector('#nav button[data-tab="bot"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click('brainTrain');
  await waitFor(() => $('brainStats').textContent.length > 10 && /trained|පුහුණු|Kept|රඳවා|accuracy|නිවැරදි/i.test($('botLog').textContent + $('brainNote').textContent), 6000, 'a training result');
  assert.equal(Object.keys(App.S.weights).length, 12);
  assert.ok(typeof App.S.weights.trend === 'number');
  assert.ok(JSON.stringify(App.S.weights) !== before || /Kept|රඳවා|rejected|ප්‍රතික්ෂේප/.test($('botLog').textContent), 'training reported nothing');
  click('brainReset');
  await sleep(40);
  click('okYes');
  await sleep(80);
  assert.deepEqual(App.S.weights, w.Brain.DEFAULT_WEIGHTS);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('teardown: the window closes without leaving timers behind', async () => {
  w.close();
  await sleep(50);
  assert.deepEqual(problems, [], 'errors during the whole run:\n' + problems.join('\n'));
});
