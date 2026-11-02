/* =====================================================================
   CryptoAI PRO — ta.js
   Technical-analysis engine. Every function takes plain arrays/candles
   and returns plain arrays — no dependencies, no network, no state.
   candle = { t, o, h, l, c, v }   (t = ms epoch, v = base volume)
   ===================================================================== */
(function (global) {
  'use strict';

  var TA = { version: '5.0.0' };

  /* ------------------------------ helpers --------------------------- */
  var num = function (x) { return typeof x === 'number' && isFinite(x) ? x : NaN; };
  TA.num = num;
  TA.last = function (a, back) {
    if (!a || !a.length) return NaN;
    var i = a.length - 1 - (back || 0);
    return i >= 0 ? a[i] : NaN;
  };
  TA.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  TA.pct = function (a, b) { return b ? ((a - b) / b) * 100 : 0; };
  TA.round = function (v, d) {
    if (!isFinite(v)) return NaN;
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(v * p) / p;
  };
  TA.filled = function (n, v) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = v; return a; };

  /* price step — how many decimals an exchange price needs */
  TA.step = function (p) {
    p = Math.abs(p || 0);
    if (p >= 1000) return 1;
    if (p >= 100) return 2;
    if (p >= 1) return 3;
    if (p >= 0.01) return 5;
    return 8;
  };

  /* ------------------------------ moving averages -------------------- */
  TA.sma = function (v, p) {
    var out = TA.filled(v.length, NaN), s = 0;
    for (var i = 0; i < v.length; i++) {
      s += v[i];
      if (i >= p) s -= v[i - p];
      if (i >= p - 1) out[i] = s / p;
    }
    return out;
  };

  TA.ema = function (v, p) {
    var out = TA.filled(v.length, NaN);
    if (!v.length || p <= 0) return out;
    var k = 2 / (p + 1), seed = 0, n = 0;
    for (var i = 0; i < v.length; i++) {
      var x = num(v[i]);
      if (!isFinite(x)) continue;
      if (n < p) { seed += x; n++; if (n === p) out[i] = seed / p; }
      else out[i] = x * k + out[i - 1] * (1 - k);
    }
    return out;
  };

  TA.wma = function (v, p) {
    var out = TA.filled(v.length, NaN), den = (p * (p + 1)) / 2;
    for (var i = p - 1; i < v.length; i++) {
      var s = 0;
      for (var j = 0; j < p; j++) s += v[i - j] * (p - j);
      out[i] = s / den;
    }
    return out;
  };

  /* Wilder's smoothing (RMA) */
  TA.rma = function (v, p) {
    var out = TA.filled(v.length, NaN), seed = 0, n = 0;
    for (var i = 0; i < v.length; i++) {
      var x = num(v[i]) || 0;
      if (n < p) { seed += x; n++; if (n === p) out[i] = seed / p; }
      else out[i] = (out[i - 1] * (p - 1) + x) / p;
    }
    return out;
  };

  TA.hma = function (v, p) {
    var half = TA.wma(v, Math.max(2, Math.round(p / 2)));
    var full = TA.wma(v, Math.max(2, p));
    var diff = v.map(function (_, i) { return 2 * half[i] - full[i]; });
    return TA.wma(diff, Math.max(2, Math.round(Math.sqrt(p))));
  };

  /* ------------------------------ momentum --------------------------- */
  TA.roc = function (v, p) {
    var out = TA.filled(v.length, NaN);
    for (var i = p; i < v.length; i++) out[i] = v[i - p] ? ((v[i] - v[i - p]) / v[i - p]) * 100 : NaN;
    return out;
  };

  TA.rsi = function (v, p) {
    p = p || 14;
    var out = TA.filled(v.length, NaN);
    if (v.length <= p) return out;
    var g = 0, l = 0, i;
    for (i = 1; i <= p; i++) {
      var d = v[i] - v[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    g /= p; l /= p;
    out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (i = p + 1; i < v.length; i++) {
      var dd = v[i] - v[i - 1];
      g = (g * (p - 1) + Math.max(dd, 0)) / p;
      l = (l * (p - 1) + Math.max(-dd, 0)) / p;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  };

  TA.macd = function (v, f, s, sig) {
    f = f || 12; s = s || 26; sig = sig || 9;
    var ef = TA.ema(v, f), es = TA.ema(v, s);
    var line = v.map(function (_, i) { return ef[i] - es[i]; });
    var signal = TA.ema(line.slice(s - 1), sig);
    var sigFull = TA.filled(v.length, NaN);
    for (var i = 0; i < signal.length; i++) sigFull[s - 1 + i] = signal[i];
    var hist = line.map(function (x, i) { return isFinite(sigFull[i]) ? x - sigFull[i] : NaN; });
    return { macd: line, signal: sigFull, hist: hist };
  };

  TA.stoch = function (cd, k, d, smooth) {
    k = k || 14; d = d || 3; smooth = smooth || 1;
    var rawK = TA.filled(cd.length, NaN);
    for (var i = k - 1; i < cd.length; i++) {
      var hh = -Infinity, ll = Infinity;
      for (var j = i - k + 1; j <= i; j++) {
        if (cd[j].h > hh) hh = cd[j].h;
        if (cd[j].l < ll) ll = cd[j].l;
      }
      rawK[i] = hh === ll ? 50 : ((cd[i].c - ll) / (hh - ll)) * 100;
    }
    var K = smooth > 1 ? TA.sma(rawK, smooth) : rawK;
    var D = TA.sma(K, d);
    return { k: K, d: D };
  };

  TA.stochRsi = function (v, p) {
    p = p || 14;
    var r = TA.rsi(v, p), out = TA.filled(v.length, NaN);
    for (var i = p * 2 - 1; i < v.length; i++) {
      var hi = -Infinity, lo = Infinity;
      for (var j = i - p + 1; j <= i; j++) {
        if (isFinite(r[j])) { if (r[j] > hi) hi = r[j]; if (r[j] < lo) lo = r[j]; }
      }
      out[i] = hi === lo ? 50 : ((r[i] - lo) / (hi - lo)) * 100;
    }
    return out;
  };

  TA.willr = function (cd, p) {
    p = p || 14;
    var out = TA.filled(cd.length, NaN);
    for (var i = p - 1; i < cd.length; i++) {
      var hh = -Infinity, ll = Infinity;
      for (var j = i - p + 1; j <= i; j++) { hh = Math.max(hh, cd[j].h); ll = Math.min(ll, cd[j].l); }
      out[i] = hh === ll ? -50 : ((hh - cd[i].c) / (hh - ll)) * -100;
    }
    return out;
  };

  TA.cci = function (cd, p) {
    p = p || 20;
    var tp = cd.map(function (x) { return (x.h + x.l + x.c) / 3; });
    var ma = TA.sma(tp, p), out = TA.filled(cd.length, NaN);
    for (var i = p - 1; i < cd.length; i++) {
      var md = 0;
      for (var j = i - p + 1; j <= i; j++) md += Math.abs(tp[j] - ma[i]);
      md /= p;
      out[i] = md ? (tp[i] - ma[i]) / (0.015 * md) : 0;
    }
    return out;
  };

  TA.mfi = function (cd, p) {
    p = p || 14;
    var out = TA.filled(cd.length, NaN);
    var tp = cd.map(function (x) { return (x.h + x.l + x.c) / 3; });
    for (var i = p; i < cd.length; i++) {
      var pos = 0, neg = 0;
      for (var j = i - p + 1; j <= i; j++) {
        var mf = tp[j] * (cd[j].v || 0);
        if (tp[j] > tp[j - 1]) pos += mf;
        else if (tp[j] < tp[j - 1]) neg += mf;
      }
      out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
    }
    return out;
  };

  /* ------------------------------ volatility ------------------------- */
  TA.tr = function (cd) {
    var out = TA.filled(cd.length, NaN);
    if (!cd.length) return out;
    out[0] = cd[0].h - cd[0].l;
    for (var i = 1; i < cd.length; i++) {
      out[i] = Math.max(
        cd[i].h - cd[i].l,
        Math.abs(cd[i].h - cd[i - 1].c),
        Math.abs(cd[i].l - cd[i - 1].c)
      );
    }
    return out;
  };

  TA.atr = function (cd, p) { return TA.rma(TA.tr(cd), p || 14); };

  TA.bollinger = function (v, p, k) {
    p = p || 20; k = k || 2;
    var mid = TA.sma(v, p);
    var up = TA.filled(v.length, NaN), lo = TA.filled(v.length, NaN), w = TA.filled(v.length, NaN);
    for (var i = p - 1; i < v.length; i++) {
      var s = 0;
      for (var j = i - p + 1; j <= i; j++) s += Math.pow(v[j] - mid[i], 2);
      var sd = Math.sqrt(s / p);
      up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd;
      w[i] = mid[i] ? ((up[i] - lo[i]) / mid[i]) * 100 : 0;
    }
    return { mid: mid, upper: up, lower: lo, width: w, sd: function (i) { return isFinite(up[i]) ? (up[i] - mid[i]) / k : NaN; } };
  };

  TA.keltner = function (cd, p, k) {
    p = p || 20; k = k || 2;
    var mid = TA.ema(cd.map(function (x) { return x.c; }), p);
    var a = TA.atr(cd, p);
    return {
      mid: mid,
      upper: mid.map(function (m, i) { return m + k * a[i]; }),
      lower: mid.map(function (m, i) { return m - k * a[i]; })
    };
  };

  TA.stddev = function (v, p) {
    p = p || 20;
    var out = TA.filled(v.length, NaN), m = TA.sma(v, p);
    for (var i = p - 1; i < v.length; i++) {
      var s = 0;
      for (var j = i - p + 1; j <= i; j++) s += Math.pow(v[j] - m[i], 2);
      out[i] = Math.sqrt(s / p);
    }
    return out;
  };

  TA.supertrend = function (cd, p, m) {
    p = p || 10; m = m || 3;
    var a = TA.atr(cd, p);
    var st = TA.filled(cd.length, NaN), dir = TA.filled(cd.length, 1);
    var upBand = 0, dnBand = 0, prevSt = NaN;
    for (var i = 0; i < cd.length; i++) {
      var hl2 = (cd[i].h + cd[i].l) / 2;
      var ub = hl2 + m * (a[i] || 0), lb = hl2 - m * (a[i] || 0);
      if (i === 0) { upBand = ub; dnBand = lb; st[i] = lb; dir[i] = 1; prevSt = lb; continue; }
      upBand = (ub < upBand || cd[i - 1].c > upBand) ? ub : upBand;
      dnBand = (lb > dnBand || cd[i - 1].c < dnBand) ? lb : dnBand;
      var d = dir[i - 1];
      if (d === 1) d = cd[i].c < dnBand ? -1 : 1;
      else d = cd[i].c > upBand ? 1 : -1;
      dir[i] = d;
      st[i] = d === 1 ? dnBand : upBand;
      prevSt = st[i];
    }
    return { st: st, dir: dir };
  };

  /* ------------------------------ trend / ADX ------------------------ */
  TA.adx = function (cd, p) {
    p = p || 14;
    var n = cd.length;
    var pdm = TA.filled(n, 0), mdm = TA.filled(n, 0), tr = TA.tr(cd);
    for (var i = 1; i < n; i++) {
      var up = cd[i].h - cd[i - 1].h, dn = cd[i - 1].l - cd[i].l;
      pdm[i] = (up > dn && up > 0) ? up : 0;
      mdm[i] = (dn > up && dn > 0) ? dn : 0;
    }
    var atr = TA.rma(tr, p), sp = TA.rma(pdm, p), sm = TA.rma(mdm, p);
    var pdi = TA.filled(n, NaN), mdi = TA.filled(n, NaN), dx = TA.filled(n, NaN);
    for (i = 0; i < n; i++) {
      if (!atr[i]) continue;
      pdi[i] = (sp[i] / atr[i]) * 100;
      mdi[i] = (sm[i] / atr[i]) * 100;
      var sum = pdi[i] + mdi[i];
      dx[i] = sum ? (Math.abs(pdi[i] - mdi[i]) / sum) * 100 : 0;
    }
    return { adx: TA.rma(dx, p), pdi: pdi, mdi: mdi, dx: dx };
  };

  TA.trend = function (cd) {
    var c = cd.map(function (x) { return x.c; });
    var e20 = TA.ema(c, 20), e50 = TA.ema(c, 50), e200 = TA.ema(c, Math.min(200, Math.max(30, Math.floor(c.length / 2))));
    var i = c.length - 1, price = c[i];
    var g20 = TA.pct(price, e20[i]), g50 = TA.pct(price, e50[i]);
    /* slope of ema20 over last 10 bars, in % */
    var back = Math.min(10, i);
    var slope = e20[i - back] ? TA.pct(e20[i], e20[i - back]) : 0;
    var s = 0;
    if (isFinite(e20[i]) && isFinite(e50[i])) {
      if (price > e20[i] && e20[i] > e50[i]) s += 2;
      else if (price > e20[i]) s += 1;
      else if (price < e20[i] && e20[i] < e50[i]) s -= 2;
      else if (price < e20[i]) s -= 1;
    }
    if (slope > 0.35) s += 1; else if (slope < -0.35) s -= 1;
    if (isFinite(e200[i])) { if (price > e200[i]) s += 1; else s -= 1; }
    var dir = s >= 2 ? 'up' : s <= -2 ? 'down' : 'flat';
    return {
      dir: dir, score: TA.clamp(s * 20, -100, 100), strength: Math.abs(s),
      ema20: e20[i], ema50: e50[i], ema200: e200[i], gap20: g20, gap50: g50, slope: slope,
      series: { ema20: e20, ema50: e50, ema200: e200 }
    };
  };

  /* linear-regression slope + r² over the last p closes */
  TA.regression = function (v, p) {
    p = Math.min(p || 20, v.length);
    var n = p, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      var x = i, y = v[v.length - n + i];
      sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y;
    }
    var den = n * sxx - sx * sx;
    var slope = den ? (n * sxy - sx * sy) / den : 0;
    var inter = (sy - slope * sx) / n;
    var r2den = (n * sxx - sx * sx) * (n * syy - sy * sy);
    var r = r2den > 0 ? (n * sxy - sx * sy) / Math.sqrt(r2den) : 0;
    var base = v[v.length - n] || 1;
    return { slope: slope, slopePct: (slope / base) * 100, r2: r * r, intercept: inter, value: inter + slope * (n - 1) };
  };

  /* ------------------------------ volume ----------------------------- */
  TA.obv = function (cd) {
    var out = TA.filled(cd.length, 0);
    for (var i = 1; i < cd.length; i++) {
      var v = cd[i].v || 0;
      out[i] = out[i - 1] + (cd[i].c > cd[i - 1].c ? v : cd[i].c < cd[i - 1].c ? -v : 0);
    }
    return out;
  };

  TA.vwap = function (cd) {
    var out = TA.filled(cd.length, NaN), cv = 0, cp = 0;
    var day = cd.length ? new Date(cd[cd.length - 1].t).getUTCDate() : -1;
    for (var i = 0; i < cd.length; i++) {
      if (new Date(cd[i].t).getUTCDate() !== day) { cv = 0; cp = 0; day = new Date(cd[i].t).getUTCDate(); }
      var tp = (cd[i].h + cd[i].l + cd[i].c) / 3, v = cd[i].v || 0;
      cv += v; cp += tp * v;
      out[i] = cv ? cp / cv : tp;
    }
    return out;
  };

  TA.volumeRatio = function (cd, p) {
    p = p || 20;
    var out = TA.filled(cd.length, NaN);
    for (var i = p; i < cd.length; i++) {
      var s = 0;
      for (var j = i - p; j < i; j++) s += cd[j].v || 0;
      var avg = s / p;
      out[i] = avg ? (cd[i].v || 0) / avg : NaN;
    }
    return out;
  };

  /* ------------------------------ levels ----------------------------- */
  TA.pivots = function (cd) {
    var x = cd[cd.length - 1] || { h: 0, l: 0, c: 0 };
    var p = (x.h + x.l + x.c) / 3;
    return { p: p, r1: 2 * p - x.l, r2: p + (x.h - x.l), r3: x.h + 2 * (p - x.l), s1: 2 * p - x.h, s2: p - (x.h - x.l), s3: x.l - 2 * (x.h - p) };
  };

  /* swing highs / lows: a bar whose high/low beats `lb` bars on both sides */
  TA.swings = function (cd, lb) {
    lb = lb || 3;
    var highs = [], lows = [];
    for (var i = lb; i < cd.length - lb; i++) {
      var isH = true, isL = true;
      for (var j = i - lb; j <= i + lb; j++) {
        if (j === i) continue;
        if (cd[j].h >= cd[i].h) isH = false;
        if (cd[j].l <= cd[i].l) isL = false;
      }
      if (isH) highs.push({ i: i, price: cd[i].h, t: cd[i].t });
      if (isL) lows.push({ i: i, price: cd[i].l, t: cd[i].t });
    }
    return { highs: highs, lows: lows };
  };

  /* cluster swing levels into support / resistance with a touch count */
  TA.levels = function (cd, tolPct) {
    tolPct = tolPct || 0.35;
    var sw = TA.swings(cd, 3), price = cd.length ? cd[cd.length - 1].c : 0;
    var pts = sw.highs.concat(sw.lows).map(function (x) { return x.price; });
    pts.sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var hit = false;
      for (var k = 0; k < out.length; k++) {
        if (Math.abs(out[k].price - pts[i]) / out[k].price * 100 <= tolPct) {
          out[k].price = (out[k].price * out[k].touches + pts[i]) / (out[k].touches + 1);
          out[k].touches++; hit = true; break;
        }
      }
      if (!hit) out.push({ price: pts[i], touches: 1 });
    }
    return out.filter(function (x) { return x.touches >= 2; }).map(function (x) {
      x.type = x.price > price ? 'resistance' : 'support';
      x.dist = TA.pct(x.price, price);
      return x;
    }).sort(function (a, b) { return Math.abs(a.dist) - Math.abs(b.dist); });
  };

  /* highest high / lowest low over the last p bars (excluding the last one) */
  TA.highest = function (cd, p, skipLast) {
    var end = cd.length - (skipLast ? 1 : 0), v = -Infinity;
    for (var i = Math.max(0, end - p); i < end; i++) v = Math.max(v, cd[i].h);
    return v === -Infinity ? NaN : v;
  };
  TA.lowest = function (cd, p, skipLast) {
    var end = cd.length - (skipLast ? 1 : 0), v = Infinity;
    for (var i = Math.max(0, end - p); i < end; i++) v = Math.min(v, cd[i].l);
    return v === Infinity ? NaN : v;
  };

  /* ------------------------------ one-shot snapshot ------------------ */
  /* Everything the UI needs for one symbol/timeframe, in one object. */
  TA.snapshot = function (cd) {
    var c = cd.map(function (x) { return x.c; });
    var i = c.length - 1;
    var bb = TA.bollinger(c, 20, 2);
    var macd = TA.macd(c);
    var st = TA.stoch(cd, 14, 3);
    var adx = TA.adx(cd, 14);
    var atr = TA.atr(cd, 14);
    var vr = TA.volumeRatio(cd, 20);
    var sup = TA.supertrend(cd, 10, 3);
    var obv = TA.obv(cd);
    var srsi = TA.stochRsi(c, 14);
    var will = TA.willr(cd, 14);
    var cci = TA.cci(cd, 20);
    var trend = TA.trend(cd);
    var reg = TA.regression(c, 30);
    var piv = TA.pivots(cd);
    return {
      price: c[i], prev: c[i - 1], changePct: TA.pct(c[i], c[i - 1]),
      rsi: TA.rsi(c, 14), srsi: srsi, willr: will, cci: cci,
      macd: macd, bb: bb, stoch: st, adx: adx, atr: atr, volRatio: vr,
      supertrend: sup, obv: obv, vwap: TA.vwap(cd), trend: trend, reg: reg, pivots: piv,
      levels: TA.levels(cd), swings: TA.swings(cd, 3),
      high20: TA.highest(cd, 20, true), low20: TA.lowest(cd, 20, true),
      high50: TA.highest(cd, 50, true), low50: TA.lowest(cd, 50, true)
    };
  };

  global.TA = TA;
})(typeof window !== 'undefined' ? window : globalThis);
