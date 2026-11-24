export const SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', name: 'Ethereum' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', name: 'Solana' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', name: 'BNB' },
];
export const STARTING_CASH = 10_000;
export const FEE_RATE = 0.001;

export function ema(values, period) {
  if (!values.length) return [];
  const alpha = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * alpha + out[i - 1] * (1 - alpha));
  return out;
}

export function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    gains += Math.max(0, d); losses += Math.max(0, -d);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function analyze(candles) {
  const closes = candles.map(c => Number(c.close)).filter(Number.isFinite);
  if (closes.length < 30) return { side: 'WAIT', score: 0, rsi: null, fast: null, slow: null, reasons: ['Need at least 30 valid candles.'] };
  const fastSeries = ema(closes, 9), slowSeries = ema(closes, 21);
  const fast = fastSeries.at(-1), slow = slowSeries.at(-1), momentum = closes.at(-1) / closes.at(-6) - 1;
  const currentRsi = rsi(closes, 14);
  let score = 0;
  const reasons = [];
  if (fast > slow) { score++; reasons.push(['Trend', 'EMA 9 is above EMA 21 (positive trend bias).']); }
  else { score--; reasons.push(['Trend', 'EMA 9 is below EMA 21 (negative trend bias).']); }
  if (momentum > 0.003) { score++; reasons.push(['Momentum', 'Recent closes show positive momentum.']); }
  else if (momentum < -0.003) { score--; reasons.push(['Momentum', 'Recent closes show negative momentum.']); }
  else reasons.push(['Momentum', 'Recent momentum is small or mixed.']);
  if (currentRsi < 35) { score++; reasons.push(['RSI', 'RSI is low; this can stay low during a downtrend.']); }
  else if (currentRsi > 70) { score--; reasons.push(['RSI', 'RSI is high; this can stay high during an uptrend.']); }
  else reasons.push(['RSI', 'RSI is between the usual high/low reference zones.']);
  if (score >= 2) return { side: 'BUY BIAS', score, rsi: currentRsi, fast, slow, momentum, reasons };
  if (score <= -2) return { side: 'SELL BIAS', score, rsi: currentRsi, fast, slow, momentum, reasons };
  return { side: 'WAIT', score, rsi: currentRsi, fast, slow, momentum, reasons };
}

export function createDemoCandles(symbol, count = 180) {
  const seed = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  let state = seed || 7;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  let close = symbol.startsWith('BTC') ? 68000 : symbol.startsWith('ETH') ? 3500 : symbol.startsWith('SOL') ? 170 : 600;
  const now = Date.now(), result = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = close;
    close = Math.max(close * 0.01, close * (1 + (rand() - 0.49) * 0.012));
    const wiggle = close * rand() * 0.004;
    result.push({ time: now - i * 3_600_000, open, close, high: Math.max(open, close) + wiggle, low: Math.min(open, close) - wiggle, volume: 1000 + rand() * 10000 });
  }
  return result;
}

export function backtest(candles, startingCash = STARTING_CASH) {
  if (candles.length < 40) return { trades: 0, cash: startingCash, pnl: 0, winRate: 0, maxDrawdown: 0 };
  let cash = startingCash, quantity = 0, entryValue = 0, fees = 0, peak = startingCash, maxDrawdown = 0;
  const outcomes = [];
  for (let i = 30; i < candles.length; i++) {
    const price = candles[i].close;
    const decision = analyze(candles.slice(0, i + 1));
    if (!quantity && decision.side === 'BUY BIAS') {
      const value = Math.min(cash / (1 + FEE_RATE), startingCash * 0.25);
      if (value > 0) { const fee = value * FEE_RATE; quantity = value / price; entryValue = value + fee; cash -= value + fee; fees += fee; }
    } else if (quantity && decision.side === 'SELL BIAS') {
      const gross = quantity * price, fee = gross * FEE_RATE;
      cash += gross - fee; fees += fee; outcomes.push(gross - fee - entryValue); quantity = 0; entryValue = 0;
    }
    const equity = cash + quantity * price;
    peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak ? (peak - equity) / peak : 0);
  }
  if (quantity) {
    const last = candles.at(-1).close, gross = quantity * last, fee = gross * FEE_RATE;
    cash += gross - fee; fees += fee; outcomes.push(gross - fee - entryValue);
  }
  return { trades: outcomes.length, cash, pnl: cash - startingCash, winRate: outcomes.length ? outcomes.filter(x => x > 0).length / outcomes.length : 0, maxDrawdown, fees };
}

export function portfolioEquity(account, prices) {
  return account.cash + account.positions.reduce((sum, p) => sum + p.quantity * (prices[p.symbol] || p.entryPrice), 0);
}
