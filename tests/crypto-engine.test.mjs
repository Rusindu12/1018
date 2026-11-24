import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, backtest, createDemoCandles, ema, rsi, FEE_RATE } from '../crypto/engine.js';

test('EMA carries the seed and follows a constant series exactly', () => {
  assert.deepEqual(ema([5, 5, 5, 5], 3), [5, 5, 5, 5]);
  assert.equal(ema([1, 2, 3], 2).length, 3);
});

test('RSI handles steady gains, steady losses, and insufficient history', () => {
  assert.equal(rsi([1, 2, 3], 3), null);
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => i + 1)), 100);
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => 20 - i)), 0);
  assert.equal(rsi(Array.from({ length: 20 }, () => 2)), 50);
});

test('signal is neutral when there are not enough candles', () => {
  assert.equal(analyze(createDemoCandles('BTCUSDT', 20)).side, 'WAIT');
});

test('multi-factor read explains a sustained trend and labels agreement, not probability', () => {
  const candles = Array.from({ length: 180 }, (_, i) => {
    const close = 100 + i * 0.15 + 1.2 * Math.sin(i * 1.2);
    return { time: i, open: close, high: close * 1.005, low: close * 0.995, close, volume: 100 + (i % 7) * 3 };
  });
  const result = analyze(candles);
  assert.equal(result.side, 'BUY BIAS');
  assert.ok(result.strength > 0 && result.strength <= 100);
  assert.ok(result.atrPct > 0 && Number.isFinite(result.volumeRatio));
  assert.ok(result.reasons.some(([name]) => name === 'MACD'));
  assert.ok(result.reasons.some(([name]) => name === 'Volatility'));
});

test('extreme ATR forces the signal to WAIT rather than encouraging a trade', () => {
  const candles = Array.from({ length: 100 }, (_, i) => {
    const close = i % 2 ? 120 : 80;
    return { time: i, open: close, high: 132, low: 68, close, volume: 100 };
  });
  const result = analyze(candles);
  assert.equal(result.side, 'WAIT');
  assert.ok(result.reasons.some(([name]) => name === 'Volatility guard'));
});

test('demo candles are repeatable and contain valid OHLC ranges', () => {
  const a = createDemoCandles('ETHUSDT', 50), b = createDemoCandles('ETHUSDT', 50);
  assert.deepEqual(a.map(({ time, ...candle }) => candle), b.map(({ time, ...candle }) => candle));
  assert.equal(a.length, 50);
  assert.ok(a[1].time > a[0].time);
  for (const c of a) assert.ok(c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close));
});

test('flat historical prices do not produce an artificial trade or profit', () => {
  const flat = Array.from({ length: 100 }, (_, i) => ({ time: i, open: 100, high: 100, low: 100, close: 100, volume: 1 }));
  const result = backtest(flat);
  assert.equal(result.trades, 0);
  assert.equal(result.pnl, 0);
  assert.equal(FEE_RATE, 0.001);
  assert.equal(analyze(flat).side, 'WAIT');
});

test('backtest simulation applies entry and exit fees to closed trades', () => {
  const candles = Array.from({ length: 180 }, (_, i) => {
    const close = i < 70 ? 100 + i * 0.2 + 2 * Math.sin(i * 1.1)
      : i < 130 ? 114 - (i - 70) * 0.25 + 2 * Math.sin(i * 1.1)
        : 99 + (i - 130) * 0.2 + 2 * Math.sin(i * 1.1);
    return { time: i, open: close, high: close + 1, low: close - 1, close, volume: 1 };
  });
  const result = backtest(candles);
  assert.ok(result.trades > 0);
  assert.ok(result.fees > 0);
  assert.ok(result.slippage > 0);
  assert.ok(Number.isFinite(result.maxDrawdown) && result.maxDrawdown >= 0);
});
