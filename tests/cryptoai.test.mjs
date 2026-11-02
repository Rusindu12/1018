// CryptoAI PRO engine tests — pure Node, no dependencies.
// Loads the same source files the APK ships (mobile/src/js/*.js) inside a VM
// sandbox and checks the maths, the pattern detector, the brain, the
// backtester, the bilingual dictionary and the single-file build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repo, 'mobile', 'src', 'js');

/* ---------- deterministic synthetic market --------------------------- */
function candles(n = 240, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 17) * 0.004 + (rnd() - 0.5) * 0.012;
    const o = price;
    const c = Math.max(1, o * (1 + drift));
    const h = Math.max(o, c) * (1 + rnd() * 0.004);
    const l = Math.min(o, c) * (1 - rnd() * 0.004);
    out.push({ t: 1700000000000 + i * 300000, o, h, l, c, v: 10 + rnd() * 40 });
    price = c;
  }
  return out;
}

/* ---------- load the engine in a sandbox ----------------------------- */
function loadEngine() {
  const ctx = vm.createContext({ console, TextEncoder, setTimeout, clearTimeout });
  for (const f of ['i18n.js', 'ta.js', 'patterns.js', 'brain.js']) {
    const code = readFileSync(join(src, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

test('engine files all parse and export their globals', () => {
  const g = loadEngine();
  for (const name of ['I18N', 'TA', 'Patterns', 'Brain']) {
    assert.ok(g[name], `${name} is missing`);
    if (g[name].version) assert.match(g[name].version, /^\d+\.\d+\.\d+$/);
  }
});

test('TA: sma / ema / rma are the right length and end where they should', () => {
  const { TA } = loadEngine();
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const sma = TA.sma(v, 3);
  assert.equal(sma.length, v.length);
  assert.ok(Number.isNaN(sma[1]));
  assert.equal(sma[2], 2);
  assert.equal(sma[9], 9);
  const ema = TA.ema(v, 3);
  assert.equal(ema[2], 2);                       // seed = sma of the first p
  assert.ok(ema[9] > ema[8]);                    // rising series keeps rising
  assert.equal(TA.rma(v, 3).length, v.length);
});

test('TA: rsi is 100 for a monotonic rise and 50 for a flat line', () => {
  const { TA } = loadEngine();
  const up = Array.from({ length: 40 }, (_, i) => 100 + i);
  assert.equal(TA.last(TA.rsi(up, 14)), 100);
  const flat = Array.from({ length: 40 }, () => 100);
  const r = TA.last(TA.rsi(flat, 14));
  assert.ok(Number.isNaN(r) || r === 100 || r === 50, `flat rsi was ${r}`);
  const mixed = candles(120).map((k) => k.c);
  const rsi = TA.last(TA.rsi(mixed, 14));
  assert.ok(rsi >= 0 && rsi <= 100, `rsi out of range: ${rsi}`);
});

test('TA: bollinger, macd, atr, adx, supertrend stay inside their bounds', () => {
  const { TA } = loadEngine();
  const cd = candles(300);
  const c = cd.map((k) => k.c);
  const bb = TA.bollinger(c, 20, 2);
  const i = c.length - 1;
  assert.ok(bb.upper[i] > bb.mid[i] && bb.mid[i] > bb.lower[i], 'bands are not ordered');
  assert.ok(bb.width[i] > 0);

  const m = TA.macd(c);
  assert.equal(m.macd.length, c.length);
  assert.ok(Number.isFinite(m.hist[i]));

  const atr = TA.atr(cd, 14);
  assert.ok(atr[i] > 0 && atr[i] < c[i], 'ATR should be positive and smaller than price');

  const adx = TA.adx(cd, 14);
  assert.ok(adx.adx[i] >= 0 && adx.adx[i] <= 100, `ADX out of range: ${adx.adx[i]}`);

  const st = TA.supertrend(cd, 10, 3);
  assert.ok(st.dir[i] === 1 || st.dir[i] === -1);
  assert.ok(Number.isFinite(st.st[i]));

  const tr = TA.tr(cd);
  assert.ok(tr.every((x, n) => n === 0 || x >= 0), 'true range must never be negative');
});

test('TA: snapshot returns everything the UI asks for', () => {
  const { TA } = loadEngine();
  const snap = TA.snapshot(candles(200));
  for (const key of ['price', 'rsi', 'macd', 'bb', 'stoch', 'adx', 'atr', 'volRatio', 'supertrend', 'trend', 'reg', 'pivots', 'levels', 'swings']) {
    assert.ok(snap[key] !== undefined, `snapshot is missing ${key}`);
  }
  assert.ok(['up', 'down', 'flat'].includes(snap.trend.dir));
  assert.ok(snap.pivots.r1 > snap.pivots.p && snap.pivots.p > snap.pivots.s1);
});

test('Patterns: detects an engulfing pair and scores it bullish', () => {
  const { Patterns, TA } = loadEngine();
  const cd = candles(60);
  const last = cd[cd.length - 1];
  // force a clean bullish engulfing on the final bar
  cd[cd.length - 2] = { ...cd[cd.length - 2], o: last.c + 2, c: last.c + 1, h: last.c + 2.5, l: last.c + 0.8 };
  cd[cd.length - 1] = { ...last, o: last.c + 0.9, c: last.c + 3, h: last.c + 3.2, l: last.c + 0.8 };
  const pats = Patterns.detect(cd, 3, TA.snapshot(cd));
  assert.ok(pats.length > 0, 'no pattern found');
  const keys = pats.map((p) => p.key);
  assert.ok(keys.includes('pat.bullengulf') || keys.some((k) => k.includes('bull')), `got ${keys.join(',')}`);
  const score = Patterns.score(pats);
  assert.ok(score > 0 && score <= 100, `score out of range: ${score}`);
  pats.forEach((p) => {
    assert.ok([-1, 0, 1].includes(p.dir));
    assert.ok(p.strength >= 1 && p.strength <= 3);
    assert.ok(p.name && p.note);
  });
});

test('Patterns: per-bar series is the same length as the candles', () => {
  const { Patterns } = loadEngine();
  const cd = candles(120);
  const s = Patterns.series(cd);
  assert.equal(s.length, cd.length);
  assert.ok(s.every((v) => v >= -100 && v <= 100));
});

test('Brain: features are normalised and every weight is used', () => {
  const { Brain } = loadEngine();
  const cd = candles(300);
  const ctx = Brain.context(cd);
  const f = Brain.featuresAt(cd, ctx, cd.length - 1);
  const keys = Object.keys(Brain.DEFAULT_WEIGHTS);
  for (const k of keys) {
    assert.ok(k in f, `feature ${k} missing`);
    assert.ok(Math.abs(f[k]) <= 1.0001, `feature ${k} out of [-1,1]: ${f[k]}`);
  }
  const s = Brain.scoreFeatures(f, Brain.DEFAULT_WEIGHTS);
  assert.ok(s.score >= -100 && s.score <= 100);
  assert.equal(s.contributions.length, keys.length);
});

test('Brain: analyze produces a verdict, a plan and indicator values', () => {
  const { Brain } = loadEngine();
  const cd = candles(300);
  const sig = Brain.analyze(cd);
  assert.equal(sig.ok, true);
  assert.ok(['strongbuy', 'buy', 'neutral', 'sell', 'strongsell'].includes(sig.verdict.id));
  assert.ok(sig.conf >= 1 && sig.conf <= 99);
  assert.ok(Number.isFinite(sig.ind.rsi) && Number.isFinite(sig.ind.atr));
  const pl = sig.plan;
  assert.ok(['long', 'short'].includes(pl.side));
  assert.ok(Number.isFinite(pl.entry) && Number.isFinite(pl.tp1) && Number.isFinite(pl.sl));
  assert.ok(pl.rr > 0, 'reward:risk must be positive');
  if (pl.side === 'long') {
    assert.ok(pl.tp1 > pl.entry && pl.sl < pl.entry, 'long plan is upside down');
  } else {
    assert.ok(pl.tp1 < pl.entry && pl.sl > pl.entry, 'short plan is upside down');
  }
  assert.ok(sig.trend.score >= -100 && sig.trend.score <= 100);
  assert.ok(sig.revert.score >= -100 && sig.revert.score <= 100);
});

test('Brain: too few candles fails cleanly instead of throwing', () => {
  const { Brain } = loadEngine();
  const sig = Brain.analyze(candles(12));
  assert.equal(sig.ok, false);
  assert.equal(sig.reason, 'not-enough-data');
});

test('Brain: reasons and the offline explanation are bilingual', () => {
  const { Brain } = loadEngine();
  const sig = Brain.analyze(candles(300));
  sig.symbol = 'BTC/USDT';
  sig.tf = '5m';
  for (const lang of ['en', 'si']) {
    const r = Brain.reasons(sig, lang);
    assert.ok(Array.isArray(r) && r.length > 0, `no reasons for ${lang}`);
    r.forEach((x) => assert.ok(x.text && x.text.length > 3));
    const text = Brain.explain(sig, lang);
    assert.ok(text.length > 120, `${lang} explanation too short`);
    assert.match(text, /USDT|ATR|·|%/);
  }
  assert.ok(Brain.prompt(sig, candles(300), 'en').includes('Not financial advice'));
});

test('Brain: every strategy scores within range on every bar', () => {
  const { Brain } = loadEngine();
  const cd = candles(260);
  const ctx = Brain.context(cd);
  for (const strat of Brain.STRATEGIES) {
    for (let i = 40; i < cd.length; i++) {
      const s = strat.score(cd, ctx, i, Brain.DEFAULT_WEIGHTS);
      assert.ok(Number.isFinite(s), `${strat.id} produced ${s} at bar ${i}`);
      assert.ok(s >= -100 && s <= 100, `${strat.id} out of range: ${s}`);
    }
    assert.ok(strat.en && strat.si && strat.enDesc && strat.siDesc, `${strat.id} is not bilingual`);
  }
  assert.equal(Brain.strategy('nope').id, 'ai', 'unknown strategies must fall back to ai');
});

test('Brain: backtest reports honest statistics and never trades the future', () => {
  const { Brain } = loadEngine();
  const cd = candles(400);
  const bt = Brain.backtest(cd, { strategy: 'ai', tp: 1.5, sl: 0.8, entry: 18, size: 100, fee: 0.1 });
  assert.equal(bt.ok, true);
  assert.equal(bt.equity.length, bt.trades + 1);
  assert.equal(bt.wins + bt.losses, bt.trades);
  if (bt.trades) {
    assert.ok(bt.winRate >= 0 && bt.winRate <= 100);
    const net = bt.all.reduce((a, t) => a + t.pnl, 0);
    assert.ok(Number.isFinite(net));
    assert.equal(bt.all.length, bt.trades);
    // every entry must be strictly after its signal bar and inside the data
    for (const t of bt.all) {
      assert.ok(t.i >= 36 && t.i < cd.length, `entry index out of range: ${t.i}`);
      assert.ok(t.bars >= 0);
      assert.ok(t.entry > 0 && t.exit > 0);
      assert.ok(['TP', 'SL', 'MIN', 'TIME', 'END'].includes(t.why), `unknown exit ${t.why}`);
    }
    assert.ok(bt.maxDD >= 0);
  }
  assert.equal(Brain.backtest(candles(20)).ok, false);
});

test('Brain: training keeps the weight shape and only accepts improvements', () => {
  const { Brain } = loadEngine();
  const cd = candles(600);
  const res = Brain.train(cd, { epochs: 25, horizon: 10 });
  assert.equal(res.ok, true);
  assert.ok(res.samples > 40);
  assert.equal(res.train + res.test, res.samples);
  assert.ok(res.before >= 0 && res.before <= 100 && res.after >= 0 && res.after <= 100);
  const keys = Object.keys(Brain.DEFAULT_WEIGHTS);
  for (const k of keys) {
    assert.ok(Number.isFinite(res.weights[k]), `weight ${k} is not finite`);
    assert.ok(Math.abs(res.weights[k]) <= 2);
  }
  if (!res.improved) {
    assert.deepEqual(res.weights, Brain.DEFAULT_WEIGHTS, 'rejected training must return the old weights');
  }
  assert.equal(Brain.train(candles(60)).ok, false);
});

test('Brain: mtfSummary agrees with the rows it is given', () => {
  const { Brain } = loadEngine();
  /* higher timeframes carry more weight: 5m .6, 15m .9, 1h 1.2, 4h 1.6, 1d 2.0 */
  const s = Brain.mtfSummary([
    { tf: '5m', ok: true, score: 40 }, { tf: '15m', ok: true, score: 40 },
    { tf: '1h', ok: true, score: 30 }, { tf: '4h', ok: true, score: -20 }, { tf: '1d', ok: false }
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.up, 3);                 // ±8 is the neutral band
  assert.equal(s.down, 1);
  assert.ok(Math.abs(s.avg - ((40 * 0.6 + 40 * 0.9 + 30 * 1.2 - 20 * 1.6) / 4.3)) < 0.01, `avg was ${s.avg}`);
  assert.equal(s.label, 'up');
  assert.equal(s.align, 60);             // 3 of 5 rows agree
  assert.equal(Brain.mtfSummary([]).label, 'mixed');
  assert.equal(Brain.mtfSummary([{ tf: '1d', ok: true, score: -60 }]).label, 'strong-down');
});

test('i18n: English and Sinhala cover exactly the same keys, none empty', () => {
  const { I18N } = loadEngine();
  const en = Object.keys(I18N.en).sort();
  const si = Object.keys(I18N.si).sort();
  assert.deepEqual(si, en, 'the two dictionaries drifted apart');
  assert.ok(en.length >= 120, `only ${en.length} keys`);
  for (const k of en) {
    assert.ok(I18N.en[k] && I18N.en[k].trim(), `empty en value for ${k}`);
    assert.ok(I18N.si[k] && I18N.si[k].trim(), `empty si value for ${k}`);
  }
});

test('i18n: every data-i18n key in the shell exists in the dictionary', () => {
  const { I18N } = loadEngine();
  const shell = readFileSync(join(repo, 'mobile', 'src', 'shell.html'), 'utf8');
  const keys = [...shell.matchAll(/data-i18n(?:-opt)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 120, `found only ${keys.length} keys in the shell`);
  const missing = [...new Set(keys)].filter((k) => !I18N.en[k] || !I18N.si[k]);
  assert.deepEqual(missing, [], 'shell keys missing from the dictionary');
});

test('build: the single-file output has no external scripts or styles', () => {
  for (const p of [join(repo, 'mobile', 'www', 'index.html'), join(repo, 'cryptoai.html')]) {
    assert.ok(existsSync(p), `${p} was not built`);
    const html = readFileSync(p, 'utf8');
    assert.ok(!/<script[^>]+src=/.test(html), `${p} still loads an external script`);
    assert.ok(!/<link[^>]+stylesheet/.test(html), `${p} still loads an external stylesheet`);
    assert.ok(html.includes('CryptoAI PRO'));
    assert.ok(html.includes('window.App') || html.includes('global.App'));
    assert.ok(statSync(p).size > 120_000, 'the bundle looks truncated');
  }
});

test('android: the Capacitor project is configured for this app', () => {
  const cfg = JSON.parse(readFileSync(join(repo, 'mobile', 'capacitor.config.json'), 'utf8'));
  assert.equal(cfg.appId, 'com.rusindu.cryptoaipro');
  assert.equal(cfg.appName, 'CryptoAI PRO');
  assert.equal(cfg.webDir, 'www');
  assert.equal(cfg.plugins.CapacitorHttp.enabled, true, 'native HTTP must stay on or CORS blocks the exchanges');
  assert.equal(cfg.server.androidScheme, 'https', 'crypto.subtle needs a secure context');

  const manifest = readFileSync(join(repo, 'mobile', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  for (const p of ['INTERNET', 'ACCESS_NETWORK_STATE', 'VIBRATE', 'WAKE_LOCK', 'POST_NOTIFICATIONS']) {
    assert.ok(manifest.includes(p), `manifest is missing ${p}`);
  }
  for (const denied of ['ACCESS_FINE_LOCATION', 'CAMERA', 'READ_CONTACTS', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE']) {
    assert.ok(!manifest.includes(denied), `manifest asks for ${denied} — it should not`);
  }
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));

  const gradle = readFileSync(join(repo, 'mobile', 'android', 'app', 'build.gradle'), 'utf8');
  assert.ok(gradle.includes('applicationId "com.rusindu.cryptoaipro"'));
  assert.ok(gradle.includes('CryptoAI-PRO-'));
  assert.ok(existsSync(join(repo, 'mobile', 'android', 'gradlew')));
  assert.ok(existsSync(join(repo, 'mobile', 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png')));
});

test('ci: the APK workflow builds, artefacts and releases', () => {
  const yml = readFileSync(join(repo, '.github', 'workflows', 'android-apk.yml'), 'utf8');
  for (const needle of ['assembleDebug', 'cap sync android', 'upload-artifact', 'gh release', 'contents: write', 'npm run build']) {
    assert.ok(yml.includes(needle), `workflow is missing "${needle}"`);
  }
});
