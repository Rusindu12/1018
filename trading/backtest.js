import { decide } from './strategy.js';

/** Chronological, long-only simulation: signal at close, execution at next open.
 * Assumptions are intentionally simple and do not model liquidity or partial fills. */
export function backtest(bars, { initialCash = 10000, fee = 0.001, slippage = 0.0005, window = 100 } = {}) {
  if (!Array.isArray(bars) || bars.length < window + 2 || !Number.isInteger(window) || window < 70 ||
      !Number.isFinite(initialCash) || initialCash <= 0 || !Number.isFinite(fee) || fee < 0 || fee >= 1 ||
      !Number.isFinite(slippage) || slippage < 0 || slippage >= 1 ||
      bars.some((b, i) => !Number.isFinite(b.open) || b.open <= 0 || !Number.isFinite(b.close) || b.close <= 0 || !Number.isFinite(b.time) || (i && b.time <= bars[i - 1].time))) {
    throw new Error('Not enough valid chronological candles or invalid assumptions.');
  }
  let cash = initialCash, qty = 0, entry = 0, trades = 0, peak = initialCash, maxDrawdown = 0;
  const equity = [];
  for (let i = window - 1; i < bars.length - 1; i++) {
    const closes = bars.slice(i - window + 1, i + 1).map(b => b.close);
    const signal = decide(closes, qty ? { entry, quantity: qty } : null);
    const open = bars[i + 1].open;
    if (signal.side === 'BUY' && !qty) {
      const price = open * (1 + slippage);
      qty = cash / (price * (1 + fee));
      entry = price; cash = 0; trades++;
    } else if (signal.side === 'SELL' && qty) {
      cash = qty * open * (1 - slippage) * (1 - fee);
      qty = 0; entry = 0; trades++;
    }
    // Mark to the close of the execution candle, without assuming liquidation.
    const value = cash + qty * bars[i + 1].close;
    equity.push(value);
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  }
  const finalValue = equity.at(-1);
  return { initialCash, finalValue, returnPct: (finalValue / initialCash - 1) * 100,
    maxDrawdownPct: maxDrawdown * 100, trades, openPosition: qty > 0,
    buyHoldPct: (bars.at(-1).close / bars[window].open - 1) * 100,
    candles: bars.length, evaluated: equity.length };
}
