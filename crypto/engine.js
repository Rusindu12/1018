export const SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', name: 'Ethereum' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', name: 'Solana' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', name: 'BNB' },
];
export const STARTING_CASH = 10_000;
export const FEE_RATE = 0.001;
export const SLIPPAGE_RATE = 0.0005;

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

function average(values) { return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0; }
function trueRange(candle, previousClose) {
  const high = Number(candle.high), low = Number(candle.low);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return NaN;
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}

/**
 * Explainable multi-factor signal. Scores are direction/indicator agreement,
 * never calibrated odds or a claim of profitability.
 */
export function analyze(candles) {
  const valid = candles.filter(c => Number.isFinite(Number(c.close)) && Number(c.close) > 0);
  if (valid.length < 60) return {
    side: 'WAIT', score: 0, strength: 0, rsi: null, fast: null, slow: null, long: null,
    atrPct: null, reasons: [['Data', 'Need at least 60 valid candles for the multi-factor read.']], factors: [],
  };
  const closes = valid.map(c => Number(c.close));
  const fastSeries = ema(closes, 9), midSeries = ema(closes, 21), longSeries = ema(closes, 50);
  const fast = fastSeries.at(-1), slow = midSeries.at(-1), long = longSeries.at(-1), last = closes.at(-1);
  const roc5 = last / closes.at(-6) - 1, roc20 = last / closes.at(-21) - 1;
  const currentRsi = rsi(closes, 14);
  const fastMacd = ema(closes, 12), slowMacd = ema(closes, 26);
  const macdLine = closes.map((_, i) => fastMacd[i] - slowMacd[i]);
  const macdSignal = ema(macdLine, 9), macdHist = macdLine.at(-1) - macdSignal.at(-1);
  const previousHist = macdLine.at(-2) - macdSignal.at(-2);
  const ranges = valid.slice(-14).map((c, i, arr) => trueRange(c, Number(valid[Math.max(0, valid.length - 14 + i - 1)].close))).filter(Number.isFinite);
  const atr = average(ranges), atrPct = atr / last;
  const volumes = valid.map(c => Number(c.volume)).filter(n => Number.isFinite(n) && n >= 0);
  const recentVolume = average(volumes.slice(-5));
  const baselineVolume = average(volumes.slice(-25, -5));
  const volumeRatio = baselineVolume > 0 ? recentVolume / baselineVolume : 1;
  let score = 0;
  const reasons = [];
  const factors = [];
  const add = (name, points, reason) => { score += points; factors.push({ name, points }); reasons.push([name, reason]); };

  if (fast > slow && slow > long) add('Trend stack', 2, 'EMA 9 > 21 > 50: short and medium trend align upward.');
  else if (fast < slow && slow < long) add('Trend stack', -2, 'EMA 9 < 21 < 50: short and medium trend align downward.');
  else if (fast > slow) add('Trend stack', 1, 'Short trend is above EMA 21, but EMA 50 confirmation is mixed.');
  else if (fast < slow) add('Trend stack', -1, 'Short trend is below EMA 21, but EMA 50 confirmation is mixed.');
  else add('Trend stack', 0, 'Fast and medium trend lines are nearly level.');

  if (roc5 > 0.004) add('Short momentum', 1, `Five-candle return is positive (${(roc5 * 100).toFixed(2)}%).`);
  else if (roc5 < -0.004) add('Short momentum', -1, `Five-candle return is negative (${(roc5 * 100).toFixed(2)}%).`);
  else add('Short momentum', 0, 'Five-candle move is small or mixed.');
  if (roc20 > 0.015) add('Swing momentum', 1, `Twenty-candle return is positive (${(roc20 * 100).toFixed(2)}%).`);
  else if (roc20 < -0.015) add('Swing momentum', -1, `Twenty-candle return is negative (${(roc20 * 100).toFixed(2)}%).`);
  else add('Swing momentum', 0, 'Twenty-candle trend has not cleared the momentum threshold.');

  if (macdHist > 0 && macdHist >= previousHist) add('MACD', 1, 'MACD histogram is positive and rising.');
  else if (macdHist < 0 && macdHist <= previousHist) add('MACD', -1, 'MACD histogram is negative and falling.');
  else add('MACD', 0, 'MACD momentum is mixed or flattening.');

  if (currentRsi >= 82) add('RSI', -1, `RSI ${currentRsi.toFixed(1)} is stretched high; entries may be late.`);
  else if (currentRsi <= 18) add('RSI', 1, `RSI ${currentRsi.toFixed(1)} is stretched low; rebounds are not assured.`);
  else add('RSI', 0, `RSI ${currentRsi.toFixed(1)} is not at an extreme.`);

  if (volumeRatio >= 1.4 && roc5 > 0) add('Volume', 1, `Recent volume is ${volumeRatio.toFixed(2)}× its prior 20-candle average and price is rising.`);
  else if (volumeRatio >= 1.4 && roc5 < 0) add('Volume', -1, `Recent volume is ${volumeRatio.toFixed(2)}× its prior 20-candle average and price is falling.`);
  else if (volumeRatio < 0.45) add('Volume', 0, `Thin activity (${volumeRatio.toFixed(2)}× baseline) weakens the signal.`);
  else add('Volume', 0, `Volume confirmation is neutral (${volumeRatio.toFixed(2)}× baseline).`);

  const directionConfirmed = (score > 0 && last > long) || (score < 0 && last < long);
  const highVolatility = atrPct >= 0.07;
  const lowActivity = atrPct < 0.0001 || volumeRatio < 0.15;
  if (highVolatility) reasons.push(['Volatility guard', `ATR is ${(atrPct * 100).toFixed(2)}% of price; signal is held at WAIT in extreme volatility.`]);
  else if (lowActivity) reasons.push(['Activity guard', 'Market activity is too low or flat for a reliable rule read.']);
  else reasons.push(['Volatility', `ATR is ${(atrPct * 100).toFixed(2)}% of price; fast moves can make stops unreliable.`]);

  const strength = Math.round(Math.min(100, Math.abs(score) / 7 * 100));
  let side = 'WAIT';
  if (!highVolatility && !lowActivity && directionConfirmed && score >= 3) side = 'BUY BIAS';
  if (!highVolatility && !lowActivity && directionConfirmed && score <= -3) side = 'SELL BIAS';
  if (!directionConfirmed && score !== 0) reasons.push(['Confirmation', 'Price has not confirmed the long EMA 50 trend; wait for alignment.']);
  return { side, score, strength, rsi: currentRsi, fast, slow, long, momentum: roc5, roc20, macdHist, atr, atrPct, volumeRatio, reasons, factors };
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

/** Conservative one-position, long-only walk-forward illustration. At each
 * bar, decide using only prior closes and simulate entry at the next open. */
export function backtest(candles, startingCash = STARTING_CASH) {
  if (!Array.isArray(candles) || candles.length < 61 || !Number.isFinite(startingCash) || startingCash <= 0) {
    return { trades: 0, cash: startingCash, pnl: 0, winRate: 0, maxDrawdown: 0, fees: 0, slippage: 0, profitFactor: 0 };
  }
  let cash = startingCash, quantity = 0, entryCost = 0, entryPrice = 0, stopPrice = 0;
  let fees = 0, slippage = 0, peak = startingCash, maxDrawdown = 0;
  const outcomes = [];
  const mark = price => {
    const netEquity = cash + quantity * price;
    peak = Math.max(peak, netEquity);
    maxDrawdown = Math.max(maxDrawdown, peak ? (peak - netEquity) / peak : 0);
  };
  const exit = rawPrice => {
    const fill = rawPrice * (1 - SLIPPAGE_RATE), gross = quantity * fill, fee = gross * FEE_RATE;
    slippage += quantity * Math.abs(rawPrice - fill); fees += fee; cash += gross - fee;
    outcomes.push(gross - fee - entryCost);
    quantity = 0; entryCost = 0; entryPrice = 0; stopPrice = 0;
  };
  for (let i = 60; i < candles.length; i++) {
    const decision = analyze(candles.slice(0, i));
    const bar = candles[i], open = Number(bar.open), close = Number(bar.close), low = Number(bar.low);
    if (![open, close, low].every(n => Number.isFinite(n) && n > 0)) continue;
    if (!quantity && decision.side === 'BUY BIAS') {
      const budget = Math.min(cash / (1 + FEE_RATE), startingCash * 0.25);
      const fill = open * (1 + SLIPPAGE_RATE), fee = budget * FEE_RATE;
      if (budget > 0 && budget + fee <= cash) {
        quantity = budget / fill; entryPrice = fill; entryCost = budget + fee; cash -= entryCost;
        fees += fee; slippage += quantity * (fill - open);
        stopPrice = entryPrice * (1 - Math.max(0.01, Math.min(0.04, (decision.atrPct || 0.01) * 1.5)));
      }
    } else if (quantity) {
      if (low <= stopPrice) exit(Math.min(open, stopPrice));
      else if (decision.side === 'SELL BIAS') exit(open);
    }
    mark(close);
  }
  if (quantity) exit(Number(candles.at(-1).close));
  const wins = outcomes.filter(x => x > 0), losses = outcomes.filter(x => x < 0);
  const grossWins = wins.reduce((sum, n) => sum + n, 0), grossLosses = Math.abs(losses.reduce((sum, n) => sum + n, 0));
  mark(cash);
  return {
    trades: outcomes.length, cash, pnl: cash - startingCash,
    winRate: outcomes.length ? wins.length / outcomes.length : 0,
    maxDrawdown, fees, slippage,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0,
    averageTrade: outcomes.length ? outcomes.reduce((sum, n) => sum + n, 0) / outcomes.length : 0,
  };
}

export function portfolioEquity(account, prices) {
  return account.cash + account.positions.reduce((sum, p) => sum + p.quantity * (prices[p.symbol] || p.entryPrice), 0);
}
