// Long-only position sizing, before fees and slippage. No order is placed.
export function calculateRisk(balance, riskPercent, entry, stop) {
  if (![balance, riskPercent, entry, stop].every(Number.isFinite) || balance <= 0 || riskPercent <= 0 || riskPercent > 100 || entry <= 0 || stop <= 0 || stop >= entry) {
    throw new Error('Enter positive values, risk no higher than 100%, and a stop below entry.');
  }
  const budget = balance * riskPercent / 100;
  const quantity = Math.min(budget / (entry - stop), balance / entry);
  if (!Number.isFinite(quantity)) throw new Error('Values are outside the supported range.');
  return { budget, quantity, cost: quantity * entry, estimatedLoss: quantity * (entry - stop), capped: budget / (entry - stop) > balance / entry };
}
