import { trainModel } from '../trading/model.js';

// Experimental policy: always evaluate closed candles only. No claim of profitability.
export function decide(closes, position, options = {}) {
  const buyThreshold = options.buyThreshold ?? 0.65;
  const sellThreshold = options.sellThreshold ?? 0.35;
  const stopLoss = options.stopLoss ?? 0.02;
  const takeProfit = options.takeProfit ?? 0.03;
  const price = closes.at(-1);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price');
  const model = trainModel(closes);
  if (position) {
    if (price <= position.entry * (1 - stopLoss)) return { side: 'SELL', reason: 'stop threshold', model };
    if (price >= position.entry * (1 + takeProfit)) return { side: 'SELL', reason: 'profit threshold', model };
    if (model.probability <= sellThreshold) return { side: 'SELL', reason: 'model threshold', model };
  } else if (model.probability >= buyThreshold && model.accuracy > model.baseline) {
    return { side: 'BUY', reason: 'model threshold with holdout above baseline', model };
  }
  return { side: 'HOLD', reason: 'no signal', model };
}
