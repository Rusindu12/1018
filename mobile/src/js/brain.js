/* =====================================================================
   CryptoAI PRO — brain.js
   The signal engine: a small, transparent, trainable linear model over
   technical features + candlestick patterns, plus strategies, a bar-by-bar
   backtester and the AI-explanation clients (OpenRouter / HuggingFace /
   any OpenAI-compatible endpoint). Nothing here touches the DOM.
   ===================================================================== */
(function (global) {
  'use strict';

  var TA = global.TA;
  var Patterns = global.Patterns;
  var B = { version: '5.0.0' };

  /* --------------------------- feature weights ------------------------ */
  /* Every weight is editable and persisted; `train()` moves them by SGD. */
  B.DEFAULT_WEIGHTS = {
    trend: 0.30, momentum: 0.12, macd: 0.14, stoch: 0.08, band: 0.10,
    adx: 0.10, pattern: 0.16, volume: 0.10, supertrend: 0.10,
    regression: 0.06, structure: 0.06, bias: 0.00
  };
  B.FEATURE_LABELS = {
    trend: { en: 'EMA trend', si: 'EMA නැඹුරුව' },
    momentum: { en: 'RSI momentum', si: 'RSI වේගය' },
    macd: { en: 'MACD histogram', si: 'MACD හිස්ටෝග්‍රෑම්' },
    stoch: { en: 'Stochastic', si: 'ස්ටොකාස්ටික්' },
    band: { en: 'Bollinger position', si: 'බොලින්ජර් ස්ථානය' },
    adx: { en: 'ADX / DI direction', si: 'ADX / DI දිශාව' },
    pattern: { en: 'Candlestick patterns', si: 'ඉටිපන්දම් රටා' },
    volume: { en: 'Volume confirmation', si: 'පරිමා තහවුරු කිරීම' },
    supertrend: { en: 'SuperTrend', si: 'සුපර්ට්‍රෙන්ඩ්' },
    regression: { en: '30-bar slope', si: '30-කදුලු බෑවුම' },
    structure: { en: 'Range structure', si: 'පරාස ව්‍යුහය' },
    bias: { en: 'Bias', si: 'පෙරනිමිය' }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function soft(x) { return x / (1 + Math.abs(x)); }          /* R→(-1,1) */
  function fin(x) { return typeof x === 'number' && isFinite(x); }

  /* --------------------------- series context ------------------------- */
  /* One pass over the candles; every later call is O(1) per bar so the
     backtester can walk 300 bars without recomputing indicators. */
  B.context = function (cd) {
    var snap = TA.snapshot(cd);
    snap.pser = Patterns.series(cd);
    snap.hh = []; snap.ll = [];
    for (var i = 0; i < cd.length; i++) {
      var hi = -Infinity, lo = Infinity;
      for (var j = Math.max(0, i - 20); j < i; j++) { hi = Math.max(hi, cd[j].h); lo = Math.min(lo, cd[j].l); }
      snap.hh[i] = hi === -Infinity ? NaN : hi;
      snap.ll[i] = lo === Infinity ? NaN : lo;
    }
    return snap;
  };

  /* --------------------------- feature vector ------------------------- */
  B.featuresAt = function (cd, ctx, i) {
    var f = {}, c = cd[i].c, atr = ctx.atr[i] || c * 0.01 || 1;
    var e20 = ctx.trend.series.ema20[i], e50 = ctx.trend.series.ema50[i], e200 = ctx.trend.series.ema200[i];

    /* trend: price vs EMA20, EMA20 vs EMA50, price vs EMA200 */
    var t = 0, tn = 0;
    if (fin(e20)) { t += c > e20 ? 0.4 : -0.4; tn += 0.4; }
    if (fin(e20) && fin(e50)) { t += e20 > e50 ? 0.3 : -0.3; tn += 0.3; }
    if (fin(e200)) { t += c > e200 ? 0.3 : -0.3; tn += 0.3; }
    f.trend = tn ? clamp(t / tn, -1, 1) : 0;

    f.momentum = fin(ctx.rsi[i]) ? clamp((ctx.rsi[i] - 50) / 50, -1, 1) : 0;

    var mh = ctx.macd.hist[i];
    f.macd = fin(mh) ? soft((mh / atr) * 2.2) : 0;

    var k = ctx.stoch.k[i], d = ctx.stoch.d[i];
    if (fin(k)) {
      var s = (50 - k) / 50 * 0.7;                                   /* stretched → fade */
      if (fin(d)) { if (k > 80 && k < d) s -= 0.3; if (k < 20 && k > d) s += 0.3; }
      f.stoch = clamp(s, -1, 1);
    } else f.stoch = 0;

    var up = ctx.bb.upper[i], lo = ctx.bb.lower[i];
    f.band = (fin(up) && fin(lo) && up > lo) ? clamp((0.5 - (c - lo) / (up - lo)) * 1.6, -1, 1) : 0;

    var adx = ctx.adx.adx[i], pdi = ctx.adx.pdi[i], mdi = ctx.adx.mdi[i];
    f.adx = (fin(adx) && fin(pdi) && fin(mdi)) ? (pdi > mdi ? 1 : -1) * clamp(adx / 40, 0, 1) : 0;

    f.pattern = clamp((ctx.pser[i] || 0) / 100, -1, 1);

    var vr = ctx.volRatio[i], dirC = c >= cd[i].o ? 1 : -1;
    f.volume = fin(vr) ? clamp((vr - 1) / 2, -1, 1) * (0.6 + 0.4 * dirC) : 0;

    f.supertrend = fin(ctx.supertrend.dir[i]) ? ctx.supertrend.dir[i] : 0;

    var sl = ctx.reg && fin(ctx.reg.slopePct) ? ctx.reg.slopePct : 0;
    f.regression = clamp(sl / ((atr / c * 100) * 3 + 1e-9), -1, 1);

    var hh = ctx.hh[i], ll = ctx.ll[i];
    if (fin(hh) && fin(ll) && hh > ll) {
      if (c > hh) f.structure = 1;
      else if (c < ll) f.structure = -1;
      else f.structure = clamp(((c - (hh + ll) / 2) / ((hh - ll) / 2)) * 0.5, -1, 1);
    } else f.structure = 0;

    f.bias = 1;
    return f;
  };

  /* weighted score in -100..100 + per-feature contributions */
  B.scoreFeatures = function (f, w) {
    w = w || B.DEFAULT_WEIGHTS;
    var raw = 0, contrib = [];
    for (var key in f) {
      if (!Object.prototype.hasOwnProperty.call(f, key)) continue;
      var wk = fin(w[key]) ? w[key] : 0;
      var c = f[key] * wk;
      raw += c;
      contrib.push({ id: key, value: f[key], weight: wk, contrib: c });
    }
    contrib.sort(function (a, b) { return Math.abs(b.contrib) - Math.abs(a.contrib); });
    return { raw: raw, score: clamp(raw * 110, -100, 100), contributions: contrib };
  };

  /* ------------------------------ verdicts ---------------------------- */
  B.VERDICTS = [
    { id: 'strongbuy', min: 40, en: 'STRONG BUY', si: 'ප්‍රබල මිලදී ගැනීම', cls: 'buy' },
    { id: 'buy', min: 15, en: 'BUY', si: 'මිලදී ගන්න', cls: 'buy' },
    { id: 'neutral', min: -15, en: 'NEUTRAL', si: 'මධ්‍යස්ථ', cls: 'neutral' },
    { id: 'sell', min: -40, en: 'SELL', si: 'විකුණන්න', cls: 'sell' },
    { id: 'strongsell', min: -Infinity, en: 'STRONG SELL', si: 'ප්‍රබල විකුණුම', cls: 'sell' }
  ];
  B.verdict = function (score) {
    for (var i = 0; i < B.VERDICTS.length; i++) if (score >= B.VERDICTS[i].min) return B.VERDICTS[i];
    return B.VERDICTS[B.VERDICTS.length - 1];
  };

  /* ------------------------------ analysis ---------------------------- */
  B.analyze = function (cd, opts) {
    opts = opts || {};
    if (!cd || cd.length < 30) return { ok: false, reason: 'not-enough-data', bars: cd ? cd.length : 0 };
    var ctx = opts.ctx || B.context(cd);
    var i = cd.length - 1 - (opts.skipLast ? 1 : 0);
    var f = B.featuresAt(cd, ctx, i);
    var w = opts.weights || B.DEFAULT_WEIGHTS;
    var sc = B.scoreFeatures(f, w);
    var v = B.verdict(sc.score);
    var price = cd[i].c, atr = ctx.atr[i] || price * 0.01;
    var pats = Patterns.detect(cd, 3, ctx);

    /* trend block vs mean-reversion block — the two gauges in the UI */
    var trendScore = clamp((f.trend * 0.5 + f.adx * 0.25 + f.supertrend * 0.25) * 100, -100, 100);
    var revertScore = clamp((f.band * 0.4 + f.stoch * 0.35 + f.pattern * 0.25) * 100, -100, 100);

    /* agreement between the strongest features → confidence */
    var sign = sc.score >= 0 ? 1 : -1, agree = 0, tot = 0;
    sc.contributions.slice(0, 6).forEach(function (c) {
      if (Math.abs(c.contrib) < 1e-9) return;
      tot++; if (c.contrib * sign > 0) agree++;
    });
    var conf = clamp(Math.round(42 + Math.abs(sc.score) * 0.32 + (tot ? agree / tot : 0.5) * 26), 1, 99);

    var side = sc.score >= 0 ? 'long' : 'short';
    var mult = { sl: opts.slAtr || 1.5, tp1: opts.tp1Atr || 1.2, tp2: opts.tp2Atr || 2.2, tp3: opts.tp3Atr || 3.4 };
    var plan = side === 'long'
      ? { entry: price, sl: price - mult.sl * atr, tp1: price + mult.tp1 * atr, tp2: price + mult.tp2 * atr, tp3: price + mult.tp3 * atr }
      : { entry: price, sl: price + mult.sl * atr, tp1: price - mult.tp1 * atr, tp2: price - mult.tp2 * atr, tp3: price - mult.tp3 * atr };
    /* snap TP2 / SL to a nearby level when one is closer than the ATR target */
    (ctx.levels || []).slice(0, 8).forEach(function (L) {
      var d = Math.abs(L.price - price);
      if (d < atr * 2.6 && d > atr * 0.35) {
        if (side === 'long' && L.price > price && L.price < plan.tp2) plan.tp2 = L.price, plan.tpNote = L.touches + '× resistance';
        if (side === 'short' && L.price < price && L.price > plan.tp2) plan.tp2 = L.price, plan.tpNote = L.touches + '× support';
      }
    });
    plan.side = side;
    plan.atr = atr;
    plan.atrPct = (atr / price) * 100;
    plan.rr = Math.abs((plan.tp2 - plan.entry) / (plan.entry - plan.sl || 1e-9));

    return {
      ok: true, bars: cd.length, index: i, price: price, prev: cd[i - 1] ? cd[i - 1].c : price,
      ts: cd[i].t, score: sc.score, raw: sc.raw, verdict: v, conf: conf,
      features: f, contributions: sc.contributions, patterns: pats,
      trend: { score: trendScore, label: trendScore >= 25 ? 'uptrend' : trendScore <= -25 ? 'downtrend' : 'range' },
      revert: { score: revertScore, label: revertScore >= 25 ? 'oversold' : revertScore <= -25 ? 'overbought' : 'balanced' },
      plan: plan,
      ind: {
        rsi: ctx.rsi[i], srsi: ctx.srsi[i], macd: ctx.macd.macd[i], macdSig: ctx.macd.signal[i], macdHist: ctx.macd.hist[i],
        ema20: ctx.trend.series.ema20[i], ema50: ctx.trend.series.ema50[i], ema200: ctx.trend.series.ema200[i],
        bbUp: ctx.bb.upper[i], bbMid: ctx.bb.mid[i], bbLow: ctx.bb.lower[i], bbWidth: ctx.bb.width[i],
        stochK: ctx.stoch.k[i], stochD: ctx.stoch.d[i], adx: ctx.adx.adx[i], pdi: ctx.adx.pdi[i], mdi: ctx.adx.mdi[i],
        atr: atr, atrPct: (atr / price) * 100, volRatio: ctx.volRatio[i], obv: TA.last(ctx.obv),
        willr: ctx.willr[i], cci: ctx.cci[i], vwap: ctx.vwap[i], supertrend: ctx.supertrend.st[i], supertrendDir: ctx.supertrend.dir[i],
        trendDir: ctx.trend.dir, slope: ctx.trend.slope, regSlope: ctx.reg.slopePct, regR2: ctx.reg.r2,
        high20: ctx.high20, low20: ctx.low20, high50: ctx.high50, low50: ctx.low50
      },
      ctx: ctx
    };
  };

  /* ------------------------------ reasons ----------------------------- */
  B.reasons = function (sig, lang) {
    lang = lang === 'si' ? 'si' : 'en';
    var out = [], ind = sig.ind, f = sig.features;
    function add(dir, weight, en, si) { out.push({ dir: dir, weight: weight, text: lang === 'si' ? si : en, en: en, si: si }); }
    var p = fmtPct;

    if (Math.abs(f.trend) > 0.25) add(f.trend > 0 ? 1 : -1, Math.abs(f.trend),
      'Price is ' + (f.trend > 0 ? 'above' : 'below') + ' EMA20 and EMA20 is ' + (f.trend > 0 ? 'above' : 'below') + ' EMA50 (' + p(ind.trendDir === 'flat' ? f.trend * 2 : f.trend * 2) + ' structure score)',
      'මිල EMA20 ට ' + (f.trend > 0 ? 'ඉහළින්' : 'පහළින්') + ' සහ EMA20, EMA50 ට ' + (f.trend > 0 ? 'ඉහළින්' : 'පහළින්') + ' තියෙනවා');

    if (fin(ind.rsi)) {
      if (ind.rsi >= 70) add(-1, (ind.rsi - 70) / 30 + 0.4, 'RSI ' + ind.rsi.toFixed(1) + ' — overbought, upside is stretched', 'RSI ' + ind.rsi.toFixed(1) + ' — අධික මිලදී ගැනීම, ඉහළ යාම ඇදී ඇත');
      else if (ind.rsi <= 30) add(1, (30 - ind.rsi) / 30 + 0.4, 'RSI ' + ind.rsi.toFixed(1) + ' — oversold, a bounce is common here', 'RSI ' + ind.rsi.toFixed(1) + ' — අධික විකුණුම, මෙතනින් උද්ධමනයක් සුලභයි');
      else add(ind.rsi > 50 ? 1 : -1, Math.abs(ind.rsi - 50) / 50, 'RSI ' + ind.rsi.toFixed(1) + ' — momentum is ' + (ind.rsi > 50 ? 'with the buyers' : 'with the sellers'), 'RSI ' + ind.rsi.toFixed(1) + ' — වේගය ' + (ind.rsi > 50 ? 'මිලදී ගන්නන් පැත්තේ' : 'විකුණුම්කරුවන් පැත්තේ'));
    }

    if (fin(ind.macdHist)) add(ind.macdHist > 0 ? 1 : -1, Math.min(1, Math.abs(ind.macdHist) / (ind.atr || 1) * 2),
      'MACD histogram is ' + (ind.macdHist > 0 ? 'positive' : 'negative') + ' (' + ind.macdHist.toPrecision(3) + ')',
      'MACD හිස්ටෝග්‍රෑම් ' + (ind.macdHist > 0 ? 'ධන' : 'ඍණ') + ' (' + ind.macdHist.toPrecision(3) + ')');

    if (fin(ind.adx)) {
      if (ind.adx >= 25) add(ind.pdi > ind.mdi ? 1 : -1, Math.min(1, ind.adx / 50),
        'ADX ' + ind.adx.toFixed(0) + ' — a real trend, ' + (ind.pdi > ind.mdi ? '+DI leads' : '−DI leads'),
        'ADX ' + ind.adx.toFixed(0) + ' — සැබෑ නැඹුරුවක්, ' + (ind.pdi > ind.mdi ? '+DI ඉදිරියෙන්' : '−DI ඉදිරියෙන්'));
      else add(0, 0.3, 'ADX ' + ind.adx.toFixed(0) + ' — weak trend, expect chop', 'ADX ' + ind.adx.toFixed(0) + ' — දුර්වල නැඹුරුව, පැදදීම අපේක්ෂා කරන්න');
    }

    if (sig.patterns.length) sig.patterns.slice(0, 3).forEach(function (pt) {
      add(pt.dir, pt.strength / 3, pt.name + ' — ' + pt.note, pt.name + ' — ' + pt.note);
    });

    if (fin(ind.volRatio)) add(ind.volRatio >= 1 ? (sig.price >= sig.prev ? 1 : -1) : 0, Math.min(1, Math.abs(ind.volRatio - 1)),
      'Volume is ' + ind.volRatio.toFixed(2) + '× the 20-bar average',
      'පරිමාව 20-කදුලු සාමාන්‍යය මෙන් ' + ind.volRatio.toFixed(2) + '×');

    if (fin(ind.bbUp) && fin(ind.bbLow)) {
      var pos = (sig.price - ind.bbLow) / (ind.bbUp - ind.bbLow || 1);
      if (pos >= 0.98) add(-1, 0.5, 'Closed on the upper Bollinger band (' + (pos * 100).toFixed(0) + '% of the band)', 'ඉහළ බොලින්ජර් පටිය මත වැසුණා (' + (pos * 100).toFixed(0) + '%)');
      else if (pos <= 0.02) add(1, 0.5, 'Closed on the lower Bollinger band (' + (pos * 100).toFixed(0) + '% of the band)', 'පහළ බොලින්ජර් පටිය මත වැසුණා (' + (pos * 100).toFixed(0) + '%)');
    }

    if (fin(ind.supertrendDir)) add(ind.supertrendDir, 0.6,
      'SuperTrend is ' + (ind.supertrendDir > 0 ? 'bullish' : 'bearish') + ' at ' + ind.supertrend.toPrecision(6),
      'සුපර්ට්‍රෙන්ඩ් ' + (ind.supertrendDir > 0 ? 'ධන' : 'ඍණ') + ' — ' + ind.supertrend.toPrecision(6));

    if (fin(ind.regSlope)) add(ind.regSlope > 0 ? 1 : -1, Math.min(1, Math.abs(ind.regSlope) / 0.6),
      '30-bar regression slope ' + ind.regSlope.toFixed(3) + '%/bar (R² ' + ind.regR2.toFixed(2) + ')',
      '30-කදුලු බෑවුම ' + ind.regSlope.toFixed(3) + '%/කදුල (R² ' + ind.regR2.toFixed(2) + ')');

    out.sort(function (a, b) { return b.weight - a.weight; });
    return out.slice(0, 8);
  };

  function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  B.fmtPct = fmtPct;

  /* ------------------------------ strategies -------------------------- */
  /* Each strategy returns a score in -100..100 for bar i. */
  B.STRATEGIES = [
    {
      id: 'ai', en: 'AI brain (all features)', si: 'AI මොළය (සියලු සාධක)',
      enDesc: 'Weighted vote of 12 technical features + candlestick patterns. The weights are the ones you can train below.',
      siDesc: 'තාක්ෂණික සාධක 12ක් + ඉටිපන්දම් රටා වල බරිත ඡන්දය. පහත පුහුණු කළ හැකි බර මෙයයි.',
      tp: 1.8, sl: 1.0, entry: 22,
      score: function (cd, ctx, i, w) { return B.scoreFeatures(B.featuresAt(cd, ctx, i), w).score; }
    },
    {
      id: 'trend', en: 'EMA trend follow', si: 'EMA නැඹුරු අනුගමනය',
      enDesc: 'Buys when EMA20 crosses above EMA50 and ADX confirms a trend; sells on the mirror. Slow, fewer trades.',
      siDesc: 'EMA20, EMA50 ට ඉහළින් හරස් වූ විට සහ ADX තහවුරු කළ විට මිලදී ගනී. සෙමින්, අඩු වෙළඳාම්.',
      tp: 2.6, sl: 1.3, entry: 30,
      score: function (cd, ctx, i) {
        var e20 = ctx.trend.series.ema20[i], e50 = ctx.trend.series.ema50[i];
        var p20 = ctx.trend.series.ema20[i - 1], p50 = ctx.trend.series.ema50[i - 1];
        if (!fin(e20) || !fin(e50) || !fin(p20) || !fin(p50)) return 0;
        var adx = fin(ctx.adx.adx[i]) ? ctx.adx.adx[i] : 20;
        var s = 0;
        if (e20 > e50) s += 40; else s -= 40;
        if (p20 <= p50 && e20 > e50) s += 25;                     /* fresh cross */
        if (p20 >= p50 && e20 < e50) s -= 25;
        if (cd[i].c > e20) s += 15; else s -= 15;
        s *= clamp(adx / 25, 0.4, 1.6);
        return clamp(s, -100, 100);
      }
    },
    {
      id: 'reversal', en: 'RSI + band reversal', si: 'RSI + පටි ප්‍රතිවර්තන',
      enDesc: 'Fades extremes: oversold near the lower band is a buy, overbought near the upper band is a sell. Best in ranges.',
      siDesc: 'අන්ත ලක්ෂ්‍ය ප්‍රතිවිරුද්ධ කරයි: පහළ පටිය ළඟ අධික විකුණුම මිලදී ගැනීමක්. පරාස තුළ හොඳයි.',
      tp: 1.2, sl: 0.9, entry: 26,
      score: function (cd, ctx, i) {
        var r = ctx.rsi[i], up = ctx.bb.upper[i], lo = ctx.bb.lower[i], k = ctx.stoch.k[i];
        if (!fin(r)) return 0;
        var s = 0;
        if (r <= 32) s += (32 - r) * 2.2;
        if (r >= 68) s -= (r - 68) * 2.2;
        if (fin(up) && fin(lo) && up > lo) {
          var pos = (cd[i].c - lo) / (up - lo);
          if (pos <= 0.05) s += 26; else if (pos >= 0.95) s -= 26;
        }
        if (fin(k)) { if (k < 20) s += 12; else if (k > 80) s -= 12; }
        return clamp(s, -100, 100);
      }
    },
    {
      id: 'breakout', en: '20-bar breakout', si: '20-කදුලු බිඳවැටීම',
      enDesc: 'Enters when price closes past the 20-bar high/low with above-average volume. Catches trends early, gets faked out sometimes.',
      siDesc: 'මිල 20-කදුලු උපරිම/අවම ඉක්මවා සාමාන්‍යයට වඩා වැඩි පරිමාවකින් වැසුණු විට ඇතුළු වේ.',
      tp: 3.0, sl: 1.2, entry: 35,
      score: function (cd, ctx, i) {
        var hh = ctx.hh[i], ll = ctx.ll[i], vr = ctx.volRatio[i];
        if (!fin(hh) || !fin(ll)) return 0;
        var volOk = !fin(vr) || vr >= 1.15;
        if (cd[i].c > hh && volOk) return clamp(45 + (vr - 1) * 25, 0, 100);
        if (cd[i].c < ll && volOk) return clamp(-45 - (vr - 1) * 25, -100, 0);
        return 0;
      }
    },
    {
      id: 'macd', en: 'MACD cross', si: 'MACD හරස්',
      enDesc: 'Classic MACD/signal crossover filtered by the EMA200 side. Medium speed, works on 15m–4h.',
      siDesc: 'සම්භාව්‍ය MACD/සිග්නල් හරස් වීම EMA200 පැත්තෙන් පෙරහන් කෙරේ. 15m–4h සඳහා හොඳයි.',
      tp: 2.0, sl: 1.1, entry: 24,
      score: function (cd, ctx, i) {
        var h = ctx.macd.hist[i], ph = ctx.macd.hist[i - 1], e200 = ctx.trend.series.ema200[i];
        if (!fin(h) || !fin(ph)) return 0;
        var s = clamp(soft((h / (ctx.atr[i] || 1)) * 2.5) * 70, -100, 100);
        if (ph <= 0 && h > 0) s += 18;
        if (ph >= 0 && h < 0) s -= 18;
        if (fin(e200)) s *= cd[i].c > e200 ? 1.1 : 0.9;
        return clamp(s, -100, 100);
      }
    },
    {
      id: 'scalp', en: 'Fast scalp', si: 'වේගවත් ස්කැල්ප්',
      enDesc: 'Stochastic cross + pattern vote with tight TP/SL. Many small trades, fees matter — raise min profit if you use it.',
      siDesc: 'ස්ටොකාස්ටික් හරස් + රටා ඡන්ද, තද TP/SL. කුඩා වෙළඳාම් රාශියක් — ගාස්තු වැදගත්.',
      tp: 0.7, sl: 0.5, entry: 20,
      score: function (cd, ctx, i) {
        var k = ctx.stoch.k[i], d = ctx.stoch.d[i], pk = ctx.stoch.k[i - 1], pd = ctx.stoch.d[i - 1];
        if (!fin(k) || !fin(d) || !fin(pk) || !fin(pd)) return 0;
        var s = 0;
        if (pk <= pd && k > d && k < 40) s += 45;
        if (pk >= pd && k < d && k > 60) s -= 45;
        s += clamp((ctx.pser[i] || 0) * 0.4, -40, 40);
        s += clamp((ctx.rsi[i] - 50) * 0.4, -14, 14);
        return clamp(s, -100, 100);
      }
    }
  ];
  B.strategy = function (id) {
    for (var i = 0; i < B.STRATEGIES.length; i++) if (B.STRATEGIES[i].id === id) return B.STRATEGIES[i];
    return B.STRATEGIES[0];
  };

  B.strategyScore = function (id, cd, ctx, i, weights) {
    return B.strategy(id).score(cd, ctx, i, weights || B.DEFAULT_WEIGHTS);
  };

  /* ------------------------------ backtester -------------------------- */
  /* Walks the candles bar by bar, enters on the NEXT bar's open (no
     look-ahead), exits on TP/SL intrabar, and reports honest statistics. */
  B.backtest = function (cd, opts) {
    opts = opts || {};
    var strat = B.strategy(opts.strategy || 'ai');
    var tp = fin(opts.tp) ? opts.tp : strat.tp;
    var sl = fin(opts.sl) ? opts.sl : strat.sl;
    var entryTh = fin(opts.entry) ? opts.entry : strat.entry;
    var fee = fin(opts.fee) ? opts.fee : 0.1;                       /* % per side */
    var exitMode = opts.exitMode || 'classic';
    var minProfit = fin(opts.minProfit) ? opts.minProfit : 0.01;     /* USDT net */
    var size = fin(opts.size) ? opts.size : 100;                     /* USDT notional */
    var allowShort = !!opts.allowShort;
    var maxHold = fin(opts.maxHold) && opts.maxHold > 0 ? opts.maxHold : Infinity;
    var weights = opts.weights || B.DEFAULT_WEIGHTS;
    if (!cd || cd.length < 60) return { ok: false, reason: 'not-enough-data' };

    var ctx = B.context(cd);
    var trades = [], equity = [0], open = null, eq = 0, peak = 0, maxDD = 0;
    var warm = 35;

    for (var i = warm; i < cd.length - 1; i++) {
      /* manage an open trade on bar i+1 */
      if (open) {
        var bar = cd[i + 1], held = i + 1 - open.i;
        var tpPrice = open.side === 'long' ? open.entry * (1 + tp / 100) : open.entry * (1 - tp / 100);
        var slPrice = open.side === 'long' ? open.entry * (1 - sl / 100) : open.entry * (1 + sl / 100);
        var exit = null, why = '';
        if (open.side === 'long') {
          if (bar.l <= slPrice) { exit = Math.min(slPrice, bar.o); why = 'SL'; }
          else if (bar.h >= tpPrice) { exit = Math.max(tpPrice, bar.o); why = 'TP'; }
        } else {
          if (bar.h >= slPrice) { exit = Math.max(slPrice, bar.o); why = 'SL'; }
          else if (bar.l <= tpPrice) { exit = Math.min(tpPrice, bar.o); why = 'TP'; }
        }
        if (!exit && exitMode === 'minprofit') {
          var net = open.side === 'long' ? (bar.h - open.entry) / open.entry * 100 : (open.entry - bar.l) / open.entry * 100;
          var netUsdt = (net / 100) * size - (fee / 100) * size * 2;
          if (netUsdt >= minProfit) {
            exit = open.side === 'long'
              ? Math.max(bar.o, open.entry * (1 + ((minProfit + (fee / 100) * size * 2) / size) ))
              : Math.min(bar.o, open.entry * (1 - ((minProfit + (fee / 100) * size * 2) / size) ));
            exit = clamp(exit, bar.l, bar.h);
            why = 'MIN';
          }
        }
        if (!exit && held >= maxHold) { exit = bar.c; why = 'TIME'; }
        if (exit) {
          var dirn = open.side === 'long' ? 1 : -1;
          var pnlPct = ((exit - open.entry) / open.entry) * 100 * dirn - fee * 2;
          var pnl = (pnlPct / 100) * size;
          eq += pnl;
          trades.push({
            i: open.i, side: open.side, entry: open.entry, exit: exit, bars: held,
            score: open.score, pnlPct: pnlPct, pnl: pnl, why: why,
            t: cd[open.i].t, tExit: bar.t, symbol: opts.symbol || ''
          });
          equity.push(eq);
          peak = Math.max(peak, eq);
          maxDD = Math.max(maxDD, peak - eq);
          open = null;
          i = i; /* continue scanning from the next bar */
        }
      }
      /* entry check on the close of bar i */
      if (!open) {
        var s = strat.score(cd, ctx, i, weights);
        var side = s >= entryTh ? 'long' : (allowShort && s <= -entryTh ? 'short' : null);
        if (side) {
          open = { i: i + 1, side: side, entry: cd[i + 1].o, score: s };
        }
      }
    }
    /* close a dangling trade at the last close */
    if (open) {
      var lastBar = cd[cd.length - 1];
      var dirn2 = open.side === 'long' ? 1 : -1;
      var pnlPct2 = ((lastBar.c - open.entry) / open.entry) * 100 * dirn2 - fee * 2;
      eq += (pnlPct2 / 100) * size;
      trades.push({
        i: open.i, side: open.side, entry: open.entry, exit: lastBar.c, bars: cd.length - 1 - open.i,
        score: open.score, pnlPct: pnlPct2, pnl: (pnlPct2 / 100) * size, why: 'END', t: cd[open.i].t, symbol: opts.symbol || ''
      });
      equity.push(eq);
    }

    var wins = trades.filter(function (t) { return t.pnl > 0; });
    var losses = trades.filter(function (t) { return t.pnl <= 0; });
    var grossWin = wins.reduce(function (a, t) { return a + t.pnl; }, 0);
    var grossLoss = Math.abs(losses.reduce(function (a, t) { return a + t.pnl; }, 0));
    var net = trades.reduce(function (a, t) { return a + t.pnl; }, 0);
    return {
      ok: true, strategy: strat.id, bars: cd.length, tp: tp, sl: sl, entry: entryTh, fee: fee, size: size,
      trades: trades.length, wins: wins.length, losses: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      net: net, netPct: (net / size) * 100,
      profitFactor: grossLoss ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? -grossLoss / losses.length : 0,
      expectancy: trades.length ? net / trades.length : 0,
      maxDD: maxDD, equity: equity, list: trades.slice(-40).reverse(), all: trades
    };
  };

  /* ------------------------------ training ---------------------------- */
  /* Logistic regression by SGD on forward returns, with a held-out tail so
     we only keep weights that actually improve out-of-sample accuracy. */
  B.train = function (cd, opts) {
    opts = opts || {};
    var horizon = opts.horizon || 12;
    var epochs = opts.epochs || 80;
    var lr = opts.lr || 0.06;
    var fee = fin(opts.fee) ? opts.fee : 0.1;
    var start = opts.weights || B.DEFAULT_WEIGHTS;
    if (!cd || cd.length < 120) return { ok: false, reason: 'not-enough-data', bars: cd ? cd.length : 0 };

    var ctx = B.context(cd);
    var keys = Object.keys(B.DEFAULT_WEIGHTS);
    var X = [], Y = [];
    for (var i = 40; i < cd.length - horizon; i++) {
      var fwd = ((cd[i + horizon].c - cd[i + 1].o) / cd[i + 1].o) * 100 - fee * 2;
      X.push(B.featuresAt(cd, ctx, i));
      Y.push(fwd > 0 ? 1 : 0);
    }
    if (X.length < 40) return { ok: false, reason: 'not-enough-samples', samples: X.length };

    var split = Math.floor(X.length * 0.75);
    function accuracy(w, from, to) {
      var ok = 0;
      for (var j = from; j < to; j++) {
        var s = B.scoreFeatures(X[j], w).score;
        var pred = s >= 0 ? 1 : 0;
        if (pred === Y[j]) ok++;
      }
      return to > from ? (ok / (to - from)) * 100 : 0;
    }
    var before = accuracy(start, split, X.length);

    var w = {}; keys.forEach(function (k) { w[k] = start[k]; });
    for (var e = 0; e < epochs; e++) {
      for (var n = 0; n < split; n++) {
        var idx = (n * 7919 + e * 104729) % split;                 /* deterministic shuffle */
        var x = X[idx], y = Y[idx];
        var z = 0; for (var k2 = 0; k2 < keys.length; k2++) z += w[keys[k2]] * x[keys[k2]];
        var p = 1 / (1 + Math.exp(-clamp(z * 2.2, -30, 30)));
        var err = p - y;
        for (var k3 = 0; k3 < keys.length; k3++) {
          var key = keys[k3];
          var reg = key === 'bias' ? 0 : 0.004 * w[key];
          w[key] -= lr * (err * x[key] * 2.2 + reg);
          w[key] = clamp(w[key], -2, 2);
        }
      }
      lr *= 0.995;
    }
    var after = accuracy(w, split, X.length);
    var improved = after > before;
    return {
      ok: true, samples: X.length, train: split, test: X.length - split, horizon: horizon,
      epochs: epochs, before: before, after: after, improved: improved,
      weights: improved ? w : start, delta: after - before
    };
  };

  /* --------------------------- AI explanations ------------------------ */
  /* Offline, deterministic explanation built from the same numbers the UI
     shows — used when no provider is configured or the call fails. */
  B.explain = function (sig, lang) {
    lang = lang === 'si' ? 'si' : 'en';
    var v = sig.verdict, ind = sig.ind, pl = sig.plan;
    var rs = B.reasons(sig, lang);
    var head = lang === 'si'
      ? v.si + ' — ලකුණු ' + sig.score.toFixed(0) + '/100, විශ්වාසය ' + sig.conf + '%.'
      : v.en + ' — score ' + sig.score.toFixed(0) + '/100, confidence ' + sig.conf + '%.';
    var body = rs.slice(0, 4).map(function (r) {
      return (r.dir > 0 ? '▲ ' : r.dir < 0 ? '▼ ' : '● ') + r.text;
    }).join('\n');
    var planTxt = lang === 'si'
      ? '\nසැලැස්ම (' + pl.side + '): ඇතුළුවීම ' + sig.price.toPrecision(6) + ', නවත්වන්න ' + pl.sl.toPrecision(6) +
        ', ඉලක්ක ' + pl.tp1.toPrecision(6) + ' / ' + pl.tp2.toPrecision(6) + ' / ' + pl.tp3.toPrecision(6) +
        '. ATR ' + pl.atrPct.toFixed(2) + '%, අවදානම් අනුපාතය 1:' + pl.rr.toFixed(1) + '.'
      : '\nPlan (' + pl.side + '): entry ' + sig.price.toPrecision(6) + ', stop ' + pl.sl.toPrecision(6) +
        ', targets ' + pl.tp1.toPrecision(6) + ' / ' + pl.tp2.toPrecision(6) + ' / ' + pl.tp3.toPrecision(6) +
        '. ATR ' + pl.atrPct.toFixed(2) + '%, reward:risk 1:' + pl.rr.toFixed(1) + '.';
    var risk = lang === 'si'
      ? '\nඅවදානම: මෙය මූල්‍ය උපදෙස් නොවේ — දර්ශක ගණිතයක් පමණි. රැකියාව අනිවාර්යය.'
      : '\nRisk: this is indicator arithmetic, not financial advice. Never trade money you cannot lose.';
    return head + '\n\n' + body + planTxt + risk;
  };

  B.prompt = function (sig, cd, lang) {
    var ind = sig.ind;
    var rows = cd.slice(-6).map(function (k) {
      return new Date(k.t).toISOString().slice(5, 16).replace('T', ' ') + ' O' + k.o + ' H' + k.h + ' L' + k.l + ' C' + k.c + ' V' + (k.v || 0).toFixed(2);
    }).join('\n');
    return [
      'You are a concise crypto technical analyst. Answer in ' + (lang === 'si' ? 'Sinhala' : 'English') + ', max 90 words, plain text, no markdown, no promises of profit.',
      'Symbol: ' + (sig.symbol || 'n/a') + '  Timeframe: ' + (sig.tf || 'n/a'),
      'Last price: ' + sig.price + '  Engine verdict: ' + sig.verdict.en + ' (' + sig.score.toFixed(1) + '/100, confidence ' + sig.conf + '%)',
      'RSI ' + (ind.rsi || 0).toFixed(1) + ', MACD hist ' + (ind.macdHist || 0).toPrecision(3) + ', ADX ' + (ind.adx || 0).toFixed(1) +
      ', Stoch K ' + (ind.stochK || 0).toFixed(1) + ', ATR ' + (ind.atrPct || 0).toFixed(2) + '%, volume ratio ' + (ind.volRatio || 0).toFixed(2) +
      ', EMA20/50/200 ' + [ind.ema20, ind.ema50, ind.ema200].map(function (x) { return fin(x) ? x.toPrecision(5) : 'n/a'; }).join(' / ') +
      ', SuperTrend ' + (ind.supertrendDir > 0 ? 'bullish' : 'bearish') + ', trend ' + ind.trendDir,
      'Patterns: ' + (sig.patterns.length ? sig.patterns.map(function (p) { return p.name; }).join(', ') : 'none'),
      'ATR plan: ' + sig.plan.side + ' entry ' + sig.plan.entry.toPrecision(6) + ' stop ' + sig.plan.sl.toPrecision(6) +
      ' targets ' + sig.plan.tp1.toPrecision(6) + '/' + sig.plan.tp2.toPrecision(6) + '/' + sig.plan.tp3.toPrecision(6),
      'Last 6 candles:\n' + rows,
      'Explain in 3 short paragraphs: (1) what the market is doing, (2) what would confirm or invalidate the signal, (3) the main risk. End with "Not financial advice."'
    ].join('\n');
  };

  /* Provider clients. In the Android app Capacitor's native HTTP bridge is
     enabled, so CORS does not block these; in a plain browser they may. */
  B.aiExplain = function (cfg, sig, cd, lang) {
    cfg = cfg || {};
    var provider = cfg.provider || 'off';
    if (provider === 'off' || !cfg.key) return Promise.resolve({ ok: false, offline: true, text: B.explain(sig, lang) });
    var prompt = B.prompt(sig, cd, lang);
    var model = cfg.model || 'meta-llama/llama-3.3-70b-instruct:free';
    var req;

    if (provider === 'huggingface') {
      req = fetch('https://api-inference.huggingface.co/models/' + encodeURIComponent(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 320, temperature: 0.35, return_full_text: false } })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
        .then(function (res) {
          if (res.status !== 200) throw new Error((res.json && res.json.error) || 'HTTP ' + res.status);
          var j = res.json;
          var txt = Array.isArray(j) ? (j[0] && (j[0].generated_text || '')) : (j.generated_text || '');
          if (Array.isArray(txt)) txt = txt.map(function (x) { return x.generated_text || ''; }).join('');
          return String(txt || '').trim();
        });
    } else {
      var url = provider === 'custom' && cfg.base ? cfg.base : 'https://openrouter.ai/api/v1/chat/completions';
      var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key };
      if (provider === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/Rusindu12/1018'; headers['X-Title'] = 'CryptoAI PRO'; }
      req = fetch(url, {
        method: 'POST', headers: headers,
        body: JSON.stringify({
          model: model, temperature: 0.35, max_tokens: 420,
          messages: [{ role: 'user', content: prompt }]
        })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
        .then(function (res) {
          if (res.status !== 200) throw new Error((res.json && (res.json.error && (res.json.error.message || res.json.error) || res.json.message)) || 'HTTP ' + res.status);
          var ch = res.json && res.json.choices && res.json.choices[0];
          return String((ch && (ch.message && ch.message.content || ch.text)) || '').trim();
        });
    }

    return req.then(function (text) {
      if (!text) throw new Error('empty response');
      return { ok: true, text: text, provider: provider, model: model };
    }).catch(function (err) {
      return { ok: false, error: String(err && err.message || err), provider: provider, text: B.explain(sig, lang) };
    });
  };

  /* ------------------------- multi-timeframe view --------------------- */
  B.mtfSummary = function (rows) {
    var up = 0, dn = 0, score = 0, w = 0;
    var weights = { '5m': 0.6, '15m': 0.9, '1h': 1.2, '4h': 1.6, '1d': 2.0 };
    rows.forEach(function (r) {
      if (!r || !r.ok) return;
      var k = weights[r.tf] || 1;
      score += r.score * k; w += k;
      if (r.score > 8) up++; else if (r.score < -8) dn++;
    });
    var avg = w ? score / w : 0;
    return {
      avg: avg, up: up, down: dn, total: rows.length,
      align: rows.length ? Math.round((Math.max(up, dn) / rows.length) * 100) : 0,
      label: avg > 25 ? 'strong-up' : avg > 8 ? 'up' : avg < -25 ? 'strong-down' : avg < -8 ? 'down' : 'mixed'
    };
  };

  global.Brain = B;
})(typeof window !== 'undefined' ? window : globalThis);
