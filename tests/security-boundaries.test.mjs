import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('APK client contains no Binance API-key or secret configuration fields', async () => {
  for (const file of ['crypto/app.js', 'crypto/index.html', 'crypto/engine.js']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /BINANCE_API_(?:KEY|SECRET)/);
  }
});

test('backend access token is never persisted in browser storage', async () => {
  const source = await readFile(new URL('../crypto/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\s*\(\s*['"](?:backend-)?token/i);
  assert.match(source, /backendToken/);
  assert.match(source, /liveSession\s*=\s*\{[^}]*token:\s*['"]['"]/s);
});
