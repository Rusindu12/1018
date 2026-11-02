/* =====================================================================
   CryptoAI PRO — patterns.js
   Candlestick + structure pattern detector.
   Patterns.detect(candles) -> [{ key, name, dir, strength, age, note }]
     dir:      1 = bullish, -1 = bearish, 0 = neutral
     strength: 1..3  (how much the pattern matters)
     age:      bars since the pattern completed (0 = last closed bar)
   ===================================================================== */
(function (global) {
  'use strict';

  var TA = global.TA;
  var P = { version: '5.0.0' };

  function body(k) { return Math.abs(k.c - k.o); }
  function range(k) { return Math.max(1e-12, k.h - k.l); }
  function upper(k) { return k.h - Math.max(k.o, k.c); }
  function lower(k) { return Math.min(k.o, k.c) - k.l; }
  function bull(k) { return k.c > k.o; }
  function bear(k) { return k.c < k.o; }
  function mid(k) { return (k.o + k.c) / 2; }

  /* average body over the previous n bars — used to judge "small"/"big" */
  function avgBody(cd, i, n) {
    n = n || 10;
    var s = 0, c = 0;
    for (var j = Math.max(0, i - n); j < i; j++) { s += body(cd[j]); c++; }
    return c ? s / c : range(cd[i]);
  }
  function avgRange(cd, i, n) {
    n = n || 10;
    var s = 0, c = 0;
    for (var j = Math.max(0, i - n); j < i; j++) { s += range(cd[j]); c++; }
    return c ? s / c : range(cd[i]);
  }

  /* --------------------------- single candle -------------------------- */
  function single(cd, i, out) {
    var k = cd[i], ab = avgBody(cd, i), ar = avgRange(cd, i);
    var b = body(k), r = range(k), up = upper(k), lo = lower(k);

    /* Doji — open ≈ close */
    if (b <= r * 0.1) {
      var grav = lo > r * 0.55 && up < r * 0.15;
      var drag = up > r * 0.55 && lo < r * 0.15;
      out.push({
        key: grav ? 'pat.dragonfly' : drag ? 'pat.gravestone' : 'pat.doji',
        name: grav ? 'Dragonfly doji' : drag ? 'Gravestone doji' : 'Doji',
        dir: grav ? 1 : drag ? -1 : 0, strength: grav || drag ? 2 : 1, age: 0,
        note: grav ? 'Long lower wick, buyers took control' : drag ? 'Long upper wick, sellers took control' : 'Indecision — open and close are the same'
      });
    }

    /* Hammer / hanging man */
    if (lo >= r * 0.55 && up <= r * 0.2 && b <= r * 0.4) {
      var nearLow = TA ? 0 : 0;
      var trendDown = i > 10 && cd[i].c < cd[i - 10].c;
      out.push({
        key: trendDown ? 'pat.hammer' : 'pat.hanging',
        name: trendDown ? 'Hammer' : 'Hanging man',
        dir: trendDown ? 1 : -1, strength: bull(k) ? 2 : 1, age: 0,
        note: trendDown ? 'Long lower wick after a fall — possible reversal up' : 'Long lower wick after a rise — possible reversal down'
      });
    }

    /* Shooting star / inverted hammer */
    if (up >= r * 0.55 && lo <= r * 0.2 && b <= r * 0.4) {
      var trendUp = i > 10 && cd[i].c > cd[i - 10].c;
      out.push({
        key: trendUp ? 'pat.shootingstar' : 'pat.invertedhammer',
        name: trendUp ? 'Shooting star' : 'Inverted hammer',
        dir: trendUp ? -1 : 1, strength: bear(k) ? 2 : 1, age: 0,
        note: trendUp ? 'Long upper wick after a rise — sellers pushed back' : 'Long upper wick after a fall — buyers testing'
      });
    }

    /* Marubozu — full body, no wicks */
    if (b >= r * 0.92 && b >= ab * 1.15) {
      out.push({
        key: bull(k) ? 'pat.bullmarubozu' : 'pat.bearmarubozu',
        name: bull(k) ? 'Bullish marubozu' : 'Bearish marubozu',
        dir: bull(k) ? 1 : -1, strength: 3, age: 0,
        note: bull(k) ? 'Strong full green candle, no wicks' : 'Strong full red candle, no wicks'
      });
    }

    /* Spinning top */
    if (b > r * 0.1 && b < r * 0.35 && up > r * 0.25 && lo > r * 0.25) {
      out.push({ key: 'pat.spinningtop', name: 'Spinning top', dir: 0, strength: 1, age: 0, note: 'Balanced wicks, small body — the market is undecided' });
    }

    /* Big candle relative to recent average */
    if (b >= ab * 1.8 && b >= r * 0.7) {
      out.push({
        key: bull(k) ? 'pat.bigbull' : 'pat.bigbear',
        name: bull(k) ? 'Momentum candle (up)' : 'Momentum candle (down)',
        dir: bull(k) ? 1 : -1, strength: 2, age: 0,
        note: 'Body is ' + (b / ab).toFixed(1) + '× the recent average'
      });
    }
  }

  /* ---------------------------- two candles --------------------------- */
  function pair(cd, i, out) {
    if (i < 1) return;
    var a = cd[i - 1], k = cd[i], ab = avgBody(cd, i);
    var ba = body(a), bk = body(k);

    /* Bullish engulfing */
    if (bear(a) && bull(k) && k.o <= a.c && k.c >= a.o && bk > ba) {
      out.push({
        key: 'pat.bullengulf', name: 'Bullish engulfing', dir: 1,
        strength: bk >= ab * 1.3 ? 3 : 2, age: 0,
        note: 'Green body swallows the previous red body'
      });
    }
    /* Bearish engulfing */
    if (bull(a) && bear(k) && k.o >= a.c && k.c <= a.o && bk > ba) {
      out.push({
        key: 'pat.bearengulf', name: 'Bearish engulfing', dir: -1,
        strength: bk >= ab * 1.3 ? 3 : 2, age: 0,
        note: 'Red body swallows the previous green body'
      });
    }
    /* Bullish harami */
    if (bear(a) && bull(k) && k.o < a.o && k.c > a.c && bk < ba * 0.9) {
      out.push({ key: 'pat.bullharami', name: 'Bullish harami', dir: 1, strength: 1, age: 0, note: 'Small green body inside a big red body — selling is losing steam' });
    }
    /* Bearish harami */
    if (bull(a) && bear(k) && k.o > a.o && k.c < a.c && bk < ba * 0.9) {
      out.push({ key: 'pat.bearharami', name: 'Bearish harami', dir: -1, strength: 1, age: 0, note: 'Small red body inside a big green body — buying is losing steam' });
    }
    /* Piercing line */
    if (bear(a) && bull(k) && k.o < a.l && k.c > mid(a) && k.c < a.o) {
      out.push({ key: 'pat.piercing', name: 'Piercing line', dir: 1, strength: 2, age: 0, note: 'Gap down then closed above the midpoint of the red body' });
    }
    /* Dark cloud cover */
    if (bull(a) && bear(k) && k.o > a.h && k.c < mid(a) && k.c > a.o) {
      out.push({ key: 'pat.darkcloud', name: 'Dark cloud cover', dir: -1, strength: 2, age: 0, note: 'Gap up then closed below the midpoint of the green body' });
    }
    /* Tweezers */
    var tol = Math.max(a.h, k.h) * 0.0015;
    if (Math.abs(a.h - k.h) <= tol) out.push({ key: 'pat.tweezertop', name: 'Tweezer top', dir: -1, strength: 2, age: 0, note: 'Two candles rejected the same high' });
    if (Math.abs(a.l - k.l) <= tol) out.push({ key: 'pat.tweezerbot', name: 'Tweezer bottom', dir: 1, strength: 2, age: 0, note: 'Two candles bounced from the same low' });
  }

  /* ---------------------------- three candles ------------------------- */
  function triple(cd, i, out) {
    if (i < 2) return;
    var a = cd[i - 2], b = cd[i - 1], k = cd[i];
    var ab = avgBody(cd, i);

    /* Morning star */
    if (bear(a) && body(a) > ab * 0.8 && body(b) < body(a) * 0.5 && bull(k) && k.c > mid(a)) {
      out.push({ key: 'pat.morningstar', name: 'Morning star', dir: 1, strength: 3, age: 0, note: 'Red candle, small pause, strong green close above the midpoint' });
    }
    /* Evening star */
    if (bull(a) && body(a) > ab * 0.8 && body(b) < body(a) * 0.5 && bear(k) && k.c < mid(a)) {
      out.push({ key: 'pat.eveningstar', name: 'Evening star', dir: -1, strength: 3, age: 0, note: 'Green candle, small pause, strong red close below the midpoint' });
    }
    /* Three white soldiers */
    if (bull(a) && bull(b) && bull(k) && b.c > a.c && k.c > b.c && b.o > a.o && k.o > b.o) {
      out.push({ key: 'pat.soldiers', name: 'Three white soldiers', dir: 1, strength: 3, age: 0, note: 'Three consecutive strong green closes' });
    }
    /* Three black crows */
    if (bear(a) && bear(b) && bear(k) && b.c < a.c && k.c < b.c && b.o < a.o && k.o < b.o) {
      out.push({ key: 'pat.crows', name: 'Three black crows', dir: -1, strength: 3, age: 0, note: 'Three consecutive strong red closes' });
    }
  }

  /* --------------------------- structure patterns --------------------- */
  function structure(cd, i, out, snap) {
    if (i < 30 || !snap) return;
    var k = cd[i], price = k.c;

    /* Support / resistance bounce and rejection */
    var lv = (snap.levels || []).slice(0, 6);
    for (var n = 0; n < lv.length; n++) {
      var L = lv[n], d = Math.abs(price - L.price) / price * 100;
      if (d < 0.6 && L.touches >= 2) {
        if (L.price <= price) out.push({ key: 'pat.supportbounce', name: 'Support test', dir: 1, strength: L.touches >= 3 ? 3 : 2, age: 0, note: 'Price is ' + d.toFixed(2) + '% from a support touched ' + L.touches + '×' });
        else out.push({ key: 'pat.resistreject', name: 'Resistance test', dir: -1, strength: L.touches >= 3 ? 3 : 2, age: 0, note: 'Price is ' + d.toFixed(2) + '% below a resistance touched ' + L.touches + '×' });
        break;
      }
    }

    /* Range breakout */
    if (snap.high20 && price > snap.high20) out.push({ key: 'pat.breakout20', name: 'Breakout above 20-bar high', dir: 1, strength: 3, age: 0, note: 'Close ' + price.toFixed(4) + ' over the 20-bar high' });
    if (snap.low20 && price < snap.low20) out.push({ key: 'pat.breakdown20', name: 'Breakdown below 20-bar low', dir: -1, strength: 3, age: 0, note: 'Close ' + price.toFixed(4) + ' under the 20-bar low' });

    /* Bollinger squeeze then expansion */
    var w = snap.bb.width, wi = w[i];
    if (isFinite(wi)) {
      var recent = w.slice(Math.max(0, i - 60), i).filter(isFinite).sort(function (x, y) { return x - y; });
      if (recent.length > 20) {
        var q = recent[Math.floor(recent.length * 0.15)];
        if (wi <= q * 1.1) out.push({ key: 'pat.squeeze', name: 'Bollinger squeeze', dir: 0, strength: 2, age: 0, note: 'Volatility is in its lowest 15% — a big move often follows' });
      }
      if (price > snap.bb.upper[i]) out.push({ key: 'pat.bbup', name: 'Close above upper band', dir: -1, strength: 1, age: 0, note: 'Stretched to the upside — mean reversion risk' });
      if (price < snap.bb.lower[i]) out.push({ key: 'pat.bbdn', name: 'Close below lower band', dir: 1, strength: 1, age: 0, note: 'Stretched to the downside — mean reversion chance' });
    }

    /* Higher-highs / lower-lows structure */
    var sw = snap.swings || { highs: [], lows: [] };
    if (sw.highs.length >= 2 && sw.lows.length >= 2) {
      var h1 = sw.highs[sw.highs.length - 1].price, h2 = sw.highs[sw.highs.length - 2].price;
      var l1 = sw.lows[sw.lows.length - 1].price, l2 = sw.lows[sw.lows.length - 2].price;
      if (h1 > h2 && l1 > l2) out.push({ key: 'pat.hh', name: 'Higher highs + higher lows', dir: 1, strength: 2, age: 0, note: 'Textbook uptrend structure' });
      else if (h1 < h2 && l1 < l2) out.push({ key: 'pat.lh', name: 'Lower highs + lower lows', dir: -1, strength: 2, age: 0, note: 'Textbook downtrend structure' });
    }

    /* Volume climax */
    var vr = snap.volRatio ? snap.volRatio[i] : NaN;
    if (isFinite(vr) && vr >= 2.5) {
      out.push({
        key: vr > 0 && k.c > k.o ? 'pat.volclimaxup' : 'pat.volclimaxdn',
        name: 'Volume spike ' + vr.toFixed(1) + '×', dir: k.c > k.o ? 1 : -1, strength: vr >= 4 ? 3 : 2, age: 0,
        note: 'Volume is ' + vr.toFixed(1) + '× the 20-bar average — real participation'
      });
    }

    /* Divergence: price makes a new low but RSI does not (and the mirror) */
    var rsi = snap.rsi, look = 40;
    if (rsi && i > look) {
      var half = Math.floor(look / 2);
      var p1 = Math.min.apply(null, cd.slice(i - look, i - half).map(function (x) { return x.l; }));
      var p2 = Math.min.apply(null, cd.slice(i - half, i + 1).map(function (x) { return x.l; }));
      var r1 = Math.min.apply(null, rsi.slice(i - look, i - half).filter(isFinite));
      var r2 = Math.min.apply(null, rsi.slice(i - half, i + 1).filter(isFinite));
      if (p2 < p1 && r2 > r1 && isFinite(r1) && isFinite(r2)) {
        out.push({ key: 'pat.bulldiv', name: 'Bullish RSI divergence', dir: 1, strength: 3, age: 0, note: 'Lower low in price, higher low in RSI' });
      }
      var q1 = Math.max.apply(null, cd.slice(i - look, i - half).map(function (x) { return x.h; }));
      var q2 = Math.max.apply(null, cd.slice(i - half, i + 1).map(function (x) { return x.h; }));
      var s1 = Math.max.apply(null, rsi.slice(i - look, i - half).filter(isFinite));
      var s2 = Math.max.apply(null, rsi.slice(i - half, i + 1).filter(isFinite));
      if (q2 > q1 && s2 < s1 && isFinite(s1) && isFinite(s2)) {
        out.push({ key: 'pat.beardiv', name: 'Bearish RSI divergence', dir: -1, strength: 3, age: 0, note: 'Higher high in price, lower high in RSI' });
      }
    }
  }

  /* ------------------------------- public API ------------------------- */
  /* scan the last `depth` bars; age = bars ago (0 = newest closed bar) */
  P.detect = function (cd, depth, snap) {
    if (!cd || cd.length < 5) return [];
    depth = depth || 3;
    snap = snap || (TA ? TA.snapshot(cd) : null);
    var raw = [];
    var end = cd.length - 1;
    for (var back = 0; back < Math.min(depth, end); back++) {
      var i = end - back;
      var local = P.at(cd, i, back === 0 ? snap : null);
      local.forEach(function (x) { x.age = back; raw.push(x); });
    }
    /* de-duplicate by key, keep the freshest */
    var seen = {}, out = [];
    raw.forEach(function (x) {
      if (seen[x.key]) return;
      seen[x.key] = 1; out.push(x);
    });
    return out.sort(function (a, b) { return (b.strength - a.strength) || (a.age - b.age); });
  };

  /* patterns that complete exactly at bar i (O(1) — safe to call per bar) */
  P.at = function (cd, i, snap) {
    var out = [];
    if (!cd || i < 1) return out;
    single(cd, i, out);
    pair(cd, i, out);
    triple(cd, i, out);
    if (snap) structure(cd, i, out, snap);
    return out;
  };

  /* per-bar pattern score series, -100..100 (cheap: no structure pass) */
  P.series = function (cd) {
    var out = new Array(cd.length);
    for (var i = 0; i < cd.length; i++) {
      var pats = i < 3 ? [] : P.at(cd, i, null);
      out[i] = P.score(pats);
    }
    return out;
  };

  /* net pattern score in -100..100 */
  P.score = function (pats) {
    if (!pats || !pats.length) return 0;
    var s = 0;
    pats.forEach(function (p) {
      var ageDecay = p.age === 0 ? 1 : p.age === 1 ? 0.7 : 0.45;
      s += p.dir * p.strength * 8 * ageDecay;
    });
    return TA ? TA.clamp(s, -100, 100) : Math.max(-100, Math.min(100, s));
  };

  P.describe = function (pats) {
    if (!pats.length) return { key: 'pat.none', dir: 0, text: 'No clear candlestick pattern in the last bars' };
    var best = pats[0];
    return { key: best.key, dir: best.dir, text: best.name + ' — ' + best.note };
  };

  global.Patterns = P;
})(typeof window !== 'undefined' ? window : globalThis);
