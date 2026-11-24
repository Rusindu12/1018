import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApiServer, configFrom, floorToStep, signQuery, validOrderInput } from '../backend/server.js';

const envFor = extra => ({
  APP_ACCESS_TOKEN: 'test-token-with-more-than-32-characters-000000',
  BINANCE_API_KEY: '', BINANCE_API_SECRET: '',
  ...extra,
});

test('backend defaults to Binance Spot Testnet and disables live mode', () => {
  const cfg = configFrom(envFor({}));
  assert.equal(cfg.testnet, true);
  assert.equal(cfg.liveEnabled, false);
  assert.equal(cfg.host, 'https://testnet.binance.vision');
  assert.equal(configFrom(envFor({ LIVE_TRADING_ENABLED: 'true' })).liveEnabled, false);
});

test('live mode requires both explicit live endpoint selection and explicit enable flag', () => {
  const cfg = configFrom(envFor({ BINANCE_TESTNET: 'false', LIVE_TRADING_ENABLED: 'true' }));
  assert.equal(cfg.testnet, false);
  assert.equal(cfg.liveEnabled, true);
  assert.equal(cfg.host, 'https://api.binance.com');
  assert.equal(configFrom(envFor({ BINANCE_TESTNET: 'false' })).liveEnabled, false);
});

test('order validation is allowlisted, positive, capped, and confirmation-gated', () => {
  const cfg = configFrom(envFor({ MAX_ORDER_USDT: '25', MIN_ORDER_USDT: '10' }));
  assert.deepEqual(validOrderInput({ symbol: 'BTCUSDT', side: 'BUY', amount: 12, confirm: true }, cfg), { symbol: 'BTCUSDT', side: 'BUY', amount: 12 });
  assert.ok(validOrderInput({ symbol: 'DOGEUSDT', side: 'BUY', amount: 12, confirm: true }, cfg).error);
  assert.ok(validOrderInput({ symbol: 'BTCUSDT', side: 'SELL', amount: 1, confirm: false }, cfg).error);
  assert.ok(validOrderInput({ symbol: 'BTCUSDT', side: 'BUY', amount: 26, confirm: true }, cfg).error);
  assert.ok(validOrderInput({ symbol: 'BTCUSDT', side: 'BUY', amount: -1, confirm: true }, cfg).error);
});

test('quantity is rounded down to Binance lot step, never up', () => {
  assert.equal(floorToStep(0.12345678, '0.001'), '0.123');
  assert.equal(floorToStep(0.009, '0.01'), '0.00');
  assert.equal(floorToStep(Number.NaN, '0.001'), '0');
});

test('signed query uses HMAC-SHA256 and percent-encodes the parameter string', () => {
  const signed = signQuery({ symbol: 'BTCUSDT', note: 'a b' }, 'secret');
  assert.match(signed, /^symbol=BTCUSDT&note=a\+b&signature=[a-f0-9]{64}$/);
});

test('API reports health, requires a bearer token, and never returns credentials', async t => {
  const server = createApiServer({ env: envFor({}) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const denied = await fetch(`${base}/api/status`);
  assert.equal(denied.status, 401);
  const status = await fetch(`${base}/api/status`, { headers: { Authorization: `Bearer ${envFor({}).APP_ACCESS_TOKEN}` } });
  assert.equal(status.status, 200);
  const data = await status.json();
  assert.equal(data.mode, 'TESTNET');
  assert.equal(data.ordersEnabled, false);
  assert.equal('apiKey' in data, false);
  assert.equal('apiSecret' in data, false);
});

test('API rejects origins outside the explicit allowlist', async t => {
  const server = createApiServer({ env: envFor({ APP_ORIGINS: 'https://localhost' }) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status`, { headers: { Origin: 'https://attacker.example' } });
  assert.equal(response.status, 403);
});
