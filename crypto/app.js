import { SYMBOLS, STARTING_CASH, FEE_RATE, analyze, backtest, createDemoCandles, portfolioEquity } from './engine.js';

const $ = id => document.getElementById(id);
const money = (n, decimals = 2) => Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';
const priceFmt = n => Number(n) >= 1000 ? money(n, 2) : Number(n) >= 1 ? money(n, 3) : money(n, 5);
const stateKey = 'cryptolab-paper-v1';
let lang = localStorage.getItem('cryptolab-lang') || 'en';
let selected = SYMBOLS[0];
let interval = '1h';
let candles = [];
let quote = {};
let quoteMeta = {};
let demoData = false;
let runnerTimer = null;
let deferredInstall = null;
let lastBotAction = 0;
let runnerStartEquity = STARTING_CASH;
let liveSession = { url: localStorage.getItem('cryptolab-backend-url') || '', token: '', status: null, balances: null };
let toastTimer;

function freshAccount() { return { cash: STARTING_CASH, positions: [], history: [], realized: 0, fees: 0, startingEquity: STARTING_CASH }; }
function loadAccount() {
  try {
    const raw = JSON.parse(localStorage.getItem(stateKey));
    if (raw && Number.isFinite(raw.cash) && Array.isArray(raw.positions) && Array.isArray(raw.history)) return { ...freshAccount(), ...raw };
  } catch { /* ignore corrupt or unavailable storage */ }
  return freshAccount();
}
let account = loadAccount();
const save = () => { try { localStorage.setItem(stateKey, JSON.stringify(account)); } catch { toast(t('storageError')); } };
const translations = {
  en: { headline:'A calmer way to learn crypto markets.', subhead:'Review public data, inspect transparent indicators and practice in a paper account. Optional Binance Spot orders require your own secured backend and manual confirmation.', safety:'⚠️ <b>High-risk asset.</b> Signals are educational, not financial advice or predictions. Paper trades are simulated. If live mode is enabled on your private backend, confirmed orders use real funds and can lose money.', markets:'◉ &nbsp;Markets', analysis:'⌁ &nbsp;Analysis', paper:'▣ &nbsp;Paper trade', journal:'≡ &nbsp;Journal', install:'Install app', wait:'WAIT', buyBias:'BUY BIAS', sellBias:'SELL BIAS', loading:'Loading…', noCandles:'Waiting for enough candles…', buy:'Buy (paper)', sell:'Sell position', runnerStart:'Start paper runner', runnerStop:'Stop', running:'Paper runner is running on this device only.', stopped:'Runner is stopped. Review risk limits before starting.', demo:'Sample data · public price service unavailable', live:'Public market data · refreshes periodically', chartFail:'Market data could not load. Showing sample candles for practice.', noPosition:'No open paper positions.', noHistory:'No completed paper trades yet.', noTrades:'No closed positions to test in this sample.', storageError:'Could not save this paper account on this device.', buySuccess:'Paper buy recorded. No real order was sent.', sellSuccess:'Paper position closed.', amountBad:'Enter a valid amount of at least 10 USDT.', amountCap:'Order is capped at 25% of current paper equity.', notEnough:'Not enough paper cash after simulated fee.', noPos:'No open position for this market.', resetConfirm:'Reset the paper balance, open positions and trade history?', started:'Paper runner started. It stops when the app closes.', stoppedToast:'Paper runner stopped.', stoppedLoss:'Runner stopped by its daily paper-loss limit.', buySignal:'Paper runner opened a position from the rule-based signal.', exitSignal:'Paper runner closed a position on its exit rule.', paused:'Not enough candles to generate a signal.' },
  si: { headline:'ක්‍රිප්ටෝ වෙළඳපොළ ඉගෙනගන්න සන්සුන් ක්‍රමයක්.', subhead:'පොදු වෙළඳපොළ දත්ත සහ පැහැදිලි සංඥා බලලා demo ගිණුමක පුහුණු වෙන්න. Binance Spot order යැවීමට ඔබේම ආරක්ෂිත backend එකක් සහ ඔබගේ අතින් තහවුරු කිරීම අවශ්‍යයි.', safety:'⚠️ <b>ඉහළ අවදානම් වත්කම්.</b> සංඥා අධ්‍යාපනික පමණි; මූල්‍ය උපදෙස් හෝ අනාවැකි නොවේ. Demo ගනුදෙනු අනුකරණය කරයි. ඔබේ private backend එකේ live mode සක්‍රිය කළොත්, තහවුරු කරන order සැබෑ මුදල් භාවිතා කර පාඩු ඇති කළ හැක.', markets:'◉ &nbsp;වෙළඳපොළ', analysis:'⌁ &nbsp;විශ්ලේෂණය', paper:'▣ &nbsp;පුහුණු ගනුදෙනු', journal:'≡ &nbsp;වාර්තාව', install:'යෙදුම ස්ථාපනය', wait:'බලා සිටින්න', buyBias:'මිලදී ගැනීමේ නැඹුරුව', sellBias:'විකිණීමේ නැඹුරුව', loading:'පූරණය වෙමින්…', noCandles:'ප්‍රමාණවත් candle දත්ත ලැබෙන තුරු රැඳී සිටින්න…', demo:'ආදර්ශ දත්ත · සජීවී මිල සේවාව නොමැත', live:'පොදු වෙළඳපොළ දත්ත · කාලානුරූපව යාවත්කාලීන වේ', chartFail:'වෙළඳපොළ දත්ත ලබාගත නොහැක. පුහුණුව සඳහා ආදර්ශ candle පෙන්වයි.', noPosition:'විවෘත demo තනතුරු නැත.', noHistory:'අවසන් කළ demo ගනුදෙනු තවම නැත.', noTrades:'මෙම දත්තවල පරීක්ෂා කිරීමට වසා දැමූ ගනුදෙනු නැත.', storageError:'මෙම උපාංගයේ demo ගිණුම සුරැකිය නොහැක.', buy:'මිලදී ගන්න (demo)', sell:'තනතුර විකුණන්න', runnerStart:'Paper runner අරඹන්න', runnerStop:'නවත්වන්න', running:'Paper runner මෙම උපාංගයේ පමණක් ක්‍රියාත්මකයි.', stopped:'Runner නවතා ඇත. අවදානම් සීමා පරීක්ෂා කරන්න.', amountBad:'අවම 10 USDT වන නිවැරදි මුදලක් ඇතුළත් කරන්න.', amountCap:'ගනුදෙනුව දැනට ඇති demo equity වලින් 25% කට සීමා වේ.', notEnough:'ගාස්තුව සමඟ ගෙවීමට ප්‍රමාණවත් demo මුදල් නැත.', noPos:'මෙම වෙළඳපොළේ විවෘත තනතුරක් නැත.', resetConfirm:'Demo ශේෂය, විවෘත තනතුරු සහ ඉතිහාසය මකා නැවත සකසන්නද?', started:'Paper runner ආරම්භ විය. යෙදුම වැසූ විට නවතී.', stoppedToast:'Paper runner නවතා ඇත.', stoppedLoss:'දෛනික demo පාඩු සීමාව නිසා runner නවතා ඇත.', buySignal:'Rule-based සංඥාව අනුව demo තනතුරක් විවෘත කළා.', exitSignal:'විකුණුම් නීතිය අනුව demo තනතුර වසා දැමුවා.', paused:'සංඥාවක් සැකසීමට ප්‍රමාණවත් candle දත්ත නැත.' }
};
const t = key => translations[lang][key] || translations.en[key] || key;

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
}
function applyLanguage() {
  document.documentElement.lang = lang === 'si' ? 'si' : 'en';
  $('headline').textContent = t('headline'); $('subhead').textContent = t('subhead'); $('safety').innerHTML = t('safety');
  $('tabMarket').innerHTML = t('markets'); $('tabAnalysis').innerHTML = t('analysis'); $('tabPaper').innerHTML = t('paper'); $('tabJournal').innerHTML = t('journal');
  $('langBtn').textContent = lang === 'en' ? 'සිංහල' : 'English'; $('installBtn').textContent = t('install'); $('buyPaper').textContent = t('buy'); $('sellPaper').textContent = t('sell');
  $('startBot').textContent = runnerTimer ? t('runnerStart') : t('runnerStart'); $('stopBot').textContent = t('runnerStop');
  $('connectionText').textContent = demoData ? t('demo') : quoteMeta.connected ? t('live') : 'Connecting to public prices…';
  renderSignal(); renderAccount();
}

function formatCount(n) { return n >= 1e9 ? `${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : money(n, 0); }
function quotePrice(symbol) { return Number(quote[symbol]) || (candles.at(-1)?.close) || 0; }
function positionFor(symbol) { return account.positions.find(p => p.symbol === symbol); }
function equity() { const prices = Object.fromEntries(SYMBOLS.map(s => [s.symbol, Number(quote[s.symbol]) || 0])); return portfolioEquity(account, prices); }

async function fetchJson(url) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
  try { const response = await fetch(url, { signal: controller.signal, cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
  finally { clearTimeout(timer); }
}
async function refreshQuotes() {
  const symbols = encodeURIComponent(JSON.stringify(SYMBOLS.map(s => s.symbol)));
  try {
    const rows = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`);
    const next = { ...quote }, stats = {};
    for (const row of rows) { const price = Number(row.lastPrice); if (Number.isFinite(price) && price > 0) { next[row.symbol] = price; stats[row.symbol] = { change: Number(row.priceChangePercent), high: Number(row.highPrice), volume: Number(row.quoteVolume) }; } }
    if (Object.keys(stats).length === SYMBOLS.length) { quote = next; quoteMeta = { connected: true, stats }; demoData = false; }
  } catch {
    if (!Object.keys(quote).length) {
      quote = Object.fromEntries(SYMBOLS.map(s => [s.symbol, createDemoCandles(s.symbol, 3).at(-1).close]));
      quoteMeta = { connected: false, stats: {} }; demoData = true;
    }
  }
  $('connection').classList.toggle('off', demoData || !quoteMeta.connected);
  $('connectionText').textContent = demoData ? t('demo') : quoteMeta.connected ? t('live') : 'Connecting to public prices…';
  renderMarkets(); renderSelectedPrice(); renderAccount(); renderRisk();
}
async function loadCandles() {
  const symbol = selected.symbol; const requestInterval = interval;
  try {
    const raw = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${requestInterval}&limit=180`);
    if (!Array.isArray(raw) || raw.length < 30) throw new Error('Not enough candles');
    const loaded = raw.map(row => ({ time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) }));
    if (selected.symbol === symbol && interval === requestInterval) { candles = loaded; demoData = false; }
  } catch {
    if (selected.symbol === symbol && interval === requestInterval) { candles = createDemoCandles(symbol, 180); demoData = true; toast(t('chartFail')); }
  }
  renderSelectedPrice(); renderSignal(); renderAnalysis(); renderMarkets(); renderOrderEstimate(); renderAccount(); renderRisk(); drawChart();
}

function renderMarkets() {
  const root = $('marketsList'); root.replaceChildren();
  for (const item of SYMBOLS) {
    const row = document.createElement('div'); row.className = 'market-row'; row.tabIndex = 0;
    const left = document.createElement('div'); const name = document.createElement('b'); name.textContent = item.label; const fullname = document.createElement('div'); fullname.className = 'ticker-name'; fullname.textContent = item.name; left.append(name, fullname);
    const p = quotePrice(item.symbol); const price = document.createElement('b'); price.textContent = p ? `$${priceFmt(p)}` : '—';
    const stats = quoteMeta.stats?.[item.symbol]; const change = document.createElement('div'); change.className = `small move ${Number(stats?.change) >= 0 ? 'positive' : 'negative'}`; change.textContent = stats ? `${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)}%` : '—';
    row.append(left, price, change); const select = () => selectSymbol(item); row.addEventListener('click', select); row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') select(); }); root.append(row);
  }
}
function renderSelectedPrice() {
  const last = quotePrice(selected.symbol); const change = quoteMeta.stats?.[selected.symbol];
  $('currentPrice').textContent = last ? `$${priceFmt(last)}` : '—'; $('change24').textContent = change ? `${change.change >= 0 ? '+' : ''}${change.change.toFixed(2)}%` : '—';
  $('change24').className = change ? (change.change >= 0 ? 'positive' : 'negative') : 'muted';
  $('priceMeta').textContent = `${selected.name} · ${interval} · ${demoData ? 'sample candles' : 'public spot candles'}`;
  $('orderSymbol').textContent = selected.label;
  const stat = quoteMeta.stats?.[selected.symbol]; $('highStat').textContent = stat?.high ? `$${priceFmt(stat.high)}` : '—'; $('volumeStat').textContent = stat?.volume ? `${formatCount(stat.volume)} USDT` : '—';
  if (candles.length) { const analysis = analyze(candles); $('rsiStat').textContent = analysis.rsi == null ? '—' : analysis.rsi.toFixed(1); $('emaStat').textContent = analysis.fast == null ? '—' : `${analysis.fast > analysis.slow ? '↑' : '↓'} ${priceFmt(analysis.fast)} / ${priceFmt(analysis.slow)}`; }
}
function selectSymbol(item) {
  selected = item; document.querySelectorAll('.pair').forEach(btn => btn.classList.toggle('active', btn.dataset.symbol === item.symbol));
  $('orderSymbol').textContent = item.label; loadCandles(); renderOrderEstimate();
}
function renderSignal() {
  const root = $('signalBox'); root.replaceChildren();
  if (!candles.length) { const div = document.createElement('div'); div.className = 'loading'; div.textContent = t('noCandles'); root.append(div); return; }
  const a = analyze(candles); const isBuy = a.side === 'BUY BIAS', isSell = a.side === 'SELL BIAS';
  const title = lang === 'si' ? (isBuy ? t('buyBias') : isSell ? t('sellBias') : t('wait')) : a.side;
  const row = document.createElement('div'); row.className = 'signal'; const icon = document.createElement('div'); icon.className = 'signal-icon'; icon.textContent = isBuy ? '↗' : isSell ? '↘' : '→'; const text = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = title; const detail = document.createElement('div'); detail.className = 'small muted'; detail.textContent = `${selected.label} · ${a.score > 0 ? '+' : ''}${a.score}/7 factor points · ${a.strength}% rule agreement`; text.append(strong, detail); row.append(icon, text);
  const meter = document.createElement('div'); meter.className = 'meter'; const fill = document.createElement('i'); fill.style.width = `${Math.max(6, Math.min(100, a.strength))}%`; meter.append(fill);
  const caption = document.createElement('div'); caption.className = 'small muted'; caption.textContent = 'Rule agreement (not probability)';
  const reasons = document.createElement('div'); reasons.className = 'signal-reasons';
  a.reasons.forEach(([name, reason]) => { const item = document.createElement('div'); item.className = 'reason'; const b = document.createElement('b'); b.textContent = name; const span = document.createElement('span'); span.textContent = reason; item.append(b, span); reasons.append(item); });
  root.append(row, meter, caption, reasons);
}
function renderAnalysis() {
  const root = $('analysisBody'); root.replaceChildren();
  if (!candles.length) { root.className = 'loading'; root.textContent = t('noCandles'); return; }
  root.className = ''; const a = analyze(candles); const rows = [
    ['Current read', `${a.side} · ${a.score > 0 ? '+' : ''}${a.score}/7 points · ${a.strength}% rule agreement (not probability)`],
    ['RSI (14)', a.rsi == null ? 'Insufficient data' : `${a.rsi.toFixed(1)} / 100`],
    ['EMA 9 / 21 / 50', a.fast == null ? '—' : `$${priceFmt(a.fast)} / $${priceFmt(a.slow)} / $${priceFmt(a.long)}`],
    ['ATR / price', Number.isFinite(a.atrPct) ? `${(a.atrPct * 100).toFixed(2)}% recent range` : '—'],
    ['Volume ratio', Number.isFinite(a.volumeRatio) ? `${a.volumeRatio.toFixed(2)}× prior average` : '—'],
    ['Momentum', Number.isFinite(a.momentum) ? `5 candles ${(a.momentum * 100).toFixed(2)}% · 20 candles ${(a.roc20 * 100).toFixed(2)}%` : '—'],
    ['Source', demoData ? 'Generated sample (not live)' : 'Public Binance spot candles']
  ];
  const table = document.createElement('table'); table.className = 'table';
  for (const [key, value] of rows) { const tr = document.createElement('tr'), td1 = document.createElement('td'), td2 = document.createElement('td'); td1.textContent = key; td2.textContent = value; tr.append(td1, td2); table.append(tr); }
  root.append(table);
}
function renderAccount() {
  const total = equity(); $('equity').textContent = `${money(total)} USDT`; $('cashValue').textContent = `${money(account.cash)} USDT`; $('positionCount').textContent = String(account.positions.length); $('realizedPnl').textContent = `${account.realized >= 0 ? '+' : ''}${money(account.realized)} USDT`; $('realizedPnl').className = account.realized >= 0 ? 'positive' : 'negative'; $('feesPaid').textContent = `${money(account.fees)} USDT`;
  const root = $('positionsList'); root.replaceChildren();
  if (!account.positions.length) { root.className = 'empty'; root.textContent = t('noPosition'); }
  else { root.className = 'trades'; for (const p of account.positions) { const current = Number(quote[p.symbol]) || p.entryPrice; const pl = current * p.quantity - p.cost; const card = document.createElement('div'); card.className = 'trade'; const left = document.createElement('div'); const b = document.createElement('b'); b.textContent = `${p.symbol.replace('USDT','/USDT')} · ${p.quantity.toFixed(6)}`; const small = document.createElement('small'); small.textContent = `Avg entry $${priceFmt(p.entryPrice)} · now $${priceFmt(current)}`; left.append(b, small); const pnl = document.createElement('b'); pnl.className = pl >= 0 ? 'positive' : 'negative'; pnl.textContent = `${pl >= 0 ? '+' : ''}${money(pl)} USDT`; card.append(left, pnl); root.append(card); } }
  renderHistory(); renderOrderEstimate();
}
function renderHistory() {
  const root = $('historyList'); root.replaceChildren();
  if (!account.history.length) { root.className = 'empty'; root.textContent = t('noHistory'); return; }
  root.className = 'trades';
  for (const h of [...account.history].reverse().slice(0, 50)) { const row = document.createElement('div'); row.className = 'trade'; const left = document.createElement('div'); const title = document.createElement('b'); title.textContent = `${h.symbol.replace('USDT','/USDT')} · Closed`; const sub = document.createElement('small'); sub.textContent = `${new Date(h.time).toLocaleString()} · entry $${priceFmt(h.entryPrice)} → exit $${priceFmt(h.exitPrice)} · fees $${money(h.fees)}`; left.append(title, sub); const pnl = document.createElement('b'); pnl.className = h.pnl >= 0 ? 'positive' : 'negative'; pnl.textContent = `${h.pnl >= 0 ? '+' : ''}${money(h.pnl)} USDT`; row.append(left, pnl); root.append(row); }
}
function renderOrderEstimate() {
  const raw = Number($('orderValue')?.value); const price = quotePrice(selected.symbol);
  const heldValue = (positionFor(selected.symbol)?.quantity || 0) * price;
  const max = Math.max(0, equity() * 0.25 - heldValue);
  const value = Number.isFinite(raw) ? Math.min(raw, max, account.cash / (1 + FEE_RATE)) : 0;
  $('orderEstimate').textContent = price && value > 0 ? `Approx. ${ (value / price).toFixed(8) } ${selected.symbol.replace('USDT','')} · simulated fee $${money(value * FEE_RATE)}` : 'Approximate quantity: —';
}
function renderRisk() {
  const nPos = account.positions.length, eq = equity(); $('riskSummary').textContent = `${nPos} open paper position${nPos === 1 ? '' : 's'} · Equity $${money(eq)} USDT. Risk is capped in the simulator; this does not protect real funds.`;
  const riskPct = Math.min(2, Math.max(0, Number($('riskPct')?.value) || 0)); const stopPct = Math.max(0.1, Number($('stopPct')?.value) || 0); const riskAmount = eq * riskPct / 100; const suggested = stopPct ? Math.min(riskAmount / (stopPct / 100), eq * 0.25) : 0;
  $('positionSize').textContent = `At ${riskPct}% account risk and ${stopPct}% stop distance: estimated size $${money(suggested)} USDT (max 25% of equity).`;
}
function renderOrderButtons() { const hasPosition = Boolean(positionFor(selected.symbol)); $('sellPaper').disabled = !hasPosition; }
function renderChart() {
  const canvas = $('priceChart'), rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1); canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h); ctx.strokeStyle = '#23314c'; ctx.lineWidth = 1;
  const values = candles.map(c => c.close).filter(Number.isFinite); if (values.length < 2) { ctx.fillStyle = '#94a4bf'; ctx.fillText(t('noCandles'), 10, 22); return; }
  const min = Math.min(...values), max = Math.max(...values), range = max - min || max * 0.005 || 1, pad = { left: 5, right: 62, top: 12, bottom: 21 };
  for (let i = 0; i < 4; i++) { const y = pad.top + i * (h - pad.top - pad.bottom) / 3; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); ctx.fillStyle = '#73849f'; ctx.font = '10px system-ui'; ctx.fillText(priceFmt(max - range * i / 3), w - 57, y - 3); }
  const xAt = i => pad.left + i * (w - pad.left - pad.right) / (values.length - 1), yAt = v => pad.top + (max - v) / range * (h - pad.top - pad.bottom);
  ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v))); ctx.lineTo(xAt(values.length - 1), h - pad.bottom); ctx.lineTo(xAt(0), h - pad.bottom); ctx.closePath(); const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom); grad.addColorStop(0, '#73a7ff44'); grad.addColorStop(1, '#73a7ff00'); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v))); ctx.strokeStyle = '#73a7ff'; ctx.lineWidth = 2; ctx.stroke();
  const last = values.at(-1); ctx.fillStyle = '#f4c542'; ctx.beginPath(); ctx.arc(xAt(values.length - 1), yAt(last), 3.2, 0, Math.PI * 2); ctx.fill();
}
function renderMarketsAndSelected() { renderMarkets(); renderSelectedPrice(); renderOrderEstimate(); renderAccount(); }

function openPaperBuy(symbol = selected.symbol, rawValue = Number($('orderValue').value)) {
  const price = Number(quote[symbol]) || (symbol === selected.symbol ? candles.at(-1)?.close : 0);
  if (!Number.isFinite(rawValue) || rawValue < 10) { toast(t('amountBad')); return false; }
  if (!price || price <= 0) { toast(t('chartFail')); return false; }
  const heldValue = (positionFor(symbol)?.quantity || 0) * price;
  const cap = Math.max(0, equity() * 0.25 - heldValue);
  const value = Math.min(rawValue, cap, account.cash / (1 + FEE_RATE));
  if (value < 10) { toast(t('notEnough')); return false; }
  if (rawValue > cap) toast(t('amountCap'));
  const fee = value * FEE_RATE, qty = value / price;
  account.cash -= value + fee; account.fees += fee;
  let p = positionFor(symbol);
  if (!p) { p = { symbol, quantity: 0, entryPrice: 0, cost: 0, entryFees: 0, openedAt: Date.now() }; account.positions.push(p); }
  p.quantity += qty; p.cost += value + fee; p.entryFees = (p.entryFees || 0) + fee; p.entryPrice = (p.cost / p.quantity);
  save(); renderAccount(); renderRisk(); renderOrderButtons(); toast(t('buySuccess')); return true;
}
function closePosition(symbol, price, silent = false) {
  const index = account.positions.findIndex(p => p.symbol === symbol); if (index < 0 || !price) return false;
  const p = account.positions[index], gross = p.quantity * price, fee = gross * FEE_RATE, net = gross - fee, pnl = net - p.cost;
  account.cash += net; account.fees += fee; account.realized += pnl;
  account.history.push({ symbol, quantity: p.quantity, entryPrice: p.entryPrice, exitPrice: price, pnl, fees: (p.entryFees || 0) + fee, time: Date.now() });
  account.positions.splice(index, 1); save(); renderAccount(); renderRisk(); renderOrderButtons(); if (!silent) toast(t('sellSuccess')); return true;
}

function updateRiskSizing() { renderRisk(); }
function switchView(view) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'paper') { renderAccount(); renderRisk(); }
  if (view === 'analysis') { renderAnalysis(); }
  if (view === 'market') requestAnimationFrame(drawChart);
}
function runBacktest() {
  const result = backtest(candles);
  const box = $('backtestResult'); box.classList.remove('hide'); box.textContent = result.trades ? `Walk-forward closed trades: ${result.trades} · Win rate: ${(result.winRate * 100).toFixed(1)}% · Net P&L after fees and 0.05%/side simulated slippage: ${result.pnl >= 0 ? '+' : ''}$${money(result.pnl)} · Fees $${money(result.fees)} · Slippage cost $${money(result.slippage)} · Max drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%. Small historical sample only; not evidence of future performance.` : t('noTrades');
}
function startRunner() {
  if (runnerTimer) return; lastBotAction = 0; runnerStartEquity = equity();
  $('botStatus').textContent = t('running'); $('startBot').disabled = true; $('stopBot').disabled = false; toast(t('started'));
  runnerTimer = setInterval(async () => {
    if (Date.now() - lastBotAction < 25_000) return;
    if ((runnerStartEquity - equity()) >= runnerStartEquity * 0.03) { stopRunner(); $('botStatus').textContent = t('stoppedLoss'); toast(t('stoppedLoss')); return; }
    const existing = positionFor(selected.symbol), price = quotePrice(selected.symbol);
    if (!price || candles.length < 30) { $('botStatus').textContent = t('paused'); return; }
    const signal = analyze(candles);
    if (!existing && signal.side === 'BUY BIAS') {
      const amount = Math.min(Number($('botSize').value) || 0, equity() * 0.25);
      if (amount >= 10 && openPaperBuy(selected.symbol, amount)) { lastBotAction = Date.now(); $('botStatus').textContent = t('buySignal'); }
    } else if (existing) {
      const stop = Number($('botStop').value) || 2;
      if (price <= existing.entryPrice * (1 - stop / 100) || signal.side === 'SELL BIAS') {
        if (closePosition(selected.symbol, price, true)) { lastBotAction = Date.now(); $('botStatus').textContent = t('exitSignal'); toast(t('sellSuccess')); }
      }
    }
  }, 20_000);
}
function stopRunner() { if (runnerTimer) clearInterval(runnerTimer); runnerTimer = null; $('startBot').disabled = false; $('stopBot').disabled = true; $('botStatus').textContent = t('stopped'); }

function updateLiveLabels() {
  const symbol = $('liveSymbol').value;
  const asset = symbol.replace(/USDT$/, '');
  const isBuy = $('liveSide').value === 'BUY';
  $('liveAmountLabel').textContent = isBuy ? 'USDT to spend' : `${asset} amount to sell`;
  $('liveAmount').min = isBuy ? String(liveSession.status?.minOrderUsdt || 10) : '0.000001';
  $('liveAmount').max = isBuy && liveSession.status?.maxOrderUsdt ? String(liveSession.status.maxOrderUsdt) : '';
  $('liveAmount').step = isBuy ? '0.01' : '0.000001';
  $('liveOrderNote').textContent = liveSession.status
    ? `${liveSession.status.mode} · server cap ${money(liveSession.status.maxOrderUsdt)} USDT per order · Binance market prices can move during execution.`
    : 'Server-side order cap and Binance symbol rules are checked before sending.';
  $('placeLiveOrder').disabled = !(liveSession.token && liveSession.status?.ordersEnabled && $('liveAck').checked);
}
function renderLiveStatus(message = '') {
  const root = $('backendStatus');
  if (message) root.textContent = message;
  else if (!liveSession.token || !liveSession.status) root.textContent = 'Not connected. Testnet is the backend default; live trading must be explicitly enabled on your private server.';
  else {
    const s = liveSession.status;
    root.textContent = `${s.mode} backend · ${s.credentialsConfigured ? 'Binance credentials configured' : 'Binance credentials missing'} · ${s.ordersEnabled ? 'manual orders enabled' : 'orders disabled'} · max ${money(s.maxOrderUsdt)} USDT/order. ${s.note}`;
  }
  $('backendDisconnect').disabled = !liveSession.token;
  updateLiveLabels();
}
function backendBaseUrl(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error('Enter a valid private backend URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS for remote backends. HTTP is allowed only for localhost development.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Backend URL cannot contain credentials, a query string, or a fragment.');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
async function backendFetch(path, { url = liveSession.url, token = liveSession.token, method = 'GET', body } = {}) {
  const response = await fetch(`${url}${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Backend request failed (${response.status}).`);
  return data;
}
async function connectBackend() {
  const button = $('backendConnect'); button.disabled = true;
  try {
    const url = backendBaseUrl($('backendUrl').value);
    const token = $('backendToken').value.trim();
    if (token.length < 32) throw new Error('Backend access token must be at least 32 characters. Generate a random token on your server.');
    const health = await fetch(`${url}/health`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!health.ok) throw new Error(`Backend health check failed (${health.status}).`);
    const status = await backendFetch('/api/status', { url, token });
    liveSession = { url, token, status, balances: null };
    try { localStorage.setItem('cryptolab-backend-url', url); } catch { /* endpoint is optional convenience only */ }
    $('backendUrl').value = url; $('backendToken').value = '';
    renderLiveStatus();
    if (status.ordersEnabled) await refreshLiveAccount();
    toast(`Connected to ${status.mode}. Binance keys remain server-side.`);
  } catch (error) {
    liveSession.token = ''; liveSession.status = null; liveSession.balances = null;
    renderLiveStatus(error.message || 'Could not connect to backend.');
  } finally { button.disabled = false; }
}
async function refreshLiveAccount() {
  if (!liveSession.token || !liveSession.status?.credentialsConfigured) return;
  try {
    const data = await backendFetch('/api/account'); liveSession.balances = data.balances; renderLiveBalances();
  } catch (error) { $('liveBalances').textContent = `Account unavailable: ${error.message}`; }
}
function renderLiveBalances() {
  const rows = liveSession.balances || [];
  $('liveBalances').textContent = rows.length
    ? `Available · ${rows.map(row => `${row.asset}: ${Number(row.free).toFixed(6)} free${Number(row.locked) ? `, ${Number(row.locked).toFixed(6)} locked` : ''}`).join(' · ')}`
    : 'No non-zero BTC, ETH, SOL, BNB or USDT balances returned.';
}
function disconnectBackend() {
  liveSession = { url: $('backendUrl').value.trim(), token: '', status: null, balances: null };
  $('backendToken').value = ''; $('liveAck').checked = false; renderLiveStatus('Disconnected. The backend URL may be remembered; access token is not stored.');
  $('liveBalances').textContent = 'Account balances are only shown after a successful authenticated connection.';
}
async function placeLiveOrder() {
  if (!liveSession.status?.ordersEnabled || !liveSession.token) { toast('Connect an enabled Binance backend first.'); return; }
  if (!$('liveAck').checked) { toast('Acknowledge the spot-order risk before continuing.'); return; }
  const symbol = $('liveSymbol').value, side = $('liveSide').value, amount = Number($('liveAmount').value);
  if (!Number.isFinite(amount) || amount <= 0) { toast('Enter a valid positive order amount.'); return; }
  const priceData = await backendFetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`).catch(error => { toast(error.message); return null; });
  if (!priceData) return;
  const isLive = priceData.mode === 'LIVE SPOT';
  const amountText = side === 'BUY' ? `${money(amount)} USDT` : `${amount} ${symbol.replace(/USDT$/, '')}`;
  const est = side === 'BUY' ? `about ${(amount / priceData.price).toFixed(8)} ${symbol.replace(/USDT$/, '')}` : `about ${money(amount * priceData.price)} USDT notional`;
  const modeText = isLive ? 'REAL BINANCE SPOT' : 'BINANCE SPOT TESTNET';
  const confirmed = confirm(`${modeText}\n\n${side} ${symbol}\nAmount: ${amountText}\nReference price: ${priceFmt(priceData.price)} USDT\nEstimated: ${est}\n\nMarket fills can differ from this quote. This sends an order now. Continue?`);
  if (!confirmed) return;
  if (isLive && !confirm(`FINAL LIVE-ORDER CHECK\n\nThis uses real funds on Binance Spot. There is no guaranteed price or profit. Place this ${side} market order?`)) return;
  $('placeLiveOrder').disabled = true;
  try {
    const result = await backendFetch('/api/order', { method: 'POST', body: { symbol, side, amount, confirm: true } });
    const order = result.order;
    $('liveOrderNote').textContent = `${result.mode} · ${order.status} · order ${order.orderId} · filled ${order.executedQty} ${symbol.replace(/USDT$/, '')} · quote ${money(order.quoteQty)} USDT.`;
    toast(`${result.mode} ${order.status}: ${side} ${symbol}`);
    await refreshLiveAccount();
  } catch (error) { $('liveOrderNote').textContent = error.message; toast(error.message); }
  finally { updateLiveLabels(); }
}

// Pair selector buttons use a fixed, trusted symbol list.
for (const item of SYMBOLS) { const button = document.createElement('button'); button.className = `pair ${item.symbol === selected.symbol ? 'active' : ''}`; button.dataset.symbol = item.symbol; button.textContent = item.label; button.addEventListener('click', () => selectSymbol(item)); $('pairButtons').append(button); }
document.querySelectorAll('.nav button').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.goto)));
$('interval').addEventListener('change', event => { interval = event.target.value; loadCandles(); });
$('refreshBtn').addEventListener('click', async () => { await refreshQuotes(); await loadCandles(); });
$('orderValue').addEventListener('input', renderOrderEstimate);
$('buyPaper').addEventListener('click', () => openPaperBuy());
$('sellPaper').addEventListener('click', () => { if (!closePosition(selected.symbol, quotePrice(selected.symbol))) toast(t('noPos')); });
$('riskPct').addEventListener('input', updateRiskSizing); $('stopPct').addEventListener('input', updateRiskSizing);
$('backtestBtn').addEventListener('click', runBacktest);
$('startBot').addEventListener('click', startRunner); $('stopBot').addEventListener('click', () => { stopRunner(); toast(t('stoppedToast')); });
$('backendUrl').value = liveSession.url;
$('backendConnect').addEventListener('click', connectBackend);
$('backendDisconnect').addEventListener('click', disconnectBackend);
$('placeLiveOrder').addEventListener('click', placeLiveOrder);
$('liveAck').addEventListener('change', updateLiveLabels);
$('liveSymbol').addEventListener('change', updateLiveLabels);
$('liveSide').addEventListener('change', updateLiveLabels);
$('resetPaper').addEventListener('click', () => { if (confirm(t('resetConfirm'))) { stopRunner(); account = freshAccount(); save(); renderAccount(); renderRisk(); toast('Paper account reset to 10,000 USDT.'); } });
$('langBtn').addEventListener('click', () => { lang = lang === 'en' ? 'si' : 'en'; localStorage.setItem('cryptolab-lang', lang); applyLanguage(); });
window.addEventListener('resize', () => requestAnimationFrame(drawChart));
window.addEventListener('pagehide', () => { stopRunner(); liveSession.token = ''; $('backendToken').value = ''; });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; $('installBtn').style.display = 'inline-block'; });
$('installBtn').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('installBtn').style.display = 'none'; });
const drawChart = renderChart;

applyLanguage(); renderOrderButtons(); renderAccount(); renderRisk(); renderLiveStatus();
refreshQuotes().then(loadCandles);
setInterval(refreshQuotes, 60_000);
setInterval(() => { if (document.visibilityState === 'visible') loadCandles(); }, 60_000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
