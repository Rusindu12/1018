/* =====================================================================
   CryptoAI PRO — app.js
   The whole controller: persistence, exchange adapters, chart rendering,
   signals, paper/live trading, the bot engine, alerts, scan, settings,
   i18n (English + Sinhala) and the boot sequence.
   Load order: i18n.js → ta.js → patterns.js → brain.js → app.js → sysmgmt.js
   ===================================================================== */
(function (global) {
  'use strict';

  var TA = global.TA, Patterns = global.Patterns, Brain = global.Brain, I18N = global.I18N;
  var doc = global.document;
  var APP = { version: '5.0.0', name: 'CryptoAI PRO' };

  /* ------------------------------ dom helpers ------------------------- */
  function $(id) { return doc.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn, opt) {
    if (!el) return;
    if (typeof el.addEventListener !== 'function') {
      /* a lookup returned something that is not an element (window global,
         text node, …) — skip it instead of killing the whole boot */
      try { console.warn('[wire] skipped "' + ev + '" — target is not an element'); } catch (e) { }
      return;
    }
    el.addEventListener(ev, fn, opt || false);
  }
  function txt(el, v) { if (el && el.textContent !== String(v)) el.textContent = v; }
  function html(el, v) { if (el) el.innerHTML = v; }
  function show(el, yes) { if (el) el.style.display = yes ? '' : 'none'; }
  function cls(el, name, yes) { if (el) el.classList[yes ? 'add' : 'remove'](name); }
  function val(id, dflt) { var e = $(id); if (!e) return dflt; var v = e.value; return v === '' || v === null ? dflt : v; }
  function numVal(id, dflt) { var v = parseFloat(val(id, NaN)); return isFinite(v) ? v : dflt; }
  function setVal(id, v) { var e = $(id); if (e && String(e.value) !== String(v)) e.value = v; }

  /* ------------------------------ language ---------------------------- */
  function L(en, si) { return S.lang === 'si' ? (si || en) : en; }
  function t(key, fallback) {
    var d = (I18N && I18N[S.lang]) || {};
    var e = (I18N && I18N.en) || {};
    return d[key] || e[key] || fallback || key;
  }
  APP.L = L; APP.t = t;

  /* ------------------------------ formatting -------------------------- */
  var F = {
    price: function (p) {
      if (!isFinite(p)) return '—';
      var d = TA.step(p);
      return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    usd: function (v, d) {
      if (!isFinite(v)) return '—';
      return v.toLocaleString('en-US', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d });
    },
    pct: function (v, d) {
      if (!isFinite(v)) return '—';
      return (v >= 0 ? '+' : '') + v.toFixed(d === undefined ? 2 : d) + '%';
    },
    qty: function (q) {
      if (!isFinite(q)) return '—';
      var a = Math.abs(q);
      if (a >= 1000) return q.toFixed(2);
      if (a >= 1) return q.toFixed(4);
      return q.toFixed(6);
    },
    compact: function (v) {
      if (!isFinite(v)) return '—';
      var a = Math.abs(v);
      if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
      return v.toFixed(2);
    },
    time: function (ts) {
      var d = new Date(ts);
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    },
    dayTime: function (ts) {
      var d = new Date(ts);
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + F.time(ts);
    },
    ago: function (ts) {
      var s = Math.max(0, (Date.now() - ts) / 1000);
      if (s < 5) return L('now', 'දැන්');
      if (s < 60) return Math.floor(s) + L('s ago', 'තත්පර');
      if (s < 3600) return Math.floor(s / 60) + L('m ago', 'මිනිත්තු');
      if (s < 86400) return Math.floor(s / 3600) + L('h ago', 'පැය');
      return Math.floor(s / 86400) + L('d ago', 'දින');
    },
    dur: function (ms) {
      var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's';
    }
  };
  APP.F = F;

  /* ------------------------------ persistence ------------------------- */
  var STORE_KEY = 'cryptoai.pro.v1';
  var DEFAULTS = {
    lang: 'en', exchange: 'binance', testnet: false, symbol: 'BTC/USDT', tf: '5m', mode: 'paper',
    sort: 'vol', favs: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'],
    settings: { sound: false, haptic: true, tts: false, keep: false },
    keys: { key: '', secret: '' },
    ai: { provider: 'off', key: '', model: 'meta-llama/llama-3.3-70b-instruct:free', base: '' },
    weights: null,
    paper: { cash: 10000, start: 10000, positions: [], orders: [], history: [], equity: [], feePct: 0.1 },
    bot: {
      strat: 'ai', tf: '5m', size: 50, tp: 1.5, sl: 0.8, exitMode: 'classic', minProfit: 0.01, entry: 20,
      dayTarget: 0, maxHold: 0, dca: false, dcaDrop: 3, dcaMax: 1, volGuard: true, volDrop: 5, brakeLoss: 25,
      aiTp: true, symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'], allowShort: false, notify: true, keepAwake: false,
      maxPos: 3, cooldown: 15, dailyLoss: 50, running: false, startedAt: 0, halted: '',
      stats: { trades: 0, wins: 0, losses: 0, pnl: 0, scans: 0, entries: 0, exits: 0, dca: 0 },
      log: []
    },
    cloud: { url: '', token: '' },
    alerts: [],
    inds: { ema: true, bb: false, vol: true, rsi: true },
    sys: { pin: '', locked: false, priorities: {} }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, add) {
    if (!add || typeof add !== 'object') return base;
    Object.keys(add).forEach(function (k) {
      if (add[k] && typeof add[k] === 'object' && !Array.isArray(add[k]) && base[k] && typeof base[k] === 'object') merge(base[k], add[k]);
      else base[k] = add[k];
    });
    return base;
  }

  var S = clone(DEFAULTS);
  S.weights = clone(Brain.DEFAULT_WEIGHTS);
  var saveTimer = null;

  function load() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        merge(S, data);
        if (!S.weights || typeof S.weights !== 'object') S.weights = clone(Brain.DEFAULT_WEIGHTS);
        Object.keys(Brain.DEFAULT_WEIGHTS).forEach(function (k) {
          if (!isFinite(S.weights[k])) S.weights[k] = Brain.DEFAULT_WEIGHTS[k];
        });
      }
    } catch (e) { console.warn('load failed', e); }
    if (!Array.isArray(S.paper.equity) || !S.paper.equity.length) S.paper.equity = [{ t: Date.now(), v: S.paper.start }];
    return S;
  }
  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { global.localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
      catch (e) { console.warn('save failed', e); }
    }, 220);
  }
  APP.S = S; APP.save = save; APP.load = load;

  /* runtime (never persisted) */
  var R = {
    candles: {}, tickers: [], tickerAt: 0, conn: 'off', connMsg: '', lastPrice: NaN, lastAt: 0,
    sig: null, ctx: null, tfData: {}, timers: {}, scanning: false, scanCancel: false,
    wakeLock: null, native: false, busy: false, booted: false, chartHover: -1, mtf: [], cloudState: null,
    latency: [], sys: null, audio: null, lastScan: 0
  };
  APP.R = R;

  /* ------------------------------ feedback ---------------------------- */
  function toast(msg, kind, ms) {
    var box = $('toasts');
    if (!box) return;
    var el = doc.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, ms || 2600);
  }
  APP.toast = toast;

  function buzz(pattern) {
    if (!S.settings.haptic) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern || 12); } catch (e) { }
  }
  function beep(freq, dur, gain) {
    if (!S.settings.sound) return;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!R.audio) R.audio = new AC();
      var ctxA = R.audio;
      if (ctxA.state === 'suspended') ctxA.resume();
      var o = ctxA.createOscillator(), g = ctxA.createGain();
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.value = gain || 0.06;
      o.connect(g); g.connect(ctxA.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + (dur || 0.18));
      o.stop(ctxA.currentTime + (dur || 0.18) + 0.02);
    } catch (e) { }
  }
  function speak(text) {
    if (!S.settings.tts || !global.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(String(text).slice(0, 240));
      u.lang = S.lang === 'si' ? 'si-LK' : 'en-US';
      u.rate = 1.02;
      global.speechSynthesis.cancel();
      global.speechSynthesis.speak(u);
    } catch (e) { }
  }
  function notify(title, body) {
    try {
      if (global.Notification && Notification.permission === 'granted') {
        new Notification(title, { body: body, tag: 'cryptoai-' + Date.now() });
        return;
      }
      if (global.Notification && Notification.permission !== 'denied') Notification.requestPermission();
    } catch (e) { }
    toast(title + ' — ' + body);
  }
  APP.notify = notify; APP.speak = speak; APP.beep = beep; APP.buzz = buzz;

  async function setWake(force) {
    var want = force !== undefined ? force : (S.settings.keep || S.bot.keepAwake || (S.bot.running && S.bot.keep));
    try {
      if (want && !R.wakeLock && navigator.wakeLock) R.wakeLock = await navigator.wakeLock.request('screen');
      else if (!want && R.wakeLock) { await R.wakeLock.release(); R.wakeLock = null; }
      if (R.wakeLock) R.wakeLock.addEventListener('release', function () { R.wakeLock = null; });
    } catch (e) { R.wakeLock = null; }
    return !!R.wakeLock;
  }
  APP.setWake = setWake;

  /* ------------------------------ i18n apply -------------------------- */
  function applyI18n() {
    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'), null);
      if (v !== null) el.textContent = v;
    });
    $$('[data-i18n-opt]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-opt'), null);
      if (v !== null) el.textContent = v;
    });
    var lb = $('langBtn');
    if (lb) lb.textContent = S.lang === 'si' ? 'සිං' : 'EN';
    doc.documentElement.lang = S.lang;
  }
  APP.applyI18n = applyI18n;

  function setLang(lang) {
    S.lang = lang === 'si' ? 'si' : 'en';
    setVal('setLang', S.lang);
    applyI18n();
    save();
    renderAll();
    if (R.sys && R.sys.langChanged) R.sys.langChanged();
  }
  APP.setLang = setLang;

  /* ------------------------------ switches ---------------------------- */
  function bindSwitch(id, get, set) {
    var el = $(id);
    if (!el) return;
    cls(el, 'on', !!get());
    on(el, 'click', function () {
      var v = !el.classList.contains('on');
      cls(el, 'on', v);
      set(v);
      buzz(8);
      save();
    });
  }
  function syncSwitch(id, v) { cls($(id), 'on', !!v); }
  APP.bindSwitch = bindSwitch; APP.syncSwitch = syncSwitch;

  /* ------------------------------ modal helpers ----------------------- */
  function openModal(id) { var m = $(id); if (m) { m.classList.add('on'); buzz(6); } }
  function closeModal(id) { var m = $(id); if (m) m.classList.remove('on'); }
  APP.openModal = openModal; APP.closeModal = closeModal;

  var okCb = null;
  function confirmBox(title, body, cb) {
    txt($('okTitle'), title);
    html($('okBody'), body);
    okCb = cb;
    openModal('okModal');
  }
  APP.confirmBox = confirmBox;

  /* ------------------------------ tabs -------------------------------- */
  function goTab(name) {
    $$('#nav button').forEach(function (b) { cls(b, 'on', b.getAttribute('data-tab') === name); });
    $$('.tab').forEach(function (s) { cls(s, 'on', s.id === 't-' + name); });
    R.tab = name;
    if (name === 'chart') requestAnimationFrame(drawChart);
    if (name === 'sys' && global.SysMgmt) global.SysMgmt.mount($('t-sys'));
    if (name === 'markets') renderMarkets();
    if (name === 'trade') renderTrade();
    if (name === 'bot') renderBot();
    if (name === 'signals') renderSignals();
  }
  APP.goTab = goTab;

  /* ------------------------------ utilities --------------------------- */
  function debounce(fn, ms) {
    var h;
    return function () {
      var a = arguments, self = this;
      clearTimeout(h);
      h = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  APP.debounce = debounce; APP.sleep = sleep; APP.uid = uid; APP.esc = esc; APP.$ = $; APP.$$ = $$;

  /* =====================================================================
     EXCHANGE ADAPTERS — public market data only.
     Every adapter normalises to:  candle {t,o,h,l,c,v}   ticker {sym,last,chg,vol,quoteVol,high,low}
     symbol format inside the app is always "BTC/USDT".
     ===================================================================== */
  var EX = {
    binance: {
      name: 'Binance',
      pub: 'https://data-api.binance.vision',
      signed: 'https://api.binance.com',
      testnet: 'https://testnet.binance.vision',
      tf: { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' },
      pair: function (s) { return s.replace('/', '').toUpperCase(); },
      split: function (p) {
        var quotes = ['USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'TUSD'];
        for (var i = 0; i < quotes.length; i++) if (p.endsWith(quotes[i]) && p.length > quotes[i].length) return p.slice(0, -quotes[i].length) + '/' + quotes[i];
        return p;
      },
      tickers: function () {
        return json(this.pub + '/api/v3/ticker/24hr').then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('bad payload');
          var out = [];
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!/^(USDT|USDC)$/.test((r.symbol || '').slice(-4))) continue;
            var qv = parseFloat(r.quoteVolume);
            if (!isFinite(qv) || qv < 250000) continue;             /* skip dead pairs */
            out.push({
              sym: EX.binance.split(r.symbol), last: parseFloat(r.lastPrice), chg: parseFloat(r.priceChangePercent),
              vol: parseFloat(r.volume), quoteVol: qv, high: parseFloat(r.highPrice), low: parseFloat(r.lowPrice)
            });
          }
          return out;
        });
      },
      candles: function (sym, tf, limit) {
        var url = this.pub + '/api/v3/klines?symbol=' + this.pair(sym) + '&interval=' + (this.tf[tf] || '5m') + '&limit=' + (limit || 300);
        return json(url).then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('bad payload');
          return rows.map(function (k) { return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; });
        });
      },
      price: function (sym) {
        return json(this.pub + '/api/v3/ticker/price?symbol=' + this.pair(sym)).then(function (j) { return parseFloat(j.price); });
      }
    },
    bybit: {
      name: 'Bybit',
      pub: 'https://api.bybit.com',
      tf: { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' },
      pair: function (s) { return s.replace('/', '').toUpperCase(); },
      split: function (p) { return EX.binance.split(p); },
      tickers: function () {
        return json(this.pub + '/v5/market/tickers?category=spot').then(function (j) {
          var list = j && j.result && j.result.list;
          if (!Array.isArray(list)) throw new Error('bad payload');
          var out = [];
          list.forEach(function (r) {
            var qv = parseFloat(r.turnover24h);
            if (!isFinite(qv) || qv < 250000) return;
            out.push({
              sym: EX.binance.split(r.symbol), last: parseFloat(r.lastPrice), chg: parseFloat(r.price24hPcnt) * 100,
              vol: parseFloat(r.volume24h), quoteVol: qv, high: parseFloat(r.highPrice24h), low: parseFloat(r.lowPrice24h)
            });
          });
          return out;
        });
      },
      candles: function (sym, tf, limit) {
        var url = this.pub + '/v5/market/kline?category=spot&symbol=' + this.pair(sym) + '&interval=' + (this.tf[tf] || '5') + '&limit=' + (limit || 300);
        return json(url).then(function (j) {
          var list = j && j.result && j.result.list;
          if (!Array.isArray(list)) throw new Error('bad payload');
          return list.map(function (k) { return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; }).reverse();
        });
      },
      price: function (sym) {
        return json(this.pub + '/v5/market/tickers?category=spot&symbol=' + this.pair(sym))
          .then(function (j) { return parseFloat(j.result.list[0].lastPrice); });
      }
    },
    okx: {
      name: 'OKX',
      pub: 'https://www.okx.com',
      tf: { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' },
      pair: function (s) { return s.replace('/', '-').toUpperCase(); },
      split: function (p) { return p.replace('-', '/'); },
      tickers: function () {
        return json(this.pub + '/api/v5/market/tickers?instType=SPOT').then(function (j) {
          var list = j && j.data;
          if (!Array.isArray(list)) throw new Error('bad payload');
          var out = [];
          list.forEach(function (r) {
            if (!/-USDT$/.test(r.instId)) return;
            var qv = parseFloat(r.volCcy24h) * parseFloat(r.last);
            if (!isFinite(qv) || qv < 250000) return;
            var open = parseFloat(r.open24h), last = parseFloat(r.last);
            out.push({
              sym: EX.okx.split(r.instId), last: last, chg: open ? ((last - open) / open) * 100 : 0,
              vol: parseFloat(r.vol24h), quoteVol: qv, high: parseFloat(r.high24h), low: parseFloat(r.low24h)
            });
          });
          return out;
        });
      },
      candles: function (sym, tf, limit) {
        var url = this.pub + '/api/v5/market/candles?instId=' + this.pair(sym) + '&bar=' + (this.tf[tf] || '5m') + '&limit=' + Math.min(limit || 300, 300);
        return json(url).then(function (j) {
          var list = j && j.data;
          if (!Array.isArray(list)) throw new Error('bad payload');
          return list.map(function (k) { return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; }).reverse();
        });
      },
      price: function (sym) {
        return json(this.pub + '/api/v5/market/ticker?instId=' + this.pair(sym)).then(function (j) { return parseFloat(j.data[0].last); });
      }
    },
    coinbase: {
      name: 'Coinbase',
      pub: 'https://api.exchange.coinbase.com',
      tf: { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 },
      pair: function (s) { return s.replace('/', '-').toUpperCase(); },
      split: function (p) { return p.replace('-', '/'); },
      tickers: function () {
        var self = this;
        return json(this.pub + '/products').then(function (prods) {
          if (!Array.isArray(prods)) throw new Error('bad payload');
          var keep = prods.filter(function (p) { return p.status === 'online' && p.quote_currency === 'USDT' && !p.id.endsWith('-UP') && !p.id.endsWith('-DOWN'); });
          return keep.map(function (p) {
            var open = parseFloat(p.open_24h) || parseFloat(p.price) || 0;
            var last = parseFloat(p.price) || 0;
            return {
              sym: self.split(p.id), last: last, chg: open ? ((last - open) / open) * 100 : 0,
              vol: parseFloat(p.volume_24h) || 0, quoteVol: (parseFloat(p.volume_24h) || 0) * last,
              high: parseFloat(p.high_24h) || last, low: parseFloat(p.low_24h) || last
            };
          }).filter(function (x) { return x.quoteVol > 100000; });
        });
      },
      candles: function (sym, tf, limit) {
        var gran = this.tf[tf] || 300, n = Math.min(limit || 300, 300);
        var end = new Date(), start = new Date(end.getTime() - gran * n * 1000);
        var url = this.pub + '/products/' + this.pair(sym) + '/candles?granularity=' + gran +
          '&start=' + start.toISOString() + '&end=' + end.toISOString();
        return json(url).then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('bad payload');
          return rows.map(function (k) { return { t: k[0] * 1000, o: +k[3], h: +k[2], l: +k[1], c: +k[4], v: +k[5] }; }).reverse();
        });
      },
      price: function (sym) {
        return json(this.pub + '/products/' + this.pair(sym) + '/ticker').then(function (j) { return parseFloat(j.price); });
      }
    },
    kraken: {
      name: 'Kraken',
      pub: 'https://api.kraken.com',
      tf: { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440 },
      pairMap: { BTC: 'XBT', ETH: 'ETH' },
      pair: function (s) {
        var p = s.split('/');
        var base = this.pairMap[p[0]] || p[0];
        var quote = p[1] === 'USD' ? 'USD' : p[1];
        return (base + quote).toUpperCase();
      },
      split: function (p) {
        var s = p.replace(/^XBT/, 'BTC');
        var m = s.match(/^(BTC|ETH|SOL|XRP|DOGE|ADA|LTC|AVAX|LINK|DOT)(USDT|USD)$/);
        return m ? m[1] + '/' + m[2] : s;
      },
      tickers: function () {
        var self = this;
        return json(this.pub + '/0/public/Ticker?pair=' + ['BTCUSDT', 'ETHUSDT', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'LTCUSD', 'AVAXUSD', 'LINKUSD', 'DOTUSD'].join(',')).then(function (j) {
          if (j && j.error && j.error.length) throw new Error(j.error.join(','));
          var res = j && j.result;
          if (!res) throw new Error('bad payload');
          return Object.keys(res).map(function (k) {
            var r = res[k];
            var open = parseFloat(r.o), last = parseFloat(r.c[0]);
            return {
              sym: self.split(k), last: last, chg: open ? ((last - open) / open) * 100 : 0,
              vol: parseFloat(r.v[1]) || 0, quoteVol: (parseFloat(r.v[1]) || 0) * last,
              high: parseFloat(r.h[1]) || last, low: parseFloat(r.l[1]) || last
            };
          });
        });
      },
      candles: function (sym, tf, limit) {
        var url = this.pub + '/0/public/OHLC?pair=' + this.pair(sym) + '&interval=' + (this.tf[tf] || 5);
        return json(url).then(function (j) {
          if (j && j.error && j.error.length) throw new Error(j.error.join(','));
          var res = j && j.result;
          var key = Object.keys(res || {}).filter(function (k) { return k !== 'last'; })[0];
          if (!key) throw new Error('bad payload');
          var rows = res[key].map(function (k) { return { t: k[0] * 1000, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[6] }; });
          return rows.slice(-(limit || 300));
        });
      },
      price: function (sym) {
        return json(this.pub + '/0/public/Ticker?pair=' + this.pair(sym)).then(function (j) {
          var k = Object.keys(j.result)[0];
          return parseFloat(j.result[k].c[0]);
        });
      }
    }
  };
  APP.EX = EX;
  function ex() { return EX[S.exchange] || EX.binance; }

  /* JSON with a timeout; on Android Capacitor's native HTTP bridge is
     enabled (see capacitor.config.json) so CORS never blocks us. */
  function json(url, opt) {
    opt = opt || {};
    /* everything is wrapped so a missing/blocked fetch rejects instead of
       throwing synchronously and taking the caller's promise chain with it */
    return Promise.resolve().then(function () {
      if (typeof fetch !== 'function') throw new Error('fetch unavailable');
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, opt.timeout || 15000);
      return fetch(url, {
        method: opt.method || 'GET',
        headers: opt.headers || undefined,
        body: opt.body || undefined,
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }, function (e) { clearTimeout(to); throw e; });
    });
  }
  APP.json = json;

  /* ------------------------------ demo data --------------------------- */
  /* Deterministic-ish synthetic market so the app is never a blank screen:
     geometric brownian motion with regime shifts and volume clustering. */
  var DEMO_SEED = { 'BTC/USDT': 67250, 'ETH/USDT': 3520, 'SOL/USDT': 172, 'BNB/USDT': 604, 'XRP/USDT': 0.58, 'DOGE/USDT': 0.152 };
  function demoPrice(sym) {
    var t = R.tickers.filter(function (x) { return x.sym === sym; })[0];
    if (t && isFinite(t.last)) return t.last;
    return DEMO_SEED[sym] || (50 + (hash(sym) % 900));
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
  function demoCandles(sym, tf, limit) {
    var stepMs = TF_MS[tf] || 300000;
    var now = Math.floor(Date.now() / stepMs) * stepMs;
    var seed = hash(sym + tf);
    var price = DEMO_SEED[sym] || 100;
    var rnd = mulberry(seed);
    var out = [], drift = 0.00006, vol = 0.0042;
    for (var i = limit - 1; i >= 0; i--) {
      if (rnd() < 0.02) { drift = (rnd() - 0.48) * 0.0009; vol = 0.002 + rnd() * 0.008; }
      var o = price;
      var move = drift + gauss(rnd) * vol;
      var c = Math.max(o * (1 + move), o * 0.5);
      var h = Math.max(o, c) * (1 + Math.abs(gauss(rnd)) * vol * 0.55);
      var l = Math.min(o, c) * (1 - Math.abs(gauss(rnd)) * vol * 0.55);
      var v = (0.6 + rnd() * 1.8) * (1 + Math.abs(move) * 90) * (1000 / Math.max(1, price)) * 12;
      out.push({ t: now - i * stepMs, o: o, h: h, l: l, c: c, v: v });
      price = c;
    }
    return out;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  var TF_MS = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };
  APP.TF_MS = TF_MS;
  APP.demoCandles = demoCandles;

  /* ------------------------------ data layer -------------------------- */
  function cacheKey(sym, tf) { return S.exchange + ':' + sym + ':' + tf; }
  var CACHE_MS = 25000;

  function setCandles(sym, tf, cd, demo) {
    R.candles[cacheKey(sym, tf)] = { cd: cd, at: Date.now(), demo: !!demo };
    if (sym === S.symbol && tf === S.tf) {
      var last = cd[cd.length - 1];
      R.lastPrice = last ? last.c : NaN;
      R.lastAt = Date.now();
    }
  }
  function getCached(sym, tf) {
    var e = R.candles[cacheKey(sym, tf)];
    return e && Date.now() - e.at < CACHE_MS ? e : null;
  }

  function fetchCandles(sym, tf, limit) {
    limit = limit || 300;
    var hit = getCached(sym, tf);
    if (hit) return Promise.resolve(hit);
    var e = ex();
    var t0 = Date.now();
    return e.candles(sym, tf, limit).then(function (cd) {
      if (!cd || cd.length < 30) throw new Error('too few candles');
      R.latency.push(Date.now() - t0); if (R.latency.length > 40) R.latency.shift();
      setConn('live', e.name);
      setCandles(sym, tf, cd, false);
      return { cd: cd, at: Date.now(), demo: false };
    }).catch(function (err) {
      console.warn('candles failed', sym, tf, err && err.message);
      setCandles(sym, tf, demoCandles(sym, tf, limit), true);
      setConn('demo', L('demo data', 'ආදර්ශන දත්ත'));
      return R.candles[cacheKey(sym, tf)];
    });
  }
  APP.fetchCandles = fetchCandles;

  function fetchTickers(force) {
    if (!force && R.tickers.length && Date.now() - R.tickerAt < 30000) return Promise.resolve(R.tickers);
    var e = ex();
    return e.tickers().then(function (rows) {
      if (!rows.length) throw new Error('empty');
      R.tickers = rows;
      R.tickerAt = Date.now();
      setConn('live', e.name);
      return rows;
    }).catch(function (err) {
      console.warn('tickers failed', err && err.message);
      if (!R.tickers.length) R.tickers = demoTickers();
      setConn(R.tickers.length && R.conn !== 'off' ? 'demo' : 'demo', L('demo data', 'ආදර්ශන දත්ත'));
      return R.tickers;
    });
  }
  function demoTickers() {
    var base = [['BTC/USDT', 67250, 1.8], ['ETH/USDT', 3520, 2.4], ['SOL/USDT', 172, -3.1], ['BNB/USDT', 604, 0.6],
    ['XRP/USDT', 0.58, -1.2], ['DOGE/USDT', 0.152, 4.2], ['ADA/USDT', 0.44, -0.8], ['AVAX/USDT', 34.2, 2.9],
    ['LINK/USDT', 17.4, 1.1], ['DOT/USDT', 6.8, -2.2], ['MATIC/USDT', 0.72, 0.4], ['LTC/USDT', 84.5, -0.6],
    ['TRX/USDT', 0.128, 0.9], ['ATOM/USDT', 8.9, -1.7], ['UNI/USDT', 11.2, 3.3], ['NEAR/USDT', 5.6, 2.1]];
    return base.map(function (b, i) {
      var drift = Math.sin(Date.now() / 90000 + i) * 0.6;
      var last = b[1] * (1 + drift / 100);
      return { sym: b[0], last: last, chg: b[2] + drift, vol: last * 1e5, quoteVol: (9 - i * 0.4) * 1e8, high: last * 1.02, low: last * 0.98, demo: true };
    });
  }
  APP.fetchTickers = fetchTickers;

  function setConn(kind, msg) {
    R.conn = kind;
    R.connMsg = msg || '';
    var dot = $('connDot'), t2 = $('connTxt');
    if (dot) { dot.className = 'dot ' + (kind === 'live' ? 'live' : kind === 'demo' ? 'demo' : 'off'); }
    if (t2) t2.textContent = kind === 'live' ? (msg || ex().name) : kind === 'demo' ? L('Demo data', 'ආදර්ශන දත්ත') : L('Offline', 'නොබැඳි');
  }
  APP.setConn = setConn;

  /* =====================================================================
     TICKER STRIP
     ===================================================================== */
  function renderTicker() {
    var track = $('tickTrack');
    if (!track) return;
    var rows = R.tickers.slice().sort(function (a, b) { return b.quoteVol - a.quoteVol; }).slice(0, 14);
    if (!rows.length) { track.innerHTML = '<span class="tk"><b>' + L('Loading market data…', 'වෙළඳපොළ දත්ත පූරණය වෙමින්…') + '</b></span>'; return; }
    var one = rows.map(function (r) {
      var up = r.chg >= 0;
      return '<span class="tk"><b>' + esc(r.sym.replace('/USDT', '')) + '</b> ' + F.price(r.last) +
        ' <span style="color:' + (up ? 'var(--up)' : 'var(--dn)') + '">' + F.pct(r.chg) + '</span></span>';
    }).join('');
    track.innerHTML = one + one;                       /* duplicated so the -50% loop is seamless */
    cls(track, 'stop', false);
  }

  /* =====================================================================
     MARKETS TAB
     ===================================================================== */
  var SORTERS = {
    vol: function (a, b) { return b.quoteVol - a.quoteVol; },
    gain: function (a, b) { return b.chg - a.chg; },
    loss: function (a, b) { return a.chg - b.chg; },
    fav: function (a, b) {
      var fa = S.favs.indexOf(a.sym) >= 0 ? 1 : 0, fb = S.favs.indexOf(b.sym) >= 0 ? 1 : 0;
      return fb - fa || b.quoteVol - a.quoteVol;
    }
  };

  function renderMarkets() {
    var list = $('mList');
    if (!list) return;
    var q = (val('mSearch', '') || '').trim().toUpperCase();
    var rows = R.tickers.slice();
    if (S.sort === 'fav') rows = rows.filter(function (r) { return S.favs.indexOf(r.sym) >= 0; });
    if (q) rows = rows.filter(function (r) { return r.sym.toUpperCase().indexOf(q) >= 0; });
    rows.sort(SORTERS[S.sort] || SORTERS.vol);
    rows = rows.slice(0, 60);

    if (!rows.length) {
      html(list, '<div class="empty">' + (R.tickers.length
        ? L('No market matches that filter', 'මෙම පෙරහනට ගැළපෙන වෙළඳපොළක් නැත')
        : L('Loading markets…', 'වෙළඳපොළ පූරණය වෙමින්…')) + '</div>');
      txt($('mNote'), '');
      return;
    }
    var frag = doc.createDocumentFragment();
    rows.forEach(function (r, idx) {
      var row = doc.createElement('div');
      row.className = 'mrow';
      var fav = S.favs.indexOf(r.sym) >= 0;
      var up = r.chg >= 0;
      row.innerHTML =
        '<span class="star' + (fav ? ' on' : '') + '" data-fav="' + esc(r.sym) + '">' + (fav ? '★' : '☆') + '</span>' +
        '<div class="sym"><b>' + esc(r.sym.split('/')[0]) + '</b><span>' + esc(r.sym.split('/')[1]) + ' · ' + F.compact(r.quoteVol) + '</span></div>' +
        '<canvas data-spark="' + esc(r.sym) + '" width="104" height="52"></canvas>' +
        '<div class="px">' + F.price(r.last) + '</div>' +
        '<div class="chg' + (up ? '' : ' dn') + '">' + F.pct(r.chg) + '</div>';
      row.setAttribute('data-sym', r.sym);
      frag.appendChild(row);
    });
    list.innerHTML = '';
    list.appendChild(frag);

    /* sparklines only from data we actually hold — never invented */
    $$('canvas[data-spark]', list).forEach(function (cv) {
      var sym = cv.getAttribute('data-spark');
      var cd = (R.candles[S.exchange + ':' + sym + ':' + S.tf] || {}).cd;
      if (!cd || cd.length < 12) { cv.style.visibility = 'hidden'; return; }
      cv.style.visibility = 'visible';
      drawSpark(cv, cd.slice(-40));
    });

    txt($('mNote'), rows.length + L(' markets shown · ', ' වෙළඳපොළක් · ') + (R.conn === 'demo'
      ? L('demo data', 'ආදර්ශන දත්ත') : ex().name) + ' · ' + F.ago(R.tickerAt || Date.now()));
  }

  function drawSpark(cv, cd) {
    var dpr = global.devicePixelRatio || 1;
    var w = cv.width / 2, h = cv.height / 2;
    var g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.scale(dpr * (cv.width / (w * dpr)) / 1, 1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.scale(cv.width / w, cv.height / h);
    var closes = cd.map(function (x) { return x.c; });
    var lo = Math.min.apply(null, closes), hi = Math.max.apply(null, closes);
    var up = closes[closes.length - 1] >= closes[0];
    g.strokeStyle = up ? '#0ecb81' : '#f6465d';
    g.lineWidth = 1.4;
    g.beginPath();
    for (var i = 0; i < closes.length; i++) {
      var x = (i / (closes.length - 1)) * w;
      var y = h - 3 - ((closes[i] - lo) / (hi - lo || 1)) * (h - 6);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    g.fillStyle = up ? 'rgba(14,203,129,.14)' : 'rgba(246,70,93,.14)';
    g.fill();
  }

  function setSymbol(sym, opts) {
    if (!sym) return;
    S.symbol = sym;
    save();
    txt($('symName'), sym);
    txt($('ordSym'), sym);
    R.sig = null; R.ctx = null; R.mtf = [];
    if (!opts || opts.load !== false) refresh(true);
  }
  APP.setSymbol = setSymbol;

  function openSymbolSheet() {
    renderSymbolList('');
    openModal('symModal');
    setTimeout(function () { var i = $('symSearch'); if (i) i.focus(); }, 120);
  }
  function renderSymbolList(q) {
    var box = $('symList');
    if (!box) return;
    q = (q || '').trim().toUpperCase();
    var rows = R.tickers.slice().sort(function (a, b) { return b.quoteVol - a.quoteVol; });
    if (q) rows = rows.filter(function (r) { return r.sym.toUpperCase().indexOf(q) >= 0; });
    rows = rows.slice(0, 80);
    if (!rows.length) { html(box, '<div class="empty">' + L('No match', 'ගැළපීමක් නැත') + '</div>'); return; }
    html(box, rows.map(function (r) {
      var fav = S.favs.indexOf(r.sym) >= 0;
      return '<div class="mrow" data-pick="' + esc(r.sym) + '">' +
        '<span class="star' + (fav ? ' on' : '') + '" data-fav="' + esc(r.sym) + '">' + (fav ? '★' : '☆') + '</span>' +
        '<div class="sym"><b>' + esc(r.sym.split('/')[0]) + '</b><span>' + esc(r.sym.split('/')[1]) + '</span></div>' +
        '<div class="px">' + F.price(r.last) + '</div>' +
        '<div class="chg' + (r.chg >= 0 ? '' : ' dn') + '">' + F.pct(r.chg) + '</div></div>';
    }).join(''));
  }

  function toggleFav(sym) {
    var i = S.favs.indexOf(sym);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(sym);
    save();
    renderMarkets();
    if ($('symModal').classList.contains('on')) renderSymbolList(val('symSearch', ''));
    buzz(10);
  }

  /* =====================================================================
     CHART
     ===================================================================== */
  var CH = { pad: { l: 6, r: 58, t: 8, b: 16 }, bar: 7, view: null };

  function sizeCanvas(cv) {
    if (!cv) return null;
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 320;
    var h = cv.clientHeight || 64;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var g = null;
    try { g = cv.getContext('2d'); } catch (e) { g = null; }
    if (!g) return null;                       /* no canvas support → skip drawing */
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, w: w, h: h };
  }

  function drawChart() {
    var cv = $('chart');
    if (!cv) return;
    var entry = R.candles[cacheKey(S.symbol, S.tf)];
    var s = sizeCanvas(cv);
    if (!s) { drawRsi(null, null); renderChartStats(entry || { cd: [] }, R.ctx); return; }
    var g = s.g;
    g.clearRect(0, 0, s.w, s.h);
    if (!entry || !entry.cd || entry.cd.length < 5) {
      g.fillStyle = '#5b6a86'; g.font = '12px system-ui';
      g.fillText(L('Loading chart…', 'ප්‍රස්ථාරය පූරණය වෙමින්…'), 14, s.h / 2);
      drawRsi(null, s);
      return;
    }
    var cd = entry.cd;
    var volH = S.inds.vol ? 40 : 0;
    var plotW = s.w - CH.pad.l - CH.pad.r;
    var plotH = s.h - CH.pad.t - CH.pad.b - volH;
    var n = Math.max(20, Math.min(cd.length, Math.floor(plotW / CH.bar)));
    var view = cd.slice(cd.length - n);
    var bw = plotW / n;
    CH.view = { view: view, bw: bw, plotW: plotW, plotH: plotH, volH: volH, w: s.w, h: s.h, cd: cd, startIdx: cd.length - n };

    /* indicators computed over the FULL series, drawn for the visible slice */
    var ctx = R.ctx && R.ctx.candles === cd ? R.ctx : null;
    if (!ctx) { ctx = Brain.context(cd); ctx.candles = cd; R.ctx = ctx; }
    var off = cd.length - n;

    var lo = Infinity, hi = -Infinity;
    view.forEach(function (k) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; });
    if (S.inds.bb) {
      for (var i = off; i < cd.length; i++) {
        if (isFinite(ctx.bb.upper[i])) hi = Math.max(hi, ctx.bb.upper[i]);
        if (isFinite(ctx.bb.lower[i])) lo = Math.min(lo, ctx.bb.lower[i]);
      }
    }
    var padY = (hi - lo) * 0.06 || hi * 0.01;
    hi += padY; lo -= padY;
    var y = function (p) { return CH.pad.t + plotH - ((p - lo) / (hi - lo || 1)) * plotH; };
    var x = function (i) { return CH.pad.l + i * bw + bw / 2; };
    CH.y = y; CH.x = x; CH.lo = lo; CH.hi = hi;

    /* grid + price axis */
    g.strokeStyle = 'rgba(31,42,66,.75)'; g.lineWidth = 1;
    g.fillStyle = '#5b6a86'; g.font = '9.5px ui-monospace, monospace'; g.textAlign = 'left';
    for (var r = 0; r <= 4; r++) {
      var gy = CH.pad.t + (plotH / 4) * r;
      g.beginPath(); g.moveTo(CH.pad.l, gy); g.lineTo(CH.pad.l + plotW, gy); g.stroke();
      var pv = hi - ((hi - lo) / 4) * r;
      g.fillText(F.price(pv), CH.pad.l + plotW + 5, gy + 3);
    }

    /* bollinger band */
    if (S.inds.bb) {
      g.beginPath();
      for (i = 0; i < n; i++) {
        var ui = ctx.bb.upper[off + i];
        if (!isFinite(ui)) continue;
        if (i === 0) g.moveTo(x(i), y(ui)); else g.lineTo(x(i), y(ui));
      }
      for (i = n - 1; i >= 0; i--) {
        var li = ctx.bb.lower[off + i];
        if (!isFinite(li)) continue;
        g.lineTo(x(i), y(li));
      }
      g.closePath();
      g.fillStyle = 'rgba(56,189,248,.09)'; g.fill();
      g.strokeStyle = 'rgba(56,189,248,.5)'; g.lineWidth = 1; g.stroke();
    }

    /* volume */
    if (volH) {
      var vmax = 0;
      view.forEach(function (k) { vmax = Math.max(vmax, k.v || 0); });
      var vTop = CH.pad.t + plotH + 6;
      view.forEach(function (k, i2) {
        var vh = vmax ? ((k.v || 0) / vmax) * (volH - 8) : 0;
        g.fillStyle = k.c >= k.o ? 'rgba(14,203,129,.35)' : 'rgba(246,70,93,.35)';
        g.fillRect(x(i2) - bw * 0.32, vTop + (volH - 8) - vh, bw * 0.64, vh);
      });
    }

    /* candles */
    view.forEach(function (k, i2) {
      var up = k.c >= k.o;
      var col = up ? '#0ecb81' : '#f6465d';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      var cx = x(i2);
      g.beginPath(); g.moveTo(cx, y(k.h)); g.lineTo(cx, y(k.l)); g.stroke();
      var yo = y(k.o), yc = y(k.c);
      var top = Math.min(yo, yc), hgt = Math.max(1.1, Math.abs(yc - yo));
      var wdt = Math.max(1.4, bw * 0.62);
      if (up) { g.fillRect(cx - wdt / 2, top, wdt, hgt); }
      else { g.fillRect(cx - wdt / 2, top, wdt, hgt); }
    });

    /* EMAs */
    function line(arr, color, width) {
      g.beginPath();
      var started = false;
      for (var j = 0; j < n; j++) {
        var v = arr[off + j];
        if (!isFinite(v)) { started = false; continue; }
        if (!started) { g.moveTo(x(j), y(v)); started = true; } else g.lineTo(x(j), y(v));
      }
      g.strokeStyle = color; g.lineWidth = width || 1.4; g.stroke();
    }
    if (S.inds.ema) {
      line(ctx.trend.series.ema20, '#f0b90b', 1.5);
      line(ctx.trend.series.ema50, '#8b5cf6', 1.5);
    }

    /* trade plan of the current signal */
    if (R.sig && R.sig.ok && R.sig.symbol === S.symbol && R.sig.tf === S.tf) {
      var pl = R.sig.plan;
      [[pl.tp2, 'rgba(14,203,129,.75)', 'TP2'], [pl.sl, 'rgba(246,70,93,.75)', 'SL'], [pl.entry, 'rgba(240,185,11,.55)', 'E']].forEach(function (L2) {
        if (!isFinite(L2[0]) || L2[0] > hi || L2[0] < lo) return;
        var ly = y(L2[0]);
        g.setLineDash([4, 3]); g.strokeStyle = L2[1]; g.lineWidth = 1;
        g.beginPath(); g.moveTo(CH.pad.l, ly); g.lineTo(CH.pad.l + plotW, ly); g.stroke();
        g.setLineDash([]);
        g.fillStyle = L2[1]; g.font = 'bold 9px system-ui';
        g.fillText(L2[2], CH.pad.l + 3, ly - 3);
      });
    }

    /* last price marker */
    var lastP = view[view.length - 1].c;
    if (lastP >= lo && lastP <= hi) {
      g.setLineDash([2, 3]); g.strokeStyle = 'rgba(233,238,251,.45)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(CH.pad.l, y(lastP)); g.lineTo(CH.pad.l + plotW, y(lastP)); g.stroke();
      g.setLineDash([]);
      g.fillStyle = lastP >= view[view.length - 1].o ? '#0ecb81' : '#f6465d';
      g.fillRect(CH.pad.l + plotW + 2, y(lastP) - 7, CH.pad.r - 4, 14);
      g.fillStyle = '#04070d'; g.font = 'bold 9.5px ui-monospace, monospace';
      g.fillText(F.price(lastP), CH.pad.l + plotW + 5, y(lastP) + 3);
    }

    /* crosshair */
    if (R.chartHover >= 0 && R.chartHover < n) drawCrosshair(R.chartHover);

    drawRsi(ctx, s, off, n, x);
    renderChartStats(entry, ctx);
  }

  function drawCrosshair(i) {
    var cv = $('chart');
    if (!cv || !CH.view) return;
    var s = { g: cv.getContext('2d'), w: cv.clientWidth, h: cv.clientHeight };
    var g = s.g, dpr = global.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var k = CH.view.view[i];
    var cx = CH.x(i);
    g.strokeStyle = 'rgba(233,238,251,.28)'; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, CH.pad.t); g.lineTo(cx, CH.pad.t + CH.view.plotH); g.stroke();
    g.setLineDash([]);
    var tip = $('chartTip');
    if (tip && k) {
      tip.style.display = 'block';
      tip.innerHTML = '<b>' + F.dayTime(k.t) + '</b><br>O ' + F.price(k.o) + '<br>H ' + F.price(k.h) +
        '<br>L ' + F.price(k.l) + '<br>C ' + F.price(k.c) + '<br>V ' + F.compact(k.v || 0);
      var tw = tip.offsetWidth || 110;
      tip.style.left = Math.max(4, Math.min(cx + 8, CH.view.w - tw - 4)) + 'px';
      tip.style.top = (CH.pad.t + 4) + 'px';
    }
  }

  function drawRsi(ctx, s, off, n, x) {
    var cv = $('rsiChart');
    if (!cv) return;
    var r = sizeCanvas(cv);
    if (!r) return;
    var g = r.g;
    g.clearRect(0, 0, r.w, r.h);
    if (!S.inds.rsi || !ctx) return;
    var pad = 6, plotW = r.w - CH.pad.l - CH.pad.r, plotH = r.h - pad * 2;
    var yv = function (v) { return pad + plotH - (TA.clamp(v, 0, 100) / 100) * plotH; };
    g.strokeStyle = 'rgba(31,42,66,.9)'; g.lineWidth = 1;
    [30, 50, 70].forEach(function (lv) {
      g.setLineDash(lv === 50 ? [2, 3] : []);
      g.beginPath(); g.moveTo(CH.pad.l, yv(lv)); g.lineTo(CH.pad.l + plotW, yv(lv)); g.stroke();
    });
    g.setLineDash([]);
    g.fillStyle = '#5b6a86'; g.font = '9px ui-monospace, monospace';
    g.fillText('70', CH.pad.l + plotW + 5, yv(70) + 3);
    g.fillText('30', CH.pad.l + plotW + 5, yv(30) + 3);
    g.beginPath();
    var started = false, last = NaN;
    for (var i = 0; i < n; i++) {
      var v = ctx.rsi[off + i];
      if (!isFinite(v)) { started = false; continue; }
      last = v;
      if (!started) { g.moveTo(x(i), yv(v)); started = true; } else g.lineTo(x(i), yv(v));
    }
    g.strokeStyle = last > 70 ? '#f6465d' : last < 30 ? '#0ecb81' : '#38bdf8';
    g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#8394b4'; g.font = 'bold 9.5px system-ui';
    g.fillText('RSI ' + (isFinite(last) ? last.toFixed(1) : '—'), CH.pad.l + 3, pad + 8);
  }

  function renderChartStats(entry, ctx) {
    var box = $('chartStats');
    if (!box) return;
    var cd = (entry && entry.cd) || [];
    if (!cd.length) { box.innerHTML = ''; return; }
    var last = cd[cd.length - 1];
    var chg = TA.pct(last.c, cd[0].c);
    var hi = Math.max.apply(null, cd.map(function (k) { return k.h; }));
    var lo = Math.min.apply(null, cd.map(function (k) { return k.l; }));
    var vol = sum(cd.slice(-20).map(function (k) { return k.v || 0; })) / 20;
    box.innerHTML =
      '<span>' + L('O', 'විවෘත') + ' <b>' + F.price(last.o) + '</b></span>' +
      '<span>' + L('H', 'උපරිම') + ' <b>' + F.price(last.h) + '</b></span>' +
      '<span>' + L('L', 'අවම') + ' <b>' + F.price(last.l) + '</b></span>' +
      '<span>' + L('C', 'වැසුම්') + ' <b>' + F.price(last.c) + '</b></span>' +
      '<span>' + L('Range', 'පරාසය') + ' <b>' + F.price(lo) + '–' + F.price(hi) + '</b></span>' +
      '<span>' + L('Vol(20)', 'පරිමාව(20)') + ' <b>' + F.compact(vol) + '</b></span>' +
      '<span>' + L('ATR', 'ATR') + ' <b>' + ((ctx && ctx.atr[cd.length - 1]) || 0).toFixed(Math.max(2, TA.step(last.c))) + ' (' + (((ctx && ctx.atr[cd.length - 1] / last.c) * 100) || 0).toFixed(2) + '%)</b></span>' +
      '<span>' + cd.length + L(' bars', ' කදුලු') + (entry.demo ? ' · ' + L('demo', 'ආදර්ශන') : '') + '</span>';
    var badge = $('chgBadge');
    if (badge) {
      badge.textContent = F.pct(chg) + ' · ' + S.tf;
      cls(badge, 'dn', chg < 0);
    }
  }

  function chartPointer(ev) {
    if (!CH.view) return;
    var cv = $('chart');
    var rect = cv.getBoundingClientRect();
    var px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    var i = Math.round((px - CH.pad.l - CH.view.bw / 2) / CH.view.bw);
    i = TA.clamp(i, 0, CH.view.view.length - 1);
    R.chartHover = i;
    drawChart();
  }
  function chartLeave() {
    R.chartHover = -1;
    var tip = $('chartTip');
    if (tip) tip.style.display = 'none';
    drawChart();
  }

  /* =====================================================================
     SIGNALS TAB
     ===================================================================== */
  function computeSignal(cd, skipLast) {
    var sig = Brain.analyze(cd, { weights: S.weights, skipLast: skipLast });
    if (sig.ok) { sig.symbol = S.symbol; sig.tf = S.tf; }
    return sig;
  }

  function renderSignals() {
    var entry = R.candles[cacheKey(S.symbol, S.tf)];
    var box = $('sigVerdict');
    if (!entry || !entry.cd) {
      if (box) { box.className = 'verdict neutral'; box.innerHTML = '<div class="v">—</div><div class="small mut">' + L('Loading data…', 'දත්ත පූරණය වෙමින්…') + '</div>'; }
      return;
    }
    var sig = computeSignal(entry.cd, false);
    if (!sig.ok) {
      R.sig = sig;
      if (box) {
        box.className = 'verdict neutral';
        box.innerHTML = '<div class="v">' + L('NEEDS DATA', 'දත්ත ඕනෑ') + '</div><div class="small mut">' +
          L('Only ' + sig.bars + ' bars — 30+ are needed for a fair score', 'කදුලු ' + sig.bars + ' යි — නිවැරදි ලකුණු සඳහා 30+ ඕනෑ') + '</div>';
      }
      return;
    }
    R.sig = sig;
    var v = sig.verdict;

    if (box) {
      box.className = 'verdict ' + v.cls;
      box.innerHTML = '<div class="v" style="color:' + (v.cls === 'buy' ? 'var(--up)' : v.cls === 'sell' ? 'var(--dn)' : 'var(--txt)') + '">' +
        esc(L(v.en, v.si)) + '</div>' +
        '<div class="small mut">' + esc(S.symbol) + ' · ' + S.tf + ' · ' + L('score', 'ලකුණු') + ' <b>' + sig.score.toFixed(1) +
        '</b>/100 · ' + L('confidence', 'විශ්වාසය') + ' <b>' + sig.conf + '%</b> · ' + F.ago(sig.ts) + '</div>';
    }

    /* two blocks: trend-following vs mean-reversion */
    var trendPct = (sig.trend.score + 100) / 2, revPct = (sig.revert.score + 100) / 2;
    var trendLbl = { 'uptrend': L('Uptrend — follow it', 'ඉහළ නැඹුරුව — අනුගමනය කරන්න'), 'downtrend': L('Downtrend — do not catch knives', 'පහළ නැඹුරුව — පිහින අල්ලන්න එපා'), 'range': L('No clear trend — choppy', 'පැහැදිලි නැඹුරුවක් නැත') }[sig.trend.label];
    var revLbl = { 'oversold': L('Stretched down — a bounce is likely', 'පහළට ඇදී ඇත — උද්ධමනයක් ඉඩ ඇත'), 'overbought': L('Stretched up — pullback risk', 'ඉහළට ඇදී ඇත — පසුබෑමේ අවදානම'), 'balanced': L('Neither stretched — no reversal edge', 'දෙපැත්තටම ඇදී නැත') }[sig.revert.label];
    txt($('sigTrendLbl'), L('Trend block', 'නැඹුරු කොටස') + ': ' + sig.trend.score.toFixed(0) + '/100 — ' + trendLbl);
    txt($('sigRevertLbl'), L('Reversion block', 'ප්‍රතිවර්තන කොටස') + ': ' + sig.revert.score.toFixed(0) + '/100 — ' + revLbl);
    var tb = $('sigTrendBar'), rb = $('sigRevertBar');
    if (tb) { tb.style.width = trendPct.toFixed(0) + '%'; tb.style.background = sig.trend.score >= 0 ? 'var(--up)' : 'var(--dn)'; }
    if (rb) { rb.style.width = revPct.toFixed(0) + '%'; rb.style.background = sig.revert.score >= 0 ? 'var(--info)' : 'var(--dn)'; }

    /* why */
    var reasons = Brain.reasons(sig, S.lang);
    html($('sigReasons'), reasons.length ? reasons.map(function (r) {
      var ic = r.dir > 0 ? '▲' : r.dir < 0 ? '▼' : '●';
      var col = r.dir > 0 ? 'var(--up)' : r.dir < 0 ? 'var(--dn)' : 'var(--mut)';
      return '<div class="reason"><span class="ic" style="color:' + col + '">' + ic + '</span><span class="tx">' + esc(r.text) + '</span></div>';
    }).join('') : '<div class="empty">' + L('No strong reason on this bar', 'මෙම කදුලුවේ ප්‍රබල හේතුවක් නැත') + '</div>');
    txt($('sigWhy'), t('sig.why') + ' · ' + reasons.length + (S.lang === 'si' ? ' හේතු' : ' reasons'));

    /* patterns under the blocks title */
    txt($('sigBlocksTitle'), t('sig.blocks') + (sig.patterns.length ? ' · ' + sig.patterns.length + (S.lang === 'si' ? ' රටා' : ' patterns') : ''));

    renderMetrics(sig);
    renderPlan(sig);
    renderMtf();
    renderAiOut();
  }

  function renderMetrics(sig) {
    var ind = sig.ind;
    function m(k, v, colr) { return '<div class="metric"><div class="k">' + esc(k) + '</div><div class="v"' + (colr ? ' style="color:' + colr + '"' : '') + '>' + esc(v) + '</div></div>'; }
    var rsiCol = ind.rsi >= 70 ? 'var(--dn)' : ind.rsi <= 30 ? 'var(--up)' : '';
    var rows = [
      m('RSI 14', isFinite(ind.rsi) ? ind.rsi.toFixed(1) : '—', rsiCol),
      m('Stoch K/D', (isFinite(ind.stochK) ? ind.stochK.toFixed(0) : '—') + ' / ' + (isFinite(ind.stochD) ? ind.stochD.toFixed(0) : '—')),
      m('MACD hist', isFinite(ind.macdHist) ? ind.macdHist.toPrecision(3) : '—', ind.macdHist > 0 ? 'var(--up)' : 'var(--dn)'),
      m('ADX', isFinite(ind.adx) ? ind.adx.toFixed(1) : '—', ind.adx >= 25 ? 'var(--gold)' : ''),
      m('+DI / −DI', (isFinite(ind.pdi) ? ind.pdi.toFixed(0) : '—') + ' / ' + (isFinite(ind.mdi) ? ind.mdi.toFixed(0) : '—')),
      m('ATR %', isFinite(ind.atrPct) ? ind.atrPct.toFixed(2) + '%' : '—'),
      m('EMA20 gap', isFinite(ind.ema20) ? F.pct(TA.pct(sig.price, ind.ema20)) : '—', TA.pct(sig.price, ind.ema20) >= 0 ? 'var(--up)' : 'var(--dn)'),
      m('EMA50', isFinite(ind.ema50) ? F.price(ind.ema50) : '—'),
      m('BB width', isFinite(ind.bbWidth) ? ind.bbWidth.toFixed(2) + '%' : '—'),
      m('Vol ×20', isFinite(ind.volRatio) ? ind.volRatio.toFixed(2) + '×' : '—', ind.volRatio >= 1.5 ? 'var(--gold)' : ''),
      m('SuperTrend', isFinite(ind.supertrendDir) ? (ind.supertrendDir > 0 ? L('BULL', 'ධන') : L('BEAR', 'ඍණ')) : '—', ind.supertrendDir > 0 ? 'var(--up)' : 'var(--dn)'),
      m('VWAP', isFinite(ind.vwap) ? F.price(ind.vwap) : '—'),
      m('CCI', isFinite(ind.cci) ? ind.cci.toFixed(0) : '—'),
      m('Williams %R', isFinite(ind.willr) ? ind.willr.toFixed(0) : '—'),
      m('20-bar high/low', (isFinite(ind.high20) ? F.price(ind.high20) : '—') + ' / ' + (isFinite(ind.low20) ? F.price(ind.low20) : '—'))
    ];
    html($('sigMetrics'), rows.join(''));
  }

  function renderPlan(sig) {
    var pl = sig.plan;
    function lvl(k, v, col) { return '<div class="lvl"><div class="k">' + esc(k) + '</div><div class="v" style="color:' + col + '">' + esc(v) + '</div></div>'; }
    html($('sigLevels'),
      lvl(L('Entry', 'ඇතුළුවීම'), F.price(pl.entry), 'var(--gold)') +
      lvl(L('Stop', 'නවත්වන්න'), F.price(pl.sl), 'var(--dn)') +
      lvl('TP1', F.price(pl.tp1), 'var(--up)') +
      lvl('TP2', F.price(pl.tp2), 'var(--up)') +
      lvl('TP3', F.price(pl.tp3), 'var(--up)') +
      lvl('R:R', '1:' + (isFinite(pl.rr) ? pl.rr.toFixed(2) : '—'), 'var(--info)'));
    txt($('sigLevelsNote'),
      L('ATR(14) ' + pl.atrPct.toFixed(2) + '% of price · plan is a ' + pl.side.toUpperCase() + ' · stop 1.5×ATR, targets 1.2 / 2.2 / 3.4×ATR',
        'ATR(14) මිලෙන් ' + pl.atrPct.toFixed(2) + '% · සැලැස්ම ' + pl.side.toUpperCase() + ' · නැවතුම 1.5×ATR, ඉලක්ක 1.2 / 2.2 / 3.4×ATR') +
      (pl.tpNote ? ' · TP2 ' + L('snapped to a ', '') + pl.tpNote : ''));
  }

  /* --------------------------- multi-timeframe ------------------------- */
  var MTF_TFS = ['5m', '15m', '1h', '4h', '1d'];
  function runMtf() {
    var out = [];
    txt($('mtfNote'), L('Scanning timeframes…', 'කාලරාමු පරීක්ෂා වෙමින්…'));
    var chain = Promise.resolve();
    MTF_TFS.forEach(function (tf) {
      chain = chain.then(function () {
        return fetchCandles(S.symbol, tf, 300).then(function (entry) {
          var sig = Brain.analyze(entry.cd, { weights: S.weights });
          out.push({ tf: tf, ok: sig.ok, score: sig.ok ? sig.score : 0, verdict: sig.ok ? sig.verdict : null, demo: entry.demo, bars: entry.cd.length });
          R.mtf = out.slice();
          renderMtf();
        });
      }).then(function () { return sleep(120); });
    });
    return chain.then(function () {
      var s = Brain.mtfSummary(R.mtf);
      R.mtfSummary = s;
      txt($('mtfNote'), L(
        'Average across timeframes: ' + s.avg.toFixed(1) + '/100 · ' + s.up + ' up, ' + s.down + ' down of ' + s.total + ' · alignment ' + s.align + '%',
        'කාලරාමු හරහා සාමාන්‍යය: ' + s.avg.toFixed(1) + '/100 · ' + s.total + 'න් ' + s.up + 'ක් ඉහළ, ' + s.down + 'ක් පහළ · එකඟතාව ' + s.align + '%') +
        (s.align >= 80 ? (S.lang === 'si' ? ' — ශක්තිමත් එකඟතාවයක්' : ' — strong agreement') : s.align <= 40 ? (S.lang === 'si' ? ' — ඝෝෂාවක්, පරිස්සම්' : ' — noisy, be careful') : ''));
      renderMtf();
    });
  }

  function renderMtf() {
    var box = $('mtfRows');
    if (!box) return;
    if (!R.mtf.length) {
      html(box, '<div class="empty">' + L('Press Refresh to score all timeframes', 'සියලු කාලරාමු ලකුණු කිරීමට Refresh ඔබන්න') + '</div>');
      return;
    }
    html(box, R.mtf.map(function (r) {
      var w = ((r.score + 100) / 2).toFixed(0);
      var col = r.score >= 15 ? 'var(--up)' : r.score <= -15 ? 'var(--dn)' : 'var(--mut)';
      return '<div style="padding:6px 0;border-bottom:1px dashed rgba(31,42,66,.8)">' +
        '<div class="row between"><b style="font-size:12px">' + r.tf + '</b>' +
        '<span class="small" style="color:' + col + ';font-weight:700">' + (r.ok ? r.verdict[S.lang === 'si' ? 'si' : 'en'] : '—') + ' ' + r.score.toFixed(0) + '</span></div>' +
        '<div class="gauge"><i style="width:' + w + '%;background:' + col + '"></i></div></div>';
    }).join(''));
  }

  /* ------------------------------- AI output --------------------------- */
  var AI_CACHE = {};
  function renderAiOut() {
    var box = $('aiOut');
    if (!box) return;
    var key = S.symbol + ':' + S.tf + ':' + S.lang;
    if (AI_CACHE[key]) { box.textContent = AI_CACHE[key]; return; }
    if (!R.sig || !R.sig.ok) { box.textContent = ''; return; }
    box.textContent = Brain.explain(R.sig, S.lang);
  }

  function generateAi() {
    if (!R.sig || !R.sig.ok) { toast(L('Load a chart first', 'මුලින් ප්‍රස්ථාරයක් පූරණය කරන්න'), 'bad'); return; }
    var box = $('aiOut');
    var btn = $('aiBtn');
    if (btn) btn.disabled = true;
    if (box) box.innerHTML = '<span class="spinner"></span> ' + esc(L('Thinking…', 'සිතමින්…'));
    var cfg = { provider: S.ai.provider, key: S.ai.key, model: S.ai.model, base: S.ai.base };
    var cd = (R.candles[cacheKey(S.symbol, S.tf)] || {}).cd || [];
    var t0 = Date.now();
    Brain.aiExplain(cfg, R.sig, cd, S.lang).then(function (res) {
      if (btn) btn.disabled = false;
      var text = res.text || Brain.explain(R.sig, S.lang);
      AI_CACHE[S.symbol + ':' + S.tf + ':' + S.lang] = text;
      if (box) box.textContent = text;
      var meta = (res.ok ? (S.lang === 'si' ? '🤖 ' + res.provider + ' · ' + res.model : '🤖 ' + res.provider + ' · ' + res.model) :
        (res.offline ? L('Built-in rule engine (offline)', 'අන්තර්ගත නීති එන්ජිම (නොබැඳි)') : L('Provider failed — built-in engine used', 'සපයන්නා අසාර්ථකයි — අන්තර්ගත එන්ජිම භාවිතා කළා')));
      meta += ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's';
      if (res.error) meta += ' · ' + res.error;
      var note = $('btOut');
      if (note) note.textContent = meta;
      buzz(14);
    });
  }

  /* ------------------------------- backtest ---------------------------- */
  function runBacktest() {
    var entry = R.candles[cacheKey(S.symbol, S.tf)];
    var out = $('btOut');
    if (!entry || !entry.cd || entry.cd.length < 60) {
      if (out) out.textContent = L('Need 60+ candles to backtest', 'පසු-පරීක්ෂණයට කදුලු 60+ ඕනෑ');
      return;
    }
    if (out) out.innerHTML = '<span class="spinner"></span> ' + esc(L('Backtesting…', 'පසු-පරීක්ෂණය වෙමින්…'));
    setTimeout(function () {
      var bt = Brain.backtest(entry.cd, {
        strategy: S.bot.strat, tp: S.bot.tp, sl: S.bot.sl, entry: S.bot.entry,
        exitMode: S.bot.exitMode, minProfit: S.bot.minProfit, size: S.bot.size,
        allowShort: S.bot.allowShort, maxHold: S.bot.maxHold ? S.bot.maxHold * Math.round(86400000 / (TF_MS[S.tf] || 300000)) : 0,
        weights: S.weights, symbol: S.symbol, fee: S.paper.feePct
      });
      if (!bt.ok) { if (out) out.textContent = L('Not enough data', 'ප්‍රමාණවත් දත්ත නැත'); return; }
      R.lastBt = bt;
      var strat = Brain.strategy(bt.strategy);
      if (out) {
        out.innerHTML =
          '<b>' + esc(L(strat.en, strat.si)) + '</b> · ' + entry.cd.length + L(' bars', ' කදුලු') + ' · ' + S.symbol + ' ' + S.tf + (entry.demo ? ' · ' + L('DEMO data', 'ආදර්ශන දත්ත') : '') + '<br>' +
          L('Trades', 'වෙළඳාම්') + ' <b>' + bt.trades + '</b> · ' +
          L('win rate', 'ජයග්‍රහණ') + ' <b style="color:' + (bt.winRate >= 50 ? 'var(--up)' : 'var(--dn)') + '">' + bt.winRate.toFixed(1) + '%</b> · ' +
          L('net', 'ශුද්ධ') + ' <b style="color:' + (bt.net >= 0 ? 'var(--up)' : 'var(--dn)') + '">' + F.usd(bt.net) + ' USDT (' + F.pct(bt.netPct) + ')</b><br>' +
          L('profit factor', 'ලාභ සාධකය') + ' <b>' + (isFinite(bt.profitFactor) ? bt.profitFactor.toFixed(2) : '∞') + '</b> · ' +
          L('avg win', 'සාම. ලාභ') + ' ' + F.usd(bt.avgWin) + ' · ' + L('avg loss', 'සාම. පාඩු') + ' ' + F.usd(bt.avgLoss) + '<br>' +
          L('max drawdown', 'උපරිම පසුබෑම') + ' <b style="color:var(--dn)">' + F.usd(bt.maxDD) + '</b> · ' +
          L('expectancy/trade', 'අපේක්ෂාව/වෙළඳාම') + ' ' + F.usd(bt.expectancy) + ' · TP ' + bt.tp + '% SL ' + bt.sl + '% ' + L('fees', 'ගාස්තු') + ' ' + bt.fee + '%×2<br>' +
          '<span style="color:var(--dim)">' + esc(L(
            'Simulation on this history only. Past bars never guarantee the next one.',
            'මෙම ඉතිහාසය මත අනුකරණයක් පමණි. පසුගිය කදුලු ඊළඟ කදුල සහතික කරන්නේ නැත.')) + '</span>';
      }
      buzz(16);
    }, 30);
  }

  /* =====================================================================
     ALERTS
     ===================================================================== */
  function openAlertSheet() {
    var p = $('alertPrice');
    if (p && isFinite(R.lastPrice)) p.value = R.lastPrice;
    renderAlerts();
    openModal('alertModal');
  }
  function renderAlerts() {
    var box = $('alertList');
    if (!box) return;
    if (!S.alerts.length) { html(box, '<div class="empty">' + L('No alerts yet', 'තවම ඇඟවීම් නැත') + '</div>'); return; }
    html(box, S.alerts.map(function (a) {
      return '<div class="pos"><div class="hd"><span>' + esc(a.sym) + ' · ' + (a.when === 'above' ? '▲' : '▼') + ' ' + F.price(a.price) + '</span>' +
        '<button class="iconbtn" style="width:26px;height:26px;font-size:11px" data-delalert="' + a.id + '">✕</button></div>' +
        '<div class="tiny dim">' + L('added', 'එකතු කළා') + ' ' + F.ago(a.ts) + ' · ' + esc(a.when === 'above' ? L('rises above', 'ඉහළ ගියොත්') : L('falls below', 'පහළ ගියොත්')) + '</div></div>';
    }).join(''));
  }
  function addAlert() {
    var price = parseFloat(val('alertPrice', NaN));
    if (!isFinite(price) || price <= 0) { toast(L('Enter a valid price', 'වලංගු මිලක් ඇතුළත් කරන්න'), 'bad'); return; }
    S.alerts.push({ id: uid(), sym: S.symbol, price: price, when: val('alertWhen', 'above'), ts: Date.now() });
    save();
    renderAlerts();
    setVal('alertPrice', '');
    toast(L('Alert added for ', '') + S.symbol + ' ' + F.price(price), 'ok');
    beep(1180, 0.12);
  }
  function checkAlerts(price) {
    if (!S.alerts.length || !isFinite(price)) return;
    var left = [];
    S.alerts.forEach(function (a) {
      var hit = a.sym === S.symbol && ((a.when === 'above' && price >= a.price) || (a.when === 'below' && price <= a.price));
      if (hit) {
        var msg = a.sym + ' ' + (a.when === 'above' ? L('rose above', 'ඉහළ ගියා') : L('fell below', 'පහළ ගියා') ) + ' ' + F.price(a.price) + ' → ' + F.price(price);
        notify('🔔 ' + APP.name, msg);
        toast(msg, a.when === 'above' ? 'ok' : 'bad', 4200);
        beep(a.when === 'above' ? 1320 : 620, 0.24, 0.09);
        buzz([18, 60, 18]);
        speak(a.sym + ' ' + (a.when === 'above' ? L('above', 'ඉහළ') : L('below', 'පහළ')) + ' ' + F.price(a.price));
        botLog('warn', '🔔 ' + msg);
      } else left.push(a);
    });
    if (left.length !== S.alerts.length) { S.alerts = left; save(); renderAlerts(); }
  }
  APP.checkAlerts = checkAlerts;

  /* =====================================================================
     SIGNAL SCAN (all markets)
     ===================================================================== */
  var SCAN_LIMIT = 24;
  function startScan() {
    if (R.scanning) return;
    R.scanning = true; R.scanCancel = false;
    openModal('scanModal');
    var bar = $('scanBar'), list = $('scanList'), summary = $('scanSummary');
    if (bar) bar.style.width = '0%';
    if (list) list.innerHTML = '';
    if (summary) summary.textContent = L('Preparing…', 'සූදානම් වෙමින්…');
    var pool = R.tickers.slice().sort(function (a, b) { return b.quoteVol - a.quoteVol; }).slice(0, SCAN_LIMIT);
    if (!pool.length) { R.scanning = false; if (summary) summary.textContent = L('No market data', 'වෙළඳපොළ දත්ත නැත'); return; }
    var results = [], i = 0;
    function step() {
      if (R.scanCancel || i >= pool.length) return finish();
      var sym = pool[i].sym;
      i++;
      if (bar) bar.style.width = ((i / pool.length) * 100).toFixed(0) + '%';
      if (summary) summary.textContent = sym + ' · ' + i + '/' + pool.length;
      fetchCandles(sym, S.tf, 200).then(function (entry) {
        var sig = Brain.analyze(entry.cd, { weights: S.weights });
        if (sig.ok) results.push({ sym: sym, score: sig.score, verdict: sig.verdict, price: sig.price, conf: sig.conf, patterns: sig.patterns.length, demo: entry.demo });
        if (list) {
          html(list, results.slice().sort(function (a, b) { return Math.abs(b.score) - Math.abs(a.score); }).map(function (r) {
            var col = r.score >= 15 ? 'var(--up)' : r.score <= -15 ? 'var(--dn)' : 'var(--mut)';
            return '<div class="pos" data-scansym="' + esc(r.sym) + '"><div class="hd"><span>' + esc(r.sym) + ' <span class="tiny dim">' + F.price(r.price) + '</span></span>' +
              '<span style="color:' + col + '">' + esc(r.verdict[S.lang === 'si' ? 'si' : 'en']) + ' ' + r.score.toFixed(0) + '</span></div>' +
              '<div class="pbar"><span style="width:' + ((r.score + 100) / 2).toFixed(0) + '%;background:' + col + '"></span></div></div>';
          }).join(''));
        }
        return sleep(60);
      }).then(step).catch(function () { setTimeout(step, 60); });
    }
    function finish() {
      R.scanning = false;
      R.lastScan = Date.now();
      var bulls = results.filter(function (r) { return r.score >= 15; }).length;
      var bears = results.filter(function (r) { return r.score <= -15; }).length;
      if (summary) summary.textContent = L(
        results.length + ' scanned · ' + bulls + ' buy-side · ' + bears + ' sell-side',
        results.length + 'ක් පරීක්ෂා කළා · ' + bulls + 'ක් මිලදී ගැනීමේ · ' + bears + 'ක් විකුණුම්');
      txt($('scanInfo'), L('Last scan ', 'අවසන් සෙවීම ') + F.ago(R.lastScan));
      renderMarkets();
      botLog('ai', '🔎 ' + L('scan finished', 'සෙවීම අවසන්') + ': ' + results.length + L(' markets', ' වෙළඳපොළ') + ' · ' + bulls + '↑ ' + bears + '↓');
    }
    step();
  }

  /* =====================================================================
     PRICE BOOK — one place that knows the latest price of every symbol
     ===================================================================== */
  function priceOf(sym) {
    if (sym === S.symbol && isFinite(R.lastPrice)) return R.lastPrice;
    for (var i = 0; i < R.tickers.length; i++) if (R.tickers[i].sym === sym) return R.tickers[i].last;
    var e = R.candles[cacheKey(sym, S.tf)];
    if (e && e.cd.length) return e.cd[e.cd.length - 1].c;
    return NaN;
  }
  APP.priceOf = priceOf;

  /* =====================================================================
     PAPER ENGINE
     ===================================================================== */
  function paperEquity() {
    var v = S.paper.cash;
    S.paper.positions.forEach(function (p) {
      var px = isFinite(p.mark) ? p.mark : priceOf(p.sym);
      if (!isFinite(px)) px = p.entry;
      v += p.side === 'long' ? p.qty * px : p.notional + (p.entry - px) * p.qty;
    });
    return v;
  }
  function posPnl(p) {
    var px = isFinite(p.mark) ? p.mark : priceOf(p.sym);
    if (!isFinite(px)) px = p.entry;
    var gross = p.side === 'long' ? (px - p.entry) * p.qty : (p.entry - px) * p.qty;
    return { px: px, gross: gross, net: gross - (p.feePaid || 0), pct: ((gross / (p.notional || 1)) * 100) };
  }
  function pushEquity() {
    var v = paperEquity();
    var lastEq = S.paper.equity[S.paper.equity.length - 1];
    if (lastEq && Date.now() - lastEq.t < 20000 && Math.abs(lastEq.v - v) < 1e-9) return;
    S.paper.equity.push({ t: Date.now(), v: v });
    if (S.paper.equity.length > 600) S.paper.equity = S.paper.equity.slice(-600);
  }

  function openTrade(side, usdt, opts) {
    opts = opts || {};
    var px = opts.price !== undefined && isFinite(opts.price) ? opts.price : priceOf(S.symbol);
    if (!isFinite(px) || px <= 0) { toast(L('No price available', 'මිලක් ලබා ගත නොහැක'), 'bad'); return null; }
    if (!(usdt > 0)) { toast(L('Enter an amount', 'ප්‍රමාණයක් ඇතුළත් කරන්න'), 'bad'); return null; }
    var fee = (usdt * S.paper.feePct) / 100;
    if (usdt + fee > S.paper.cash) {
      toast(L('Not enough cash — you have ' + F.usd(S.paper.cash) + ' USDT', 'මුදල් ප්‍රමාණවත් නැත — ඔබට ' + F.usd(S.paper.cash) + ' USDT'), 'bad');
      return null;
    }
    var qty = usdt / px;
    S.paper.cash -= (usdt + fee);
    var pos = {
      id: uid(), sym: S.symbol, side: side, qty: qty, entry: px, notional: usdt, ts: Date.now(),
      tp: opts.tp || null, sl: opts.sl || null, feePaid: fee, bot: !!opts.bot, mark: px,
      aiTarget: null, dca: 0, note: opts.note || ''
    };
    S.paper.positions.push(pos);
    pushEquity();
    save();
    var msg = (side === 'long' ? '🟢 BUY ' : '🔴 SELL ') + S.symbol + ' ' + F.qty(qty) + ' @ ' + F.price(px) + ' (' + F.usd(usdt) + ' USDT)';
    if (opts.bot) botLog('ok', msg); else { toast(msg, 'ok'); botLog('ok', msg); }
    beep(side === 'long' ? 980 : 640, 0.14);
    buzz([12, 40, 12]);
    if (S.bot.notify && opts.bot) { notify(APP.name, msg); speak(msg); }
    renderTrade();
    renderBadge();
    return pos;
  }

  function closeTrade(pos, reason, pxOverride) {
    var px = isFinite(pxOverride) ? pxOverride : posPnl(pos).px;
    var pnl = posPnl(pos);
    var gross = pos.side === 'long' ? (px - pos.entry) * pos.qty : (pos.entry - px) * pos.qty;
    var fee = (Math.abs(gross + pos.notional) * S.paper.feePct) / 100;
    var net = gross - fee;
    S.paper.cash += pos.notional + net;
    var i = S.paper.positions.indexOf(pos);
    if (i >= 0) S.paper.positions.splice(i, 1);
    var rec = {
      id: pos.id, sym: pos.sym, side: pos.side, qty: pos.qty, entry: pos.entry, exit: px,
      pnl: net, pnlPct: (net / pos.notional) * 100, ts: pos.ts, closed: Date.now(),
      reason: reason || 'manual', bot: !!pos.bot, holdMs: Date.now() - pos.ts
    };
    S.paper.history.unshift(rec);
    if (S.paper.history.length > 400) S.paper.history.length = 400;
    if (pos.bot) {
      S.bot.stats.trades++;
      S.bot.stats.pnl += net;
      S.bot.stats.exits++;
      if (net > 0) S.bot.stats.wins++; else S.bot.stats.losses++;
    }
    pushEquity();
    save();
    var msg = (net >= 0 ? '✅ ' : '❌ ') + L('Closed', 'වැසුවා') + ' ' + pos.sym + ' ' + pos.side + ' @ ' + F.price(px) +
      ' → ' + (net >= 0 ? '+' : '') + F.usd(net) + ' USDT (' + reason + ')';
    botLog(net >= 0 ? 'ok' : 'bad', msg);
    toast(msg, net >= 0 ? 'ok' : 'bad', 3400);
    beep(net >= 0 ? 1180 : 520, 0.2, 0.08);
    buzz(net >= 0 ? [14, 40, 14] : [40, 60, 40]);
    if (S.bot.notify) { notify(APP.name, msg); speak(pos.sym + ' ' + (net >= 0 ? L('profit', 'ලාභ') : L('loss', 'පාඩු')) + ' ' + F.usd(Math.abs(net))); }
    renderTrade();
    renderBotStats();
    renderBadge();
    return rec;
  }

  /* limit orders */
  function placeLimit(side, usdt, price, opts) {
    if (!isFinite(price) || price <= 0) { toast(L('Enter a limit price', 'සීමා මිලක් ඇතුළත් කරන්න'), 'bad'); return; }
    if (!(usdt > 0)) { toast(L('Enter an amount', 'ප්‍රමාණයක් ඇතුළත් කරන්න'), 'bad'); return; }
    if (usdt > S.paper.cash) { toast(L('Not enough cash', 'මුදල් ප්‍රමාණවත් නැත'), 'bad'); return; }
    S.paper.cash -= usdt;                                  /* reserve */
    S.paper.orders.push({ id: uid(), sym: S.symbol, side: side, usdt: usdt, price: price, ts: Date.now(), tp: opts && opts.tp, sl: opts && opts.sl, bot: !!(opts && opts.bot) });
    save();
    botLog('warn', '⏳ ' + L('Limit order', 'සීමා ඇණවුම') + ' ' + side + ' ' + S.symbol + ' @ ' + F.price(price) + ' (' + F.usd(usdt) + ')');
    toast(L('Limit order placed', 'සීමා ඇණවුම තැබුවා'), 'ok');
    renderTrade(); renderBadge();
  }
  function cancelOrder(id) {
    for (var i = 0; i < S.paper.orders.length; i++) {
      if (S.paper.orders[i].id === id) {
        S.paper.cash += S.paper.orders[i].usdt;
        S.paper.orders.splice(i, 1);
        break;
      }
    }
    save(); renderTrade(); renderBadge();
    toast(L('Order cancelled', 'ඇණවුම අවලංගු කළා'));
  }
  function checkOrders() {
    if (!S.paper.orders.length) return;
    var left = [];
    S.paper.orders.forEach(function (o) {
      var px = priceOf(o.sym);
      var fill = isFinite(px) && ((o.side === 'buy' && px <= o.price) || (o.side === 'sell' && px >= o.price));
      if (fill) {
        var prevSym = S.symbol;
        S.symbol = o.sym;
        openTrade(o.side === 'buy' ? 'long' : 'short', o.usdt, { price: o.price, tp: o.tp, sl: o.sl, bot: o.bot, note: 'limit' });
        S.symbol = prevSym;
        botLog('ok', '⏳→✅ ' + L('limit filled', 'සීමා ඇණවුම සම්පූර්ණයි') + ' ' + o.sym + ' ' + o.side + ' @ ' + F.price(o.price));
      } else left.push(o);
    });
    if (left.length !== S.paper.orders.length) { S.paper.orders = left; save(); renderTrade(); renderBadge(); }
  }

  /* TP / SL / exit-mode management for every open position */
  function managePositions() {
    if (!S.paper.positions.length) return;
    var changed = false;
    S.paper.positions.slice().forEach(function (p) {
      var px = priceOf(p.sym);
      if (!isFinite(px)) return;
      p.mark = px;
      var pnl = posPnl(p);
      var dir = p.side === 'long' ? 1 : -1;
      var move = (px - p.entry) / p.entry * 100 * dir;
      /* AI-adjusted target wins over the original TP when the AI sell-rate chip is on */
      var tp = (p.aiTarget && isFinite(p.aiTarget.tp)) ? p.aiTarget.tp : p.tp;
      var tpHit = isFinite(tp) && move >= tp;
      var slHit = isFinite(p.sl) && move <= -p.sl;
      if (tpHit) { closeTrade(p, 'TP' + (p.aiTarget ? ' (AI)' : ''), px); changed = true; return; }
      if (slHit) { closeTrade(p, 'SL', px); changed = true; return; }
      if (S.bot.exitMode === 'minprofit' && p.bot) {
        var netUsdt = pnl.net;
        if (netUsdt >= S.bot.minProfit) { closeTrade(p, 'MIN-PROFIT', px); changed = true; return; }
      }
      if (S.bot.maxHold > 0 && Date.now() - p.ts > S.bot.maxHold * 86400000) { closeTrade(p, 'MAX-HOLD', px); changed = true; return; }
      /* crash guard: a drop faster than the configured threshold exits longs at once */
      if (S.bot.volGuard && p.side === 'long' && pnl.pct <= -S.bot.volDrop) { closeTrade(p, 'CRASH-GUARD', px); changed = true; }
    });
    if (changed) { save(); renderTrade(); }
    else { renderTradePrices(); }
  }
  APP.managePositions = managePositions;

  /* =====================================================================
     TRADE TAB RENDERING
     ===================================================================== */
  function renderTrade() {
    renderBalance();
    renderOrderForm();
    renderStats();
    renderPositions();
    renderOrders();
    renderHistory();
    renderCalc();
    renderBadge();
  }

  function renderBadge() {
    var n = S.paper.positions.length + S.paper.orders.length;
    var b = $('navBadge');
    if (!b) return;
    b.textContent = n;
    show(b, n > 0);
  }

  function renderBalance() {
    var box = $('balBody');
    if (!box) return;
    var eq = paperEquity();
    var pnl = eq - S.paper.start;
    var open = sum(S.paper.positions.map(function (p) { return posPnl(p).net; }));
    var dayStart = dayAnchor();
    var dayPnl = sum(S.paper.history.filter(function (h) { return h.closed >= dayStart; }).map(function (h) { return h.pnl; }));
    if (S.mode === 'live') {
      html(box, '<div class="row between"><span class="small mut">' + L('Live account', 'සජීවී ගිණුම') + '</span><b>' + esc(ex().name) + (S.testnet ? ' · testnet' : '') + '</b></div>' +
        '<div class="hint mt">' + esc(L(
          'Live orders are signed on this device and sent straight to the exchange. They need your API keys and the Android app — a browser page cannot sign requests (CORS).',
          'සජීවී ඇණවුම් මෙම උපාංගයේ අත්සන් කර කෙලින්ම හුවමාරුවට යැවේ. ඒ සඳහා ඔබේ API යතුරු සහ Android යෙදුම අවශ්‍යයි — බ්‍රවුසර පිටුවකට අත්සන් කළ නොහැක (CORS).')) + '</div>' +
        '<div class="row mt"><span class="chip' + (liveReady() ? ' on' : '') + '">' + (liveReady() ? L('keys ready', 'යතුරු සූදානම්') : L('no keys', 'යතුරු නැත')) + '</span>' +
        '<span class="chip">' + (R.native ? L('native app', 'දේශීය යෙදුම') : L('browser', 'බ්‍රවුසරය')) + '</span></div>');
      return;
    }
    html(box,
      '<div class="grid3">' +
      metric(L('Cash', 'මුදල්'), F.usd(S.paper.cash), '') +
      metric(L('Equity', 'සමස්ත'), F.usd(eq), pnl >= 0 ? 'var(--up)' : 'var(--dn)') +
      metric(L('Open P&L', 'විවෘත P&L'), (open >= 0 ? '+' : '') + F.usd(open), open >= 0 ? 'var(--up)' : 'var(--dn)') +
      '</div>' +
      '<div class="grid3 mt">' +
      metric(L('Total P&L', 'මුළු P&L'), F.pct((pnl / S.paper.start) * 100) + ' · ' + F.usd(pnl), pnl >= 0 ? 'var(--up)' : 'var(--dn)') +
      metric(L('Today', 'අද'), F.usd(dayPnl), dayPnl >= 0 ? 'var(--up)' : 'var(--dn)') +
      metric(L('Positions', 'ස්ථාන'), S.paper.positions.length + (S.paper.orders.length ? ' (+' + S.paper.orders.length + ')' : ''), '') +
      '</div>' +
      '<div class="pbar"><span style="width:' + TA.clamp((eq / (S.paper.start * 1.5)) * 100, 0, 100).toFixed(1) + '%;background:' + (pnl >= 0 ? 'var(--up)' : 'var(--dn)') + '"></span></div>' +
      '<div class="tiny dim mt">' + L('Paper money. Fee ', 'ව්‍යාජ මුදල්. ගාස්තු ') + S.paper.feePct + '% ' + L('per side.', 'පැත්තකට.') + '</div>');
  }
  function metric(k, v, col) { return '<div class="metric"><div class="k">' + esc(k) + '</div><div class="v"' + (col ? ' style="color:' + col + '"' : '') + '>' + esc(v) + '</div></div>'; }
  function dayAnchor() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function renderOrderForm() {
    txt($('ordSym'), S.symbol);
    var px = priceOf(S.symbol);
    txt($('ordLast'), isFinite(px) ? F.price(px) : '—');
    var isLimit = (R.orderType || 'market') === 'limit';
    show($('priceWrap'), isLimit);
    if (isLimit && !$('ordPrice').value && isFinite(px)) setVal('ordPrice', px.toFixed(TA.step(px)));
    /* BUY / SELL estimate buttons */
    var usdt = numVal('ordAmt', 0);
    txt($('buyEst'), usdt > 0 ? F.qty(usdt / (px || 1)) + ' ' + S.symbol.split('/')[0] : '—');
    txt($('sellEst'), usdt > 0 ? F.qty(usdt / (px || 1)) + ' ' + S.symbol.split('/')[0] : '—');
    var tp = numVal('ordTp', 0), sl = numVal('ordSl', 0);
    var note = [];
    if (S.mode === 'live' && !liveReady()) note.push(L('live mode needs API keys in Settings', 'සජීවී ප්‍රකාරයට සැකසුම්වල API යතුරු ඕනෑ'));
    if (S.mode === 'live' && !R.native) note.push(L('the browser cannot sign orders — use the Android app', 'බ්‍රවුසරයට ඇණවුම් අත්සන් කළ නොහැක — Android යෙදුම භාවිතා කරන්න'));
    if (tp && sl && tp < sl) note.push(L('TP is smaller than SL — check the numbers', 'TP, SL ට වඩා කුඩායි — ඉලක්කම් පරීක්ෂා කරන්න'));
    if (isLimit && isFinite(px) && $('ordPrice').value) {
      var lp = parseFloat($('ordPrice').value);
      note.push(lp < px ? L('buy limit below market — it waits for a dip', 'වෙළඳපොළට වඩා පහළ සීමා මිලක් — පහත වැටීමක් බලා සිටී') : L('limit above market — it fills immediately as a market order', 'වෙළඳපොළට වඩා ඉහළ සීමා මිලක් — වහාම සම්පූර්ණ වේ'));
    }
    txt($('ordNote'), note.join(' · '));
    txt($('posTitle'), t('trade.pos') + (S.paper.positions.length ? ' (' + S.paper.positions.length + ')' : ''));
    txt($('ordTitle'), t('trade.order') + (S.mode === 'live' ? ' · LIVE' : ' · PAPER'));
  }

  function renderPositions() {
    var box = $('posList');
    if (!box) return;
    if (!S.paper.positions.length) {
      html(box, '<div class="empty">' + L('No open positions', 'විවෘත ස්ථාන නැත') + '</div>');
      return;
    }
    html(box, '<div class="pos-list-note small mut">' + L('Tap a position to close it at the current price.', 'වත්මන් මිලට වැසීමට ස්ථානයක් තට්ටු කරන්න.') + '</div>' +
      S.paper.positions.map(function (p) {
        var pnl = posPnl(p);
        var col = pnl.net >= 0 ? 'var(--up)' : 'var(--dn)';
        var tp = (p.aiTarget && isFinite(p.aiTarget.tp)) ? p.aiTarget.tp : p.tp;
        var move = (pnl.px - p.entry) / p.entry * 100 * (p.side === 'long' ? 1 : -1);
        var prog = isFinite(tp) && tp > 0 ? TA.clamp((move / tp) * 100, 0, 100) : 0;
        var ai = p.aiTarget ? '<div class="ai-target-panel"><div class="row between"><b class="small">' +
          L('🎯 AI sell target', '🎯 AI විකුණුම් ඉලක්කය') + '</b><span class="small" style="color:' + col + '">' + F.pct(p.aiTarget.tp) + '</span></div>' +
          '<div class="tiny dim">' + esc(p.aiTarget.note || '') + ' · ' + F.ago(p.aiTarget.ts) + '</div>' +
          (p.aiTarget.history && p.aiTarget.history.length ? '<details class="ai-target-history"><summary class="tiny dim">' +
            L('Change history', 'වෙනස් වූ ඉතිහාසය') + ' (' + p.aiTarget.history.length + ')</summary>' +
            p.aiTarget.history.map(function (h) { return '<div class="ai-target-change tiny">' + F.dayTime(h.ts) + ' · ' + F.pct(h.from) + ' → ' + F.pct(h.to) + ' <span class="dim">' + esc(h.why) + '</span></div>'; }).join('') +
            '</details>' : '') + '</div>' : '';
        return '<div class="pos">' +
          '<div class="hd"><span>' + (p.side === 'long' ? '🟢 ' : '🔴 ') + esc(p.sym) + ' <span class="tiny dim">' + (p.bot ? 'BOT' : L('manual', 'අතින්')) + '</span></span>' +
          '<span style="color:' + col + '">' + (pnl.net >= 0 ? '+' : '') + F.usd(pnl.net) + ' (' + F.pct(pnl.pct) + ')</span></div>' +
          '<div class="row between tiny mut mt"><span>' + L('Qty', 'ප්‍රමාණය') + ' ' + F.qty(p.qty) + ' · ' + L('Entry', 'ඇතුළුවීම') + ' ' + F.price(p.entry) + '</span>' +
          '<span>' + L('Mark', 'වත්මන්') + ' ' + F.price(pnl.px) + ' · ' + F.ago(p.ts) + '</span></div>' +
          '<div class="row between tiny mut"><span>TP ' + (isFinite(tp) ? F.pct(tp) : '—') + ' · SL ' + (isFinite(p.sl) ? F.pct(p.sl) : '—') + '</span>' +
          '<span>' + L('Notional', 'වටිනාකම') + ' ' + F.usd(p.notional) + '</span></div>' +
          '<div class="pbar"><span style="width:' + prog.toFixed(0) + '%;background:' + col + '"></span></div>' +
          ai +
          '<div class="row mt" style="gap:6px">' +
          '<button class="btn ghost sm" style="flex:1" data-close-pos="' + p.id + '">' + L('Close now', 'දැන් වසන්න') + '</button>' +
          (isFinite(tp) ? '<button class="btn ghost sm" data-tp-pos="' + p.id + '">TP ' + F.pct(tp) + '</button>' : '') +
          '</div></div>';
      }).join(''));
  }

  /* light-touch price refresh so the list does not rebuild every second */
  function renderTradePrices() {
    if (R.tab !== 'trade' || !S.paper.positions.length) return;
    var rows = $$('#posList .pos');
    rows.forEach(function (row, i) {
      var p = S.paper.positions[i];
      if (!p) return;
      var pnl = posPnl(p);
      var col = pnl.net >= 0 ? 'var(--up)' : 'var(--dn)';
      var span = row.querySelector('.hd span:last-child');
      if (span) { span.style.color = col; span.textContent = (pnl.net >= 0 ? '+' : '') + F.usd(pnl.net) + ' (' + F.pct(pnl.pct) + ')'; }
    });
  }

  function renderOrders() {
    var box = $('ordList');
    if (!box) return;
    if (!S.paper.orders.length) { html(box, '<div class="empty">' + L('No open orders', 'විවෘත ඇණවුම් නැත') + '</div>'); return; }
    html(box, S.paper.orders.map(function (o) {
      var px = priceOf(o.sym);
      var dist = isFinite(px) ? ((o.price - px) / px) * 100 : NaN;
      return '<div class="pos"><div class="hd"><span>' + (o.side === 'buy' ? '🟢 ' : '🔴 ') + esc(o.sym) + ' · ' + L('limit', 'සීමා') + '</span>' +
        '<span>' + F.price(o.price) + '</span></div>' +
        '<div class="row between tiny mut mt"><span>' + F.usd(o.usdt) + ' USDT · ' + (isFinite(dist) ? F.pct(dist) + ' ' + L('away', 'ඈතින්') : '—') + '</span>' +
        '<button class="btn ghost sm" data-cancel="' + o.id + '">' + L('Cancel', 'අවලංගු') + '</button></div></div>';
    }).join(''));
  }

  function renderHistory() {
    var box = $('histList');
    if (!box) return;
    if (!S.paper.history.length) { html(box, '<div class="empty">' + L('No trades closed yet', 'තවම වෙළඳාම් වැසී නැත') + '</div>'); return; }
    html(box, S.paper.history.slice(0, 30).map(function (h) {
      var col = h.pnl >= 0 ? 'var(--up)' : 'var(--dn)';
      return '<div class="pos"><div class="hd"><span>' + (h.side === 'long' ? '🟢' : '🔴') + ' ' + esc(h.sym) + ' <span class="tiny dim">' + esc(h.reason) + (h.bot ? ' · BOT' : '') + '</span></span>' +
        '<span style="color:' + col + '">' + (h.pnl >= 0 ? '+' : '') + F.usd(h.pnl) + '</span></div>' +
        '<div class="row between tiny mut"><span>' + F.price(h.entry) + ' → ' + F.price(h.exit) + '</span><span>' + F.dayTime(h.closed) + ' · ' + F.dur(h.holdMs) + '</span></div></div>';
    }).join(''));
  }

  function renderStats() {
    var box = $('statsBody');
    if (!box) return;
    var h = S.paper.history;
    var wins = h.filter(function (x) { return x.pnl > 0; });
    var losses = h.filter(function (x) { return x.pnl <= 0; });
    var gw = sum(wins.map(function (x) { return x.pnl; }));
    var gl = Math.abs(sum(losses.map(function (x) { return x.pnl; })));
    var eq = paperEquity();
    var rows = [
      metric(L('Trades', 'වෙළඳාම්'), h.length, ''),
      metric(L('Win rate', 'ජය අනුපාතය'), h.length ? (wins.length / h.length * 100).toFixed(1) + '%' : '—', h.length && wins.length / h.length >= 0.5 ? 'var(--up)' : 'var(--dn)'),
      metric(L('Net P&L', 'ශුද්ධ P&L'), F.usd(eq - S.paper.start), eq >= S.paper.start ? 'var(--up)' : 'var(--dn)'),
      metric(L('Profit factor', 'ලාභ සාධකය'), gl ? (gw / gl).toFixed(2) : (gw ? '∞' : '—'), ''),
      metric(L('Avg win', 'සාම. ලාභ'), wins.length ? F.usd(gw / wins.length) : '—', 'var(--up)'),
      metric(L('Avg loss', 'සාම. පාඩු'), losses.length ? F.usd(-gl / losses.length) : '—', 'var(--dn)'),
      metric(L('Best', 'හොඳම'), h.length ? F.usd(Math.max.apply(null, h.map(function (x) { return x.pnl; }))) : '—', ''),
      metric(L('Avg hold', 'සාම. කාලය'), h.length ? F.dur(sum(h.map(function (x) { return x.holdMs; })) / h.length) : '—', '')
    ];
    html(box, rows.join(''));
    drawEquity();
    var worst = h.length ? Math.min.apply(null, h.map(function (x) { return x.pnl; })) : 0;
    txt($('statsNote'), L(
      'Start ' + F.usd(S.paper.start) + ' USDT · fee ' + S.paper.feePct + '%/side · worst trade ' + F.usd(worst) + ' · equity updated ' + F.ago((S.paper.equity[S.paper.equity.length - 1] || {}).t || Date.now()),
      'ආරම්භය ' + F.usd(S.paper.start) + ' USDT · ගාස්තු ' + S.paper.feePct + '%/පැත්ත · නරකම වෙළඳාම ' + F.usd(worst)));
  }

  function drawEquity() {
    var cv = $('eqChart');
    if (!cv || !S.paper.equity.length) return;
    var s = sizeCanvas(cv);
    if (!s) return;
    var g = s.g;
    g.clearRect(0, 0, s.w, s.h);
    var vals = S.paper.equity.slice(-120).map(function (x) { return x.v; });
    if (vals.length < 2) return;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    var up = vals[vals.length - 1] >= vals[0];
    g.strokeStyle = up ? '#0ecb81' : '#f6465d';
    g.lineWidth = 1.6;
    g.beginPath();
    vals.forEach(function (v, i) {
      var x = (i / (vals.length - 1)) * (s.w - 4) + 2;
      var y = s.h - 4 - ((v - lo) / (hi - lo)) * (s.h - 10);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
    g.lineTo(s.w - 2, s.h - 2); g.lineTo(2, s.h - 2); g.closePath();
    g.fillStyle = up ? 'rgba(14,203,129,.13)' : 'rgba(246,70,93,.13)';
    g.fill();
    /* start line */
    var ys = s.h - 4 - ((S.paper.start - lo) / (hi - lo)) * (s.h - 10);
    if (ys > 0 && ys < s.h) {
      g.setLineDash([3, 3]); g.strokeStyle = 'rgba(131,148,180,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, ys); g.lineTo(s.w, ys); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = '#5b6a86'; g.font = '9px ui-monospace, monospace';
    g.fillText(F.usd(hi, 0), 4, 10);
    g.fillText(F.usd(lo, 0), 4, s.h - 3);
  }

  /* ------------------------ position size calculator ------------------- */
  function renderCalc() {
    var px = priceOf(S.symbol);
    if (!$('calcAcct').value) setVal('calcAcct', Math.round(paperEquity()));
    if (!$('calcStop').value && R.sig && R.sig.ok && isFinite(R.sig.plan.sl)) setVal('calcStop', R.sig.plan.sl.toFixed(TA.step(px)));
    var acct = numVal('calcAcct', 0), risk = numVal('calcRisk', 1), stop = numVal('calcStop', NaN);
    if (!acct || !isFinite(px) || !isFinite(stop) || stop === px) {
      txt($('calcSize'), '—'); txt($('calcNotional'), '—'); txt($('calcRiskAmt'), '—');
      txt($('calcNote'), L('Enter your account size and a stop price.', 'ඔබේ ගිණුම් ප්‍රමාණය සහ නැවතුම් මිලක් ඇතුළත් කරන්න.'));
      return;
    }
    var riskAmt = (acct * risk) / 100;
    var perUnit = Math.abs(px - stop);
    var qty = riskAmt / perUnit;
    var notional = qty * px;
    txt($('calcSize'), F.qty(qty) + ' ' + S.symbol.split('/')[0]);
    txt($('calcNotional'), F.usd(notional) + ' USDT');
    txt($('calcRiskAmt'), F.usd(riskAmt) + ' USDT');
    var lev = (notional / acct) * 100;
    txt($('calcNote'), L(
      'Distance to stop ' + ((perUnit / px) * 100).toFixed(2) + '% · that position is ' + lev.toFixed(0) + '% of your account' +
      (lev > 100 ? ' — larger than your balance, so the exchange would reject it' : '') +
      (risk > 2 ? ' · risking more than 2% per trade compounds fast' : ''),
      'නැවතුමට දුර ' + ((perUnit / px) * 100).toFixed(2) + '% · මෙම ස්ථානය ඔබේ ගිණුමෙන් ' + lev.toFixed(0) + '%යි' +
      (lev > 100 ? ' — ශේෂයට වඩා විශාලයි, හුවමාරුව ප්‍රතික්ෂේප කරයි' : '') +
      (risk > 2 ? ' · වෙළඳාමකට 2%ට වඩා අවදානම් ගැනීම ඉක්මනින් එකතු වේ' : '')));
  }

  /* =====================================================================
     BOT ENGINE
     ===================================================================== */
  function botLog(kind, msg) {
    var line = { t: Date.now(), kind: kind || '', msg: String(msg) };
    S.bot.log.unshift(line);
    if (S.bot.log.length > 180) S.bot.log.length = 180;
    save();
    renderBotLog();
  }
  APP.botLog = botLog;

  function renderBotLog() {
    var box = $('botLog');
    if (!box) return;
    if (!S.bot.log.length) { html(box, '<div class="t">' + L('log is empty', 'ලොග් හිස්') + '</div>'); return; }
    html(box, S.bot.log.slice(0, 120).map(function (l) {
      return '<div><span class="t">' + F.time(l.t) + '</span><span class="' + esc(l.kind) + '">' + esc(l.msg) + '</span></div>';
    }).join(''));
  }

  function renderBot() {
    /* strategy select */
    var sel = $('bStrat');
    if (sel && sel.options.length !== Brain.STRATEGIES.length) {
      html(sel, Brain.STRATEGIES.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === S.bot.strat ? ' selected' : '') + '>' + esc(L(s.en, s.si)) + '</option>';
      }).join(''));
    } else if (sel) sel.value = S.bot.strat;
    var strat = Brain.strategy(S.bot.strat);
    txt($('bStratDesc'), L(strat.enDesc, strat.siDesc) + ' · ' + L('defaults', 'පෙරනිමි') + ': TP ' + strat.tp + '% / SL ' + strat.sl + '% / ' + L('entry', 'ඇතුළුවීම') + ' ' + strat.entry);

    var tf = $('bTf');
    if (tf && !tf.options.length) html(tf, Object.keys(TF_MS).map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join(''));
    if (tf) tf.value = S.bot.tf;

    /* inputs */
    setVal('bSize', S.bot.size); setVal('bTp', S.bot.tp); setVal('bSl', S.bot.sl);
    setVal('bMinP', S.bot.minProfit); setVal('bEntry', S.bot.entry); setVal('bDayT', S.bot.dayTarget);
    setVal('bMaxHold', S.bot.maxHold); setVal('bDcaDrop', S.bot.dcaDrop); setVal('bDcaMax', S.bot.dcaMax);
    setVal('bVolDrop', S.bot.volDrop); setVal('bMaxLoss', S.bot.brakeLoss); setVal('bMaxPos', S.bot.maxPos);
    setVal('bCool', S.bot.cooldown); setVal('bDaily', S.bot.dailyLoss);
    setVal('bExit', S.bot.exitMode);
    cls($('bDca'), 'on', S.bot.dca);
    cls($('bVol'), 'on', S.bot.volGuard);
    cls($('bAiTp'), 'on', S.bot.aiTp);
    syncSwitch('bShort', S.bot.allowShort);
    syncSwitch('bNotify', S.bot.notify);
    syncSwitch('bKeep', S.bot.keepAwake);
    show($('mpWarn'), S.bot.exitMode === 'minprofit');
    if (S.bot.exitMode === 'minprofit') txt($('mpWarn'), L(
      'Min-profit mode sells at the first net profit of ' + F.usd(S.bot.minProfit) + ' USDT. It wins often and loses big when a position never comes back — the brake loss below is your protection.',
      'අවම-ලාභ ප්‍රකාරය ' + F.usd(S.bot.minProfit) + ' USDT ශුද්ධ ලාභයක් ලැබුණු වහාම විකුණයි. එය බොහෝ විට ජය ගනී; ස්ථානයක් ආපසු නොඇවිත් එකතු වුවහොත් විශාල පාඩු ලැබේ — පහත බ්‍රේක් පාඩුව ඔබේ ආරක්ෂාවයි.'));

    /* symbol chips */
    var chips = $('bSymbols');
    if (chips) {
      var pool = S.bot.symbols.slice();
      html(chips, pool.map(function (s) {
        return '<button class="chip on" data-bsym="' + esc(s) + '">' + esc(s) + ' ✕</button>';
      }).join('') + '<button class="chip" data-bsym-add="1">+ ' + L('add', 'එක් කරන්න') + '</button>');
    }

    var dayP = dayPnl();
    txt($('bRiskNote'), L(
      'Max ' + S.bot.maxPos + ' positions · ' + S.bot.cooldown + ' min cooldown per symbol · stop after ' + F.usd(S.bot.dailyLoss) + ' USDT loss today (today: ' + F.usd(dayP) + ')',
      'උපරිම ස්ථාන ' + S.bot.maxPos + ' · සංකේතයකට ' + S.bot.cooldown + ' මිනිත්තු නිවාලීම · අද ' + F.usd(S.bot.dailyLoss) + ' USDT පාඩුවකින් නවතී (අද: ' + F.usd(dayP) + ')'));

    renderBotStats();
    renderBotHead();
    renderBrain();
    renderCloud();
    render247();
    renderBotLog();
  }

  function dayPnl() {
    var d = dayAnchor();
    return sum(S.paper.history.filter(function (h) { return h.closed >= d; }).map(function (h) { return h.pnl; }));
  }

  function renderBotHead() {
    var dot = $('botDot');
    if (dot) cls(dot, 'run', !!S.bot.running);
    txt($('botState'), S.bot.running
      ? (S.bot.halted ? L('Running · halted: ' + S.bot.halted, 'ධාවනය · නැවතුණා: ' + S.bot.halted) : L('Running', 'ධාවනය වෙමින්'))
      : L('Idle', 'නිශ්ශබ්ද'));
    var pnl = S.bot.stats.pnl;
    var el = $('botPnl');
    if (el) { el.textContent = (pnl >= 0 ? '+' : '') + F.usd(pnl) + ' USDT'; el.style.color = pnl >= 0 ? 'var(--up)' : 'var(--dn)'; }
  }

  function renderBotStats() {
    var box = $('botStats');
    if (!box) return;
    var st = S.bot.stats;
    var botPos = S.paper.positions.filter(function (p) { return p.bot; });
    var open = sum(botPos.map(function (p) { return posPnl(p).net; }));
    html(box,
      metric(L('Bot trades', 'බොට් වෙළඳාම්'), st.trades, '') +
      metric(L('Win rate', 'ජය අනුපාතය'), st.trades ? ((st.wins / st.trades) * 100).toFixed(0) + '%' : '—', st.trades && st.wins / st.trades >= 0.5 ? 'var(--up)' : 'var(--dn)') +
      metric(L('Open P&L', 'විවෘත P&L'), (open >= 0 ? '+' : '') + F.usd(open), open >= 0 ? 'var(--up)' : 'var(--dn)') +
      metric(L('Scans', 'පරීක්ෂා'), st.scans, ''));
    renderBotHead();
  }

  /* ------------------------------- AI brain --------------------------- */
  function renderBrain() {
    var box = $('brainStats');
    var w = S.weights, d = Brain.DEFAULT_WEIGHTS;
    var moved = Object.keys(d).filter(function (k) { return Math.abs(w[k] - d[k]) > 1e-6; }).length;
    var chip = $('brainChip');
    if (chip) {
      chip.textContent = moved ? L('TRAINED', 'පුහුණු කළා') : L('DEFAULT', 'පෙරනිමි');
      cls(chip, 'on', moved > 0);
    }
    if (box) {
      html(box,
        metric(L('Features', 'සාධක'), Object.keys(d).length, '') +
        metric(L('Trained', 'පුහුණු'), moved + '/' + Object.keys(d).length, moved ? 'var(--gold)' : '') +
        metric(L('Last accuracy', 'අවසන් නිවැරදිතාව'), R.brainAcc !== undefined ? R.brainAcc.toFixed(1) + '%' : '—', R.brainAcc >= 55 ? 'var(--up)' : '') +
        metric(L('Samples', 'නියැදි'), R.brainSamples || '—', ''));
    }
    var wb = $('brainWeights');
    if (wb) {
      var keys = Object.keys(d).sort(function (a, b) { return Math.abs(w[b]) - Math.abs(w[a]); });
      html(wb, keys.map(function (k) {
        var lab = Brain.FEATURE_LABELS[k] || { en: k, si: k };
        var pctv = TA.clamp(Math.abs(w[k]) * 220, 2, 100);
        var col = w[k] >= 0 ? 'var(--up)' : 'var(--dn)';
        return '<div class="sm-kv"><span>' + esc(L(lab.en, lab.si)) + '</span>' +
          '<span class="small" style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end">' +
          '<span class="sm-gauge" style="width:70px"><i style="width:' + pctv.toFixed(0) + '%;background:' + col + '"></i></span>' +
          '<b style="color:' + col + ';min-width:46px;text-align:right">' + w[k].toFixed(3) + '</b></span></div>';
      }).join(''));
    }
    txt($('brainNote'), moved
      ? L('Weights differ from the defaults — every signal, backtest and bot entry uses them. Reset restores the shipped values.',
          'බර පෙරනිමි අගයන්ගෙන් වෙනස්ය — සෑම සංඥාවක්, පසු-පරීක්ෂණයක් සහ බොට් ඇතුළුවීමක්ම ඒවා භාවිතා කරයි. Reset මගින් මුල් අගයන් ආපසු ලැබේ.')
      : L('Training walks this chart\'s own history, labels each bar by the forward return, and keeps new weights only if the held-out accuracy improves.',
          'පුහුණුව මෙම ප්‍රස්ථාරයේ ඉතිහාසයම භාවිතා කරයි, සෑම කදුලුවක්ම ඉදිරි ප්‍රතිලාභයෙන් නම් කරයි, රඳවාගත් නිවැරදිතාව වැඩි වුවහොත් පමණක් නව බර තබා ගනී.'));
  }

  function trainBrain() {
    var entry = R.candles[cacheKey(S.symbol, S.tf)];
    if (!entry || entry.cd.length < 120) {
      toast(L('Need 120+ candles — open a longer timeframe', 'කදුලු 120+ ඕනෑ — දිගු කාලරාමුවක් විවෘත කරන්න'), 'bad');
      return;
    }
    var btn = $('brainTrain');
    if (btn) btn.disabled = true;
    txt($('brainNote'), L('Training on ' + entry.cd.length + ' bars of ' + S.symbol + ' ' + S.tf + '…', S.symbol + ' ' + S.tf + ' කදුලු ' + entry.cd.length + ' මත පුහුණු වෙමින්…'));
    setTimeout(function () {
      var res = Brain.train(entry.cd, { weights: S.weights, horizon: Math.max(6, Math.round(3600000 / (TF_MS[S.tf] || 300000))), fee: S.paper.feePct });
      if (btn) btn.disabled = false;
      if (!res.ok) {
        txt($('brainNote'), L('Training needs more data (' + (res.bars || 0) + ' bars).', 'පුහුණුවට තව දත්ත ඕනෑ (' + (res.bars || 0) + ' කදුලු).'));
        toast(L('Not enough data to train', 'පුහුණු කිරීමට ප්‍රමාණවත් දත්ත නැත'), 'bad');
        return;
      }
      R.brainAcc = res.after; R.brainSamples = res.samples;
      if (res.improved) {
        S.weights = res.weights;
        save();
        botLog('ai', '🎓 ' + L('brain trained', 'මොළය පුහුණු කළා') + ': ' + res.before.toFixed(1) + '% → ' + res.after.toFixed(1) + '% (' + res.samples + ' ' + L('samples', 'නියැදි') + ')');
        toast(L('Brain trained — accuracy ', 'මොළය පුහුණු කළා — නිවැරදිතාව ') + res.before.toFixed(1) + '% → ' + res.after.toFixed(1) + '%', 'ok', 3600);
      } else {
        botLog('warn', '🎓 ' + L('training rejected — held-out accuracy did not improve', 'පුහුණුව ප්‍රතික්ෂේප කළා — නිවැරදිතාව වැඩි වූයේ නැත') + ' (' + res.before.toFixed(1) + '% → ' + res.after.toFixed(1) + '%)');
        toast(L('Kept the old weights — new ones were not better out-of-sample', 'පරණ බර තබා ගත්තා — අලුත් ඒවා හොඳ නැහැ'), 'bad', 3600);
      }
      R.sig = null;
      renderBrain(); renderSignals();
      beep(1040, 0.16);
    }, 40);
  }

  function resetBrain() {
    confirmBox(L('Reset the brain?', 'මොළය නැවත සකසන්නද?'),
      L('All trained weights go back to the shipped defaults. Your trades and settings stay.',
        'සියලු පුහුණු බර මුල් පෙරනිමි අගයන්ට පත්වේ. ඔබේ වෙළඳාම් සහ සැකසුම් රැඳේ.'),
      function () {
        S.weights = clone(Brain.DEFAULT_WEIGHTS);
        R.brainAcc = undefined; R.brainSamples = 0;
        save(); renderBrain(); renderSignals();
        botLog('warn', '♻️ ' + L('brain reset to defaults', 'මොළය පෙරනිමි අගයන්ට සකසන ලදී'));
        toast(L('Brain reset', 'මොළය නැවත සකසන ලදී'), 'ok');
      });
  }

  /* ------------------------------- bot run ---------------------------- */
  function botTickMs() {
    var tfMs = TF_MS[S.bot.tf] || 300000;
    return TA.clamp(Math.round(tfMs / 12), 12000, 120000);
  }

  function startBot() {
    if (S.bot.running) { toast(L('The bot is already running', 'බොට් දැනටමත් ධාවනය වෙමින්'), 'bad'); return; }
    if (!S.bot.symbols.length) { toast(L('Pick at least one symbol', 'අවම වශයෙන් එක් සංකේතයක් තෝරන්න'), 'bad'); return; }
    if (S.mode === 'live' && !liveReady()) { toast(L('Live mode needs API keys', 'සජීවී ප්‍රකාරයට API යතුරු ඕනෑ'), 'bad'); return; }
    readBotForm();
    S.bot.running = true;
    S.bot.startedAt = Date.now();
    S.bot.halted = '';
    save();
    if (S.bot.notify && global.Notification && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) { }
    }
    setWake();
    botLog('ok', '▶ ' + L('bot started', 'බොට් ආරම්භ කළා') + ' · ' + Brain.strategy(S.bot.strat)[S.lang === 'si' ? 'si' : 'en'] +
      ' · ' + S.bot.tf + ' · ' + S.bot.symbols.join(', ') + ' · ' + (S.mode === 'live' ? 'LIVE' : 'PAPER') +
      ' · TP ' + S.bot.tp + '% SL ' + S.bot.sl + '% ' + L('entry', 'ඇතුළුවීම') + '≥' + S.bot.entry +
      (S.bot.exitMode === 'minprofit' ? ' · ' + L('min-profit mode', 'අවම-ලාභ ප්‍රකාරය') + ' ' + F.usd(S.bot.minProfit) : ''));
    toast(L('Bot started', 'බොට් ආරම්භ කළා'), 'ok');
    beep(880, 0.16); buzz([14, 50, 14]);
    renderBot();
    botLoop(true);
    clearInterval(R.timers.bot);
    R.timers.bot = setInterval(function () { botLoop(false); }, botTickMs());
  }

  function stopBot(reason) {
    if (!S.bot.running) return;
    S.bot.running = false;
    S.bot.halted = '';
    clearInterval(R.timers.bot);
    R.timers.bot = null;
    save();
    setWake();
    botLog('warn', '■ ' + L('bot stopped', 'බොට් නැවැත්වූවා') + (reason ? ' · ' + reason : '') +
      ' · ' + L('open bot positions', 'විවෘත බොට් ස්ථාන') + ': ' + S.paper.positions.filter(function (p) { return p.bot; }).length);
    toast(L('Bot stopped', 'බොට් නැවැත්වූවා'));
    renderBot();
  }

  function readBotForm() {
    S.bot.strat = val('bStrat', S.bot.strat);
    S.bot.tf = val('bTf', S.bot.tf);
    S.bot.size = Math.max(1, numVal('bSize', S.bot.size));
    S.bot.tp = numVal('bTp', S.bot.tp);
    S.bot.sl = numVal('bSl', S.bot.sl);
    S.bot.exitMode = val('bExit', S.bot.exitMode);
    S.bot.minProfit = Math.max(0.01, numVal('bMinP', S.bot.minProfit));
    S.bot.entry = TA.clamp(numVal('bEntry', S.bot.entry), 5, 40);
    S.bot.dayTarget = Math.max(0, numVal('bDayT', 0));
    S.bot.maxHold = Math.max(0, numVal('bMaxHold', 0));
    S.bot.dcaDrop = Math.max(0.5, numVal('bDcaDrop', S.bot.dcaDrop));
    S.bot.dcaMax = TA.clamp(Math.round(numVal('bDcaMax', S.bot.dcaMax)), 1, 5);
    S.bot.volDrop = Math.max(2, numVal('bVolDrop', S.bot.volDrop));
    S.bot.brakeLoss = Math.max(5, numVal('bMaxLoss', S.bot.brakeLoss));
    S.bot.maxPos = Math.max(1, Math.round(numVal('bMaxPos', S.bot.maxPos)));
    S.bot.cooldown = Math.max(0, numVal('bCool', S.bot.cooldown));
    S.bot.dailyLoss = Math.max(0, numVal('bDaily', S.bot.dailyLoss));
    save();
  }

  /* one full pass: risk brakes → exits → entries → DCA → AI targets */
  function botLoop(first) {
    if (!S.bot.running) return;
    if (R.botBusy) return;
    R.botBusy = true;
    var t0 = Date.now();

    /* --- risk brakes ------------------------------------------------- */
    var eq = paperEquity();
    var ddFromStart = ((S.paper.start - eq) / S.paper.start) * 100;
    if (ddFromStart >= S.bot.brakeLoss) {
      botLog('bad', '🛑 ' + L('brake loss hit — account is ', 'බ්‍රේක් පාඩුව ළඟා වුණා — ගිණුම ') + F.pct(-ddFromStart) + ' ' + L('from start', 'ආරම්භයෙන්'));
      S.bot.halted = L('brake loss', 'බ්‍රේක් පාඩු');
      notify('🛑 ' + APP.name, L('Brake loss reached — the bot stopped opening trades', 'බ්‍රේක් පාඩුව ළඟා වුණා — බොට් නවතී'));
      save(); renderBot(); R.botBusy = false; return;
    }
    var dp = dayPnl();
    if (S.bot.dailyLoss > 0 && dp <= -S.bot.dailyLoss) {
      if (!S.bot.halted) {
        S.bot.halted = L('daily loss stop', 'දෛනික පාඩු සීමාව');
        botLog('bad', '⛔ ' + L('daily loss stop — today ', 'දෛනික පාඩු සීමාව — අද ') + F.usd(dp) + ' USDT');
        notify('⛔ ' + APP.name, L('Daily loss limit reached, no new entries today', 'දෛනික පාඩු සීමාව ළඟා වුණා, අද නව ඇතුළුවීම් නැත'));
      }
    } else if (S.bot.halted === L('daily loss stop', 'දෛනික පාඩු සීමාව')) S.bot.halted = '';
    var dayDone = S.bot.dayTarget > 0 && dp >= S.bot.dayTarget;
    if (dayDone && !S.bot.halted) {
      S.bot.halted = L('daily target reached', 'දෛනික ඉලක්කය ළඟා වුණා');
      botLog('ok', '🎯 ' + L('daily target reached — ', 'දෛනික ඉලක්කය ළඟා වුණා — ') + F.usd(dp) + ' / ' + F.usd(S.bot.dayTarget) + ' USDT');
    }

    var chain = Promise.resolve();
    var syms = S.bot.symbols.slice();

    chain = chain.then(function () { return managePositionsAsync(); });

    syms.forEach(function (sym) {
      chain = chain.then(function () { return botScanSymbol(sym, dayDone || !!S.bot.halted); })
        .catch(function (e) { botLog('bad', sym + ': ' + (e && e.message || e)); });
    });

    chain = chain.then(function () {
      if (S.bot.aiTp) return aiTargets();
    }).then(function () {
      S.bot.stats.scans++;
      R.latency.push(Date.now() - t0);
      if (R.latency.length > 40) R.latency.shift();
      save();
      renderBotStats();
      renderTrade();
      if (R.sys && R.sys.pulse) R.sys.pulse('bot');
      R.botBusy = false;
    }).catch(function (e) { R.botBusy = false; console.warn('bot loop', e); });
  }

  function managePositionsAsync() {
    managePositions();
    checkOrders();
    return Promise.resolve();
  }

  function botScanSymbol(sym, entriesBlocked) {
    return fetchCandles(sym, S.bot.tf, 220).then(function (entry) {
      var cd = entry.cd;
      var ctx = Brain.context(cd);
      var score = Brain.strategyScore(S.bot.strat, cd, ctx, cd.length - 1, S.weights);
      var last = cd[cd.length - 1];
      var openPos = S.paper.positions.filter(function (p) { return p.sym === sym; });
      var botCount = S.paper.positions.filter(function (p) { return p.bot; }).length;
      var coolKey = 'cool:' + sym;
      var cooled = R[coolKey] && Date.now() - R[coolKey] < S.bot.cooldown * 60000;

      /* --- entry ------------------------------------------------------ */
      if (!entriesBlocked && !cooled && botCount < S.bot.maxPos && !openPos.length) {
        var side = score >= S.bot.entry ? 'long' : (S.bot.allowShort && score <= -S.bot.entry ? 'short' : null);
        if (side) {
          var prevSym = S.symbol;
          S.symbol = sym;
          var pos = S.mode === 'live' ? liveOrder(side, S.bot.size, { tp: S.bot.tp, sl: S.bot.sl, bot: true })
            : openTrade(side, S.bot.size, {
              price: last.c, bot: true,
              tp: S.bot.tp, sl: S.bot.sl,
              note: Brain.strategy(S.bot.strat).en + ' score ' + score.toFixed(1)
            });
          S.symbol = prevSym;
          if (pos || S.mode === 'live') {
            R[coolKey] = Date.now();
            S.bot.stats.entries++;
            botLog('ai', '🧠 ' + sym + ' ' + side.toUpperCase() + ' ' + L('score', 'ලකුණු') + ' ' + score.toFixed(1) +
              ' · ' + Brain.strategy(S.bot.strat)[S.lang === 'si' ? 'si' : 'en'] + ' · ' + (entry.demo ? L('demo data', 'ආදර්ශන දත්ත') : ex().name));
          }
        }
      }

      /* --- DCA -------------------------------------------------------- */
      if (S.bot.dca && !entriesBlocked) {
        openPos.forEach(function (p) {
          if (!p.bot || p.dca >= S.bot.dcaMax) return;
          var drop = ((last.c - p.entry) / p.entry) * 100 * (p.side === 'long' ? 1 : -1);
          var refDrop = p.lastDca ? ((last.c - p.lastDca) / p.lastDca) * 100 * (p.side === 'long' ? 1 : -1) : drop;
          if (refDrop <= -S.bot.dcaDrop) {
            var prevSym2 = S.symbol;
            S.symbol = sym;
            var qtyUsdt = S.bot.size;
            if (S.paper.cash >= qtyUsdt * 1.01) {
              var oldNotional = p.notional, oldQty = p.qty;
              var add = openTrade(p.side, qtyUsdt, { price: last.c, bot: true, tp: p.tp, sl: p.sl, note: 'dca' });
              if (add) {
                /* merge the new fill into the existing position at an averaged entry */
                var newQty = oldQty + add.qty;
                p.entry = (p.entry * oldQty + add.entry * add.qty) / newQty;
                p.qty = newQty;
                p.notional = oldNotional + add.notional;
                p.feePaid = (p.feePaid || 0) + (add.feePaid || 0);
                p.dca++;
                p.lastDca = last.c;
                var idx = S.paper.positions.indexOf(add);
                if (idx >= 0) S.paper.positions.splice(idx, 1);
                S.paper.cash += 0; /* already deducted inside openTrade */
                S.bot.stats.dca++;
                botLog('warn', '💧 DCA ' + sym + ' #' + p.dca + ' @ ' + F.price(last.c) + ' → ' + L('new average', 'නව සාමාන්‍ය') + ' ' + F.price(p.entry));
                save();
              }
            }
            S.symbol = prevSym2;
          }
        });
      }
      return score;
    });
  }
  var first_ = true;

  /* AI sell-rate: re-analyse an open bot trade and move its TP if the
     market has clearly changed its mind. Manual targets are never touched. */
  function aiTargets() {
    var targets = S.paper.positions.filter(function (p) { return p.bot && isFinite(p.tp); });
    if (!targets.length) return Promise.resolve();
    var chain = Promise.resolve();
    targets.forEach(function (p) {
      if (p.aiTarget && Date.now() - p.aiTarget.ts < 3 * 60000) return;
      chain = chain.then(function () {
        return fetchCandles(p.sym, S.bot.tf, 200).then(function (entry) {
          var sig = Brain.analyze(entry.cd, { weights: S.weights });
          if (!sig.ok) return;
          var dirn = p.side === 'long' ? 1 : -1;
          var move = ((sig.price - p.entry) / p.entry) * 100 * dirn;
          var want = p.tp;
          var why = '';
          if (sig.score * dirn >= 35) { want = p.tp * 1.45; why = L('signal strengthened', 'සංඥාව ශක්තිමත් වුණා') + ' ' + sig.score.toFixed(0); }
          else if (sig.score * dirn <= -25) { want = Math.max(p.tp * 0.45, 0.15); why = L('signal flipped', 'සංඥාව පෙරළුණා') + ' ' + sig.score.toFixed(0); }
          else if (move >= p.tp * 0.8) { want = Math.max(p.tp * 0.85, move * 1.02); why = L('close to target — locking in', 'ඉලක්කය ළඟ — ලාභ සුරකීම'); }
          else return;
          if (Math.abs(want - (p.aiTarget ? p.aiTarget.tp : p.tp)) < 0.05) return;
          var prev = p.aiTarget ? p.aiTarget.tp : p.tp;
          var hist = (p.aiTarget && p.aiTarget.history) ? p.aiTarget.history.slice(-6) : [];
          hist.push({ ts: Date.now(), from: prev, to: want, why: why });
          p.aiTarget = { tp: want, ts: Date.now(), note: why, score: sig.score, history: hist };
          botLog('ai', '🎯 AI ' + L('sell rate', 'විකුණුම් මිල') + ' ' + p.sym + ': ' + F.pct(prev) + ' → ' + F.pct(want) + ' (' + why + ')');
          save();
          if (R.tab === 'trade') renderPositions();
        }).catch(function () { });
      });
    });
    return chain;
  }

  /* =====================================================================
     LIVE TRADING (Binance spot, signed on-device)
     Only the Android app can do this: a browser page cannot sign requests
     because the exchange rejects cross-origin calls. Capacitor's native
     HTTP bridge removes that limit inside the app.
     ===================================================================== */
  function liveReady() { return !!(S.keys.key && S.keys.secret && S.exchange === 'binance'); }
  APP.liveReady = liveReady;

  function liveBase() { return S.testnet ? EX.binance.testnet : EX.binance.signed; }

  async function hmacHex(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return Array.prototype.map.call(new Uint8Array(sig), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function qs(params) {
    return Object.keys(params).filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  }

  async function binanceSigned(path, params, method) {
    if (!liveReady()) throw new Error(L('Add your Binance API keys in Settings first', 'මුලින් සැකසුම්වල ඔබේ Binance API යතුරු එක් කරන්න'));
    if (!R.native) throw new Error(L('Live orders need the Android app — a browser cannot sign them', 'සජීවී ඇණවුම් වලට Android යෙදුම ඕනෑ — බ්‍රවුසරයකට අත්සන් කළ නොහැක'));
    var p = Object.assign({}, params, { timestamp: Date.now(), recvWindow: 8000 });
    var q = qs(p);
    var signature = await hmacHex(S.keys.secret, q);
    return json(liveBase() + path + '?' + q + '&signature=' + signature, { method: method || 'GET', timeout: 15000 });
  }
  APP.binanceSigned = binanceSigned;

  /* exchangeInfo filters, cached per symbol, so quantities round correctly */
  var FILTERS = {};
  async function symbolFilters(sym) {
    if (FILTERS[sym]) return FILTERS[sym];
    var j = await json(liveBase() + '/api/v3/exchangeInfo?symbol=' + EX.binance.pair(sym));
    var info = j.symbols && j.symbols[0];
    if (!info) throw new Error('unknown symbol');
    var lot = (info.filters || []).filter(function (f) { return f.filterType === 'LOT_SIZE'; })[0] || { stepSize: '0.00001', minQty: '0' };
    var notional = (info.filters || []).filter(function (f) { return f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL'; })[0] || { minNotional: '5' };
    FILTERS[sym] = {
      stepQty: parseFloat(lot.stepSize), minQty: parseFloat(lot.minQty || 0),
      minNotional: parseFloat(notional.minNotional || 5),
      basePrecision: (String(lot.stepSize).split('.')[1] || '').replace(/0+$/, '').length
    };
    return FILTERS[sym];
  }
  function roundStep(v, step) { return step > 0 ? Math.floor(v / step) * step : v; }

  async function liveOrder(side, usdt, opts) {
    opts = opts || {};
    try {
      var px = opts.price || priceOf(S.symbol);
      var f = await symbolFilters(S.symbol);
      if (usdt < f.minNotional) throw new Error(L('Minimum order is ' + f.minNotional + ' USDT on this pair', 'මෙම යුගලයේ අවම ඇණවුම ' + f.minNotional + ' USDT'));
      var params = { symbol: EX.binance.pair(S.symbol), side: side === 'long' || side === 'buy' ? 'BUY' : 'SELL' };
      if (opts.type === 'limit') {
        params.type = 'LIMIT'; params.timeInForce = 'GTC'; params.price = (opts.price || px).toFixed(TA.step(px));
        params.quantity = roundStep(usdt / px, f.stepQty).toFixed(f.basePrecision);
      } else if (params.side === 'BUY') {
        params.type = 'MARKET'; params.quoteOrderQty = Math.floor(usdt * 100) / 100;
      } else {
        params.type = 'MARKET'; params.quantity = roundStep(usdt / px, f.stepQty).toFixed(f.basePrecision);
      }
      if (parseFloat(params.quantity || 1) <= 0 && params.quantity !== undefined) throw new Error(L('Quantity rounds to zero — the order is too small', 'ප්‍රමාණය බිංදුවට වටයනවා — ඇණවුම ඉතා කුඩායි'));
      var res = await binanceSigned('/api/v3/order', params, 'POST');
      var filled = parseFloat(res.cummQuoteQty || 0) || usdt;
      var avgPx = parseFloat(res.price || 0) || px;
      botLog('ok', '⚡ LIVE ' + res.side + ' ' + res.symbol + ' ' + (res.executedQty || '—') + ' @ ' + avgPx + ' · ' + res.status);
      toast(L('Live order sent — ', 'සජීවී ඇණවුම යැව්වා — ') + res.status, 'ok');
      notify('⚡ ' + APP.name, res.side + ' ' + res.symbol + ' ' + res.status);
      /* mirror the live fill into the local book so TP/SL management still works */
      var pos = {
        id: uid(), sym: S.symbol, side: params.side === 'BUY' ? 'long' : 'short', qty: parseFloat(res.executedQty || params.quantity || usdt / avgPx),
        entry: avgPx, notional: filled, ts: Date.now(), tp: opts.tp || null, sl: opts.sl || null,
        feePaid: 0, bot: !!opts.bot, mark: avgPx, live: true, orderId: res.orderId, aiTarget: null, dca: 0
      };
      S.paper.positions.push(pos);
      save(); renderTrade(); renderBadge();
      return pos;
    } catch (e) {
      var msg = String(e && e.message || e);
      botLog('bad', '⚡ LIVE ' + L('order failed', 'ඇණවුම අසාර්ථකයි') + ': ' + msg);
      toast(L('Live order failed: ', 'සජීවී ඇණවුම අසාර්ථකයි: ') + msg, 'bad', 4200);
      return null;
    }
  }
  APP.liveOrder = liveOrder;

  async function testKeys() {
    var st = $('setKeyStatus');
    if (st) st.innerHTML = '<span class="spinner"></span> ' + esc(L('Testing…', 'පරීක්ෂා කරමින්…'));
    try {
      var acct = await binanceSigned('/api/v3/account', {}, 'GET');
      var usable = (acct.balances || []).filter(function (b) { return parseFloat(b.free) > 0 || parseFloat(b.locked) > 0; });
      var usdt = (acct.balances || []).filter(function (b) { return b.asset === 'USDT'; })[0];
      if (st) st.innerHTML = '<span style="color:var(--up)">✅ ' + esc(L('Connected', 'සම්බන්ධයි')) + '</span> · canTrade: <b>' + acct.canTrade + '</b> · ' +
        L('assets with a balance', 'ශේෂයක් ඇති වත්කම්') + ': <b>' + usable.length + '</b>' +
        (usdt ? ' · USDT <b>' + F.usd(parseFloat(usdt.free) + parseFloat(usdt.locked)) + '</b>' : '') +
        (acct.permissions ? ' · ' + esc(acct.permissions.join('/')) : '');
      botLog('ok', '🔑 ' + L('API keys verified', 'API යතුරු තහවුරු කළා') + ' · canTrade=' + acct.canTrade);
      toast(L('Keys work', 'යතුරු වැඩ කරනවා'), 'ok');
    } catch (e) {
      if (st) st.innerHTML = '<span style="color:var(--dn)">❌ ' + esc(String(e && e.message || e)) + '</span>';
      toast(L('Key test failed', 'යතුරු පරීක්ෂාව අසාර්ථකයි'), 'bad');
    }
  }

  /* =====================================================================
     CLOUD BOT — an optional server that runs the same engine
     ===================================================================== */
  function renderCloud() {
    setVal('cloudUrl', S.cloud.url);
    setVal('cloudToken', S.cloud.token);
    var chip = $('cloudChip');
    if (chip) {
      var st = R.cloudState;
      chip.textContent = !S.cloud.url ? L('not set', 'සකසා නැත') : !st ? L('unknown', 'නොදනී') : st.running ? L('RUNNING', 'ධාවනය') : L('STOPPED', 'නැවතුණා');
      cls(chip, 'on', !!(st && st.running));
    }
    var body = $('cloudBody');
    if (body && R.cloudMsg) body.textContent = R.cloudMsg;
    else if (body) body.textContent = L('No server configured — the phone bot above works on its own.', 'සර්වරයක් සකසා නැත — ඉහත දුරකථන බොට් ස්වාධීනව ක්‍රියා කරයි.');
  }
  function cloudReq(path, body) {
    if (!S.cloud.url) { R.cloudMsg = L('Enter the server URL first', 'මුලින් සර්වර් URL එක ඇතුළත් කරන්න'); renderCloud(); return Promise.reject(new Error('no url')); }
    var url = S.cloud.url.replace(/\/$/, '') + path;
    return json(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-control-token': S.cloud.token || '' },
      body: body ? JSON.stringify(body) : undefined,
      timeout: 12000
    });
  }
  function cloudCheck() {
    R.cloudMsg = L('Checking…', 'පරීක්ෂා කරමින්…'); renderCloud();
    cloudReq('/api/status').then(function (j) {
      R.cloudState = j || null;
      R.cloudMsg = L('Connected · ', 'සම්බන්ධයි · ') + (j && j.name ? j.name : 'server') + ' · ' +
        (j && j.running ? L('bot RUNNING', 'බොට් ධාවනය') : L('bot stopped', 'බොට් නැවතුණා')) +
        (j && j.equity ? ' · ' + L('server equity', 'සර්වර් සමස්ත') + ' ' + F.usd(j.equity) + ' USDT' : '') +
        (j && j.version ? ' · v' + j.version : '');
      renderCloud();
      toast(L('Cloud server reachable', 'ක්ලවුඩ් සර්වරය ළඟාවිය හැක'), 'ok');
    }).catch(function (e) {
      R.cloudState = null;
      R.cloudMsg = L('Not reachable: ', 'ළඟාවිය නොහැක: ') + String(e && e.message || e) +
        L(' — check the URL, the token and that the server allows this origin.', ' — URL, ටෝකනය සහ සර්වරය මෙම මූලාරම්භයට ඉඩ දෙනවාද යන්න පරීක්ෂා කරන්න.');
      renderCloud();
    });
  }
  function cloudCmd(cmd) {
    cloudReq('/api/' + cmd, { strategy: S.bot.strat, symbols: S.bot.symbols, tf: S.bot.tf, size: S.bot.size, tp: S.bot.tp, sl: S.bot.sl }).then(function (j) {
      R.cloudState = j || R.cloudState;
      R.cloudMsg = L('Server answered: ', 'සර්වර් පිළිතුරු දුන්නා: ') + (j && j.message ? j.message : cmd + ' ok');
      renderCloud();
      botLog('ai', '☁️ ' + cmd + ' → ' + R.cloudMsg);
      toast(L('Cloud bot ', 'ක්ලවුඩ් බොට් ') + cmd, 'ok');
    }).catch(function (e) {
      R.cloudMsg = L('Command failed: ', 'විධානය අසාර්ථකයි: ') + String(e && e.message || e);
      renderCloud();
      toast(L('Cloud command failed', 'ක්ලවුඩ් විධානය අසාර්ථකයි'), 'bad');
    });
  }

  /* =====================================================================
     24/7 CARD
     ===================================================================== */
  function render247() {
    var chip = $('btBgChip');
    if (chip) {
      chip.textContent = S.bot.running ? L('SCANNING', 'පරීක්ෂා කරමින්') : L('OFF', 'අක්‍රිය');
      cls(chip, 'on', !!S.bot.running);
    }
    var line = $('btBatLine');
    if (line) {
      var bits = [];
      bits.push(L('Wake lock', 'Wake lock') + ': ' + (R.wakeLock ? L('ON (screen stays awake)', 'ON (තිරය දැල්වී තිබේ)') : L('off — the phone can sleep', 'අක්‍රිය — දුරකථනයට නිදාගත හැක')));
      if (R.battery) bits.push(L('Battery', 'බැටරි') + ': ' + Math.round(R.battery.level * 100) + '%' + (R.battery.charging ? ' · ' + L('charging', 'ආරෝපණය වෙමින්') : ''));
      bits.push(L('Scan every', 'පරීක්ෂා කරන්නේ') + ' ' + Math.round(botTickMs() / 1000) + 's');
      bits.push(R.native ? L('Android app — live orders can be signed', 'Android යෙදුම — සජීවී ඇණවුම් අත්සන් කළ හැක') : L('Browser — paper only', 'බ්‍රවුසරය — පේපර් පමණි'));
      line.textContent = bits.join(' · ');
    }
    show($('btWebNote'), !R.native);
    var testBtn = $('btTest');
    if (testBtn) testBtn.disabled = !S.bot.running;
  }

  function readBattery() {
    if (!navigator.getBattery) return Promise.resolve();
    return navigator.getBattery().then(function (b) {
      R.battery = { level: b.level, charging: b.charging };
      var upd = function () { R.battery = { level: b.level, charging: b.charging }; render247(); };
      b.addEventListener('levelchange', upd);
      b.addEventListener('chargingchange', upd);
      render247();
    }).catch(function () { });
  }

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  function renderSettings() {
    setVal('setLang', S.lang);
    syncSwitch('setSound', S.settings.sound);
    syncSwitch('setHaptic', S.settings.haptic);
    syncSwitch('setTts', S.settings.tts);
    syncSwitch('setKeep', S.settings.keep);
    var exSel = $('setEx');
    if (exSel && !exSel.options.length) {
      html(exSel, Object.keys(EX).map(function (k) { return '<option value="' + k + '">' + esc(EX[k].name) + '</option>'; }).join(''));
    }
    if (exSel) exSel.value = S.exchange;
    syncSwitch('setTestnet', S.testnet);
    setVal('setKey', S.keys.key);
    setVal('setSecret', S.keys.secret);
    setVal('setAiProvider', S.ai.provider);
    setVal('setAiKey', S.ai.key);
    setVal('setAiModel', S.ai.model);
    setVal('setAiBase', S.ai.base);
    show($('aiBaseWrap'), S.ai.provider === 'custom');
    show($('aiKeyWrap'), S.ai.provider !== 'off');
    txt($('setVersion'), APP.version + ' · ' + (R.native ? 'android' : 'web'));
    txt($('setEngine'), 'TA ' + TA.version + ' · ' + L('Patterns', 'රටා') + ' ' + Patterns.version + ' · ' + L('Brain', 'මොළය') + ' ' + Brain.version);
    txt($('setRuntime'), (R.native ? L('Android app (native HTTP)', 'Android යෙදුම (දේශීය HTTP)') : L('Browser', 'බ්‍රවුසරය')) + ' · ' +
      (R.conn === 'live' ? L('live data', 'සජීවී දත්ත') : R.conn === 'demo' ? L('demo data', 'ආදර්ශන දත්ත') : L('offline', 'නොබැඳි')));
  }

  function readSettings() {
    S.settings.sound = $('setSound').classList.contains('on');
    S.settings.haptic = $('setHaptic').classList.contains('on');
    S.settings.tts = $('setTts').classList.contains('on');
    S.settings.keep = $('setKeep').classList.contains('on');
    S.testnet = $('setTestnet').classList.contains('on');
    S.ai.provider = val('setAiProvider', 'off');
    S.ai.model = val('setAiModel', S.ai.model);
    S.ai.base = val('setAiBase', '');
    show($('aiBaseWrap'), S.ai.provider === 'custom');
    show($('aiKeyWrap'), S.ai.provider !== 'off');
    save();
    setWake();
  }

  function saveKeys() {
    S.keys.key = (val('setKey', '') || '').trim();
    S.keys.secret = (val('setSecret', '') || '').trim();
    save();
    var st = $('setKeyStatus');
    if (st) st.textContent = (S.keys.key && S.keys.secret)
      ? L('Saved on this device. Enable trade-only permissions on the exchange side.', 'මෙම උපාංගයේ සුරැකුණා. හුවමාරු පැත්තේ වෙළඳාම්-පමණක් අවසර සක්‍රිය කරන්න.')
      : L('Keys cleared.', 'යතුරු මකා දමන ලදී.');
    renderTrade();
    toast(L('API keys saved', 'API යතුරු සුරැකුණා'), 'ok');
  }
  function clearKeys() {
    confirmBox(L('Delete the API keys?', 'API යතුරු මකන්නද?'),
      L('The keys stored on this device are erased. Open positions in the paper book are kept.', 'මෙම උපාංගයේ සුරැකුණු යතුරු මැකේ. පේපර් ගිණුමේ විවෘත ස්ථාන රැඳේ.'),
      function () {
        S.keys.key = ''; S.keys.secret = '';
        setVal('setKey', ''); setVal('setSecret', '');
        save();
        txt($('setKeyStatus'), L('Deleted.', 'මකා දමන ලදී.'));
        renderTrade();
        toast(L('Keys deleted', 'යතුරු මකා දමන ලදී'), 'ok');
      });
  }
  function resetPaper() {
    confirmBox(L('Reset the paper account?', 'පේපර් ගිණුම නැවත සකසන්නද?'),
      L('Balance goes back to 10,000 USDT and all positions, orders and history are deleted. This cannot be undone.',
        'ශේෂය නැවත 10,000 USDT වන අතර සියලු ස්ථාන, ඇණවුම් සහ ඉතිහාසය මැකේ. මෙය අහෝසි කළ නොහැක.'),
      function () {
        S.paper = { cash: 10000, start: 10000, positions: [], orders: [], history: [], equity: [{ t: Date.now(), v: 10000 }], feePct: S.paper.feePct };
        S.bot.stats = { trades: 0, wins: 0, losses: 0, pnl: 0, scans: S.bot.stats.scans, entries: 0, exits: 0, dca: 0 };
        save(); renderAll();
        toast(L('Paper account reset to 10,000 USDT', 'පේපර් ගිණුම 10,000 USDT ට සකසන ලදී'), 'ok');
      });
  }
  function wipeAll() {
    confirmBox(L('Erase everything?', 'සියල්ල මකන්නද?'),
      L('Settings, keys, alerts, brain weights, bot log and the whole paper account are deleted from this device.',
        'සැකසුම්, යතුරු, ඇඟවීම්, මොළයේ බර, බොට් ලොග් සහ මුළු පේපර් ගිණුම මෙම උපාංගයෙන් මැකේ.'),
      function () {
        try { global.localStorage.removeItem(STORE_KEY); } catch (e) { }
        global.location.reload();
      });
  }

  /* =====================================================================
     REFRESH / RENDER ORCHESTRATION
     ===================================================================== */
  function refresh(force) {
    first_ = false;
    return Promise.all([fetchTickers(force), fetchCandles(S.symbol, S.tf, 300)]).then(function (res) {
      var entry = res[1];
      R.tickers = res[0];
      renderTicker();
      var last = entry.cd[entry.cd.length - 1];
      R.lastPrice = last.c;
      /* keep every position's mark price fresh from the ticker book */
      S.paper.positions.forEach(function (p) {
        var px = priceOf(p.sym);
        if (isFinite(px)) p.mark = px;
      });
      checkAlerts(last.c);
      renderMarkets();
      drawChart();
      renderSignals();
      renderTrade();
      managePositions();
      checkOrders();
      if (R.sys && R.sys.pulse) R.sys.pulse('feed');
      return entry;
    }).catch(function (e) {
      console.warn('refresh failed', e);
      setConn('demo', L('demo data', 'ආදර්ශන දත්ත'));
      var cd = demoCandles(S.symbol, S.tf, 200);
      setCandles(S.symbol, S.tf, cd, true);
      if (!R.tickers.length) R.tickers = demoTickers();
      R.lastPrice = cd[cd.length - 1].c;
      renderTicker(); renderMarkets(); drawChart(); renderSignals(); renderTrade();
    });
  }
  APP.refresh = refresh;

  function renderAll() {
    applyI18n();
    renderTicker();
    renderMarkets();
    drawChart();
    renderSignals();
    renderTrade();
    renderBot();
    renderSettings();
    renderAlerts();
    render247();
    renderBadge();
    if (R.sys && R.sys.render) R.sys.render();
  }
  APP.renderAll = renderAll;

  /* =====================================================================
     EVENT WIRING
     ===================================================================== */
  function wire() {
    /* nav + tabs */
    $$('#nav button').forEach(function (b) {
      on(b, 'click', function () { buzz(6); goTab(b.getAttribute('data-tab')); });
    });

    /* header */
    on($('langBtn'), 'click', function () { setLang(S.lang === 'si' ? 'en' : 'si'); beep(1020, 0.08); });
    on($('setBtn'), 'click', function () { renderSettings(); openModal('setModal'); });
    on($('connBox'), 'click', function () { refresh(true).then(function () { toast(L('Market data refreshed', 'වෙළඳපොළ දත්ත නැවුම් කළා'), 'ok'); }); });

    /* modal close buttons + backdrop */
    $$('[data-close]').forEach(function (b) { on(b, 'click', function () { closeModal(b.getAttribute('data-close')); }); });
    $$('.modal').forEach(function (m) { on(m, 'click', function (ev) { if (ev.target === m) m.classList.remove('on'); }); });
    on($('okYes'), 'click', function () { closeModal('okModal'); if (okCb) { var cb = okCb; okCb = null; cb(); } });

    /* markets */
    on($('mSearch'), 'input', debounce(renderMarkets, 160));
    on($('mReload'), 'click', function () { buzz(8); refresh(true).then(function () { toast(L('Reloaded', 'නැවත පූරණය කළා'), 'ok'); }); });
    $$('#mChips .chip').forEach(function (c) {
      on(c, 'click', function () {
        S.sort = c.getAttribute('data-sort');
        $$('#mChips .chip').forEach(function (x) { cls(x, 'on', x === c); });
        save(); renderMarkets(); buzz(6);
      });
    });
    on($('scanBtn'), 'click', startScan);
    on($('scanStop'), 'click', function () { R.scanCancel = true; });
    on($('mList'), 'click', function (ev) {
      var star = ev.target.closest ? ev.target.closest('[data-fav]') : null;
      if (star) { toggleFav(star.getAttribute('data-fav')); ev.stopPropagation(); return; }
      var row = ev.target.closest ? ev.target.closest('[data-sym]') : null;
      if (row) { buzz(10); setSymbol(row.getAttribute('data-sym')); goTab('chart'); }
    });
    on($('scanList'), 'click', function (ev) {
      var row = ev.target.closest ? ev.target.closest('[data-scansym]') : null;
      if (!row) return;
      closeModal('scanModal');
      setSymbol(row.getAttribute('data-scansym'));
      goTab('chart');
    });

    /* symbol sheet */
    on($('symBtn'), 'click', openSymbolSheet);
    on($('ordSymBtn'), 'click', openSymbolSheet);
    on($('symSearch'), 'input', debounce(function () { renderSymbolList(val('symSearch', '')); }, 140));
    on($('symList'), 'click', function (ev) {
      var star = ev.target.closest ? ev.target.closest('[data-fav]') : null;
      if (star) { toggleFav(star.getAttribute('data-fav')); ev.stopPropagation(); return; }
      var row = ev.target.closest ? ev.target.closest('[data-pick]') : null;
      if (row) { closeModal('symModal'); buzz(10); setSymbol(row.getAttribute('data-pick')); goTab('chart'); }
    });

    /* chart */
    $$('#tfChips .chip').forEach(function (c) {
      on(c, 'click', function () {
        S.tf = c.getAttribute('data-tf');
        $$('#tfChips .chip').forEach(function (x) { cls(x, 'on', x === c); });
        save(); buzz(6);
        R.sig = null; R.ctx = null;
        refresh(false).then(drawChart);
      });
    });
    $$('#indChips .chip').forEach(function (c) {
      on(c, 'click', function () {
        var k = c.getAttribute('data-ind');
        S.inds[k] = !S.inds[k];
        cls(c, 'on', S.inds[k]);
        save(); drawChart(); buzz(5);
      });
    });
    var cv = $('chart');
    if (cv) {
      on(cv, 'pointerdown', chartPointer);
      on(cv, 'pointermove', function (ev) { if (ev.buttons || ev.pointerType === 'touch') chartPointer(ev); });
      on(cv, 'pointerup', chartLeave);
      on(cv, 'pointercancel', chartLeave);
      on(cv, 'pointerleave', chartLeave);
    }
    on($('alertBtn'), 'click', openAlertSheet);
    on($('sigBtn'), 'click', function () { buzz(10); goTab('signals'); refresh(false).then(renderSignals); });
    on($('chartTradeBtn'), 'click', function () { buzz(10); goTab('trade'); });
    on(global, 'resize', debounce(function () { drawChart(); drawEquity(); }, 180));

    /* alerts */
    on($('alertAdd'), 'click', addAlert);
    on($('alertList'), 'click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-delalert]') : null;
      if (!b) return;
      var id = b.getAttribute('data-delalert');
      S.alerts = S.alerts.filter(function (a) { return a.id !== id; });
      save(); renderAlerts();
    });

    /* signals */
    on($('mtfBtn'), 'click', function () { buzz(8); runMtf(); });
    on($('aiBtn'), 'click', generateAi);
    on($('btBtn'), 'click', runBacktest);

    /* trade */
    $$('#modeSeg button').forEach(function (b) {
      on(b, 'click', function () {
        var m = b.getAttribute('data-mode');
        if (m === 'live' && !liveReady()) {
          toast(L('Live trading needs Binance API keys in Settings — and the Android app to sign them', 'සජීවී වෙළඳාමට සැකසුම්වල Binance API යතුරු ඕනෑ — අත්සන් කිරීමට Android යෙදුමත් ඕනෑ'), 'bad', 4200);
          renderSettings(); openModal('setModal');
          return;
        }
        S.mode = m;
        $$('#modeSeg button').forEach(function (x) { cls(x, 'on', x === b); });
        save(); renderTrade(); buzz(10);
      });
    });
    $$('#typeSeg button').forEach(function (b) {
      on(b, 'click', function () {
        R.orderType = b.getAttribute('data-t');
        $$('#typeSeg button').forEach(function (x) { cls(x, 'on', x === b); });
        renderOrderForm(); buzz(5);
      });
    });
    $$('[data-pct]').forEach(function (b) {
      on(b, 'click', function () {
        var pctv = parseFloat(b.getAttribute('data-pct'));
        var eq = S.mode === 'paper' ? S.paper.cash : paperEquity();
        setVal('ordAmt', Math.floor(eq * pctv / 100 * 100) / 100);
        renderOrderForm(); buzz(6);
      });
    });
    ['ordAmt', 'ordTp', 'ordSl', 'ordPrice'].forEach(function (id) { on($(id), 'input', debounce(renderOrderForm, 140)); });
    on($('buyBtn'), 'click', function () { submitOrder('long'); });
    on($('sellBtn'), 'click', function () { submitOrder('short'); });
    on($('posList'), 'click', function (ev) {
      var c = ev.target.closest ? ev.target.closest('[data-close-pos]') : null;
      var tp = ev.target.closest ? ev.target.closest('[data-tp-pos]') : null;
      if (tp) {
        var id2 = tp.getAttribute('data-tp-pos');
        var p2 = S.paper.positions.filter(function (x) { return x.id === id2; })[0];
        if (!p2) return;
        var cur = p2.tp || 1.5;
        var next = prompt(L('New take-profit % (current ', 'නව ලාභ ඉලක්කය % (වත්මන් ') + F.pct(cur) + ')', String(cur));
        var nv = parseFloat(next);
        if (isFinite(nv) && nv > 0) { p2.tp = nv; save(); renderPositions(); toast(L('Take-profit set to ', 'ලාභ ඉලක්කය ') + F.pct(nv), 'ok'); }
        return;
      }
      if (!c) return;
      var id = c.getAttribute('data-close-pos');
      var pos = S.paper.positions.filter(function (x) { return x.id === id; })[0];
      if (!pos) return;
      confirmBox(L('Close position?', 'ස්ථානය වසන්නද?'),
        esc(pos.sym) + ' · ' + pos.side + ' · ' + F.qty(pos.qty) + ' @ ' + F.price(pos.entry) + '<br>' +
        L('Current P&L', 'වත්මන් P&L') + ': <b>' + F.usd(posPnl(pos).net) + ' USDT</b>',
        function () { closeTrade(pos, 'manual'); });
    });
    on($('ordList'), 'click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-cancel]') : null;
      if (b) cancelOrder(b.getAttribute('data-cancel'));
    });
    ['calcAcct', 'calcRisk', 'calcStop'].forEach(function (id) { on($(id), 'input', debounce(renderCalc, 160)); });
    on($('calcUse'), 'click', function () {
      var n = $('calcNotional').textContent;
      var v = parseFloat(String(n).replace(/[^0-9.]/g, ''));
      if (isFinite(v) && v > 0) { setVal('ordAmt', Math.round(v * 100) / 100); renderOrderForm(); toast(L('Amount set from the calculator', 'ගණකයෙන් ප්‍රමාණය සකසන ලදී'), 'ok'); }
      else toast(L('Fill the calculator first', 'මුලින් ගණකය පුරවන්න'), 'bad');
    });

    /* bot */
    on($('botStart'), 'click', startBot);
    on($('botStop'), 'click', function () { stopBot(L('by user', 'පරිශීලකයා විසින්')); });
    on($('botClear'), 'click', function () { S.bot.log = []; save(); renderBotLog(); });
    on($('bStrat'), 'change', function () { S.bot.strat = val('bStrat', 'ai'); save(); renderBot(); });
    on($('bTf'), 'change', function () { S.bot.tf = val('bTf', '5m'); save(); renderBot(); render247(); });
    on($('bExit'), 'change', function () { S.bot.exitMode = val('bExit', 'classic'); save(); renderBot(); });
    on($('bDca'), 'click', function () { S.bot.dca = !S.bot.dca; cls(this, 'on', S.bot.dca); save(); buzz(6); });
    on($('bVol'), 'click', function () { S.bot.volGuard = !S.bot.volGuard; cls(this, 'on', S.bot.volGuard); save(); buzz(6); });
    on($('bAiTp'), 'click', function () { S.bot.aiTp = !S.bot.aiTp; cls(this, 'on', S.bot.aiTp); save(); buzz(6); });
    bindSwitch('bShort', function () { return S.bot.allowShort; }, function (v) { S.bot.allowShort = v; });
    bindSwitch('bNotify', function () { return S.bot.notify; }, function (v) {
      S.bot.notify = v;
      if (v && global.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
    });
    bindSwitch('bKeep', function () { return S.bot.keepAwake; }, function (v) { S.bot.keepAwake = v; setWake(); render247(); });
    ['bSize', 'bTp', 'bSl', 'bMinP', 'bEntry', 'bDayT', 'bMaxHold', 'bDcaDrop', 'bDcaMax', 'bVolDrop', 'bMaxLoss', 'bMaxPos', 'bCool', 'bDaily']
      .forEach(function (id) { on($(id), 'change', function () { readBotForm(); renderBot(); }); });
    on($('bSymbols'), 'click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-bsym]') : null;
      if (b) {
        var sym = b.getAttribute('data-bsym');
        S.bot.symbols = S.bot.symbols.filter(function (x) { return x !== sym; });
        save(); renderBot(); return;
      }
      var add = ev.target.closest ? ev.target.closest('[data-bsym-add]') : null;
      if (add) { S.symbolPickerFor = 'bot'; renderSymbolList(''); openModal('symModal'); }
    });
    on($('brainTrain'), 'click', trainBrain);
    on($('brainReset'), 'click', resetBrain);

    /* cloud */
    on($('cloudSave'), 'click', function () {
      S.cloud.url = (val('cloudUrl', '') || '').trim();
      S.cloud.token = (val('cloudToken', '') || '').trim();
      save(); R.cloudMsg = L('Connection saved.', 'සම්බන්ධතාවය සුරැකුණා.'); renderCloud();
      toast(L('Cloud connection saved', 'ක්ලවුඩ් සම්බන්ධතාවය සුරැකුණා'), 'ok');
    });
    on($('cloudCheck'), 'click', cloudCheck);
    on($('cloudStart'), 'click', function () { cloudCmd('start'); });
    on($('cloudStop'), 'click', function () { cloudCmd('stop'); });

    /* 24/7 */
    on($('btBatFix'), 'click', function () {
      S.bot.keepAwake = false; S.settings.keep = false;
      syncSwitch('bKeep', false); syncSwitch('setKeep', false);
      setWake(false);
      save(); render247();
      botLog('warn', '🔋 ' + L('wake lock released — the phone can sleep after Stop', 'wake lock අත්හැරියා — Stop ට පසු දුරකථනයට නිදාගත හැක'));
      toast(L('Wake lock released. Android can now sleep; the exchange keeps your live sell order.', 'Wake lock අත්හැරියා. දුරකථනයට නිදාගත හැක; හුවමාරුව ඔබේ සජීවී විකුණුම් ඇණවුම රඳවා තබා ගනී.'), 'ok', 4200);
    });
    on($('btTest'), 'click', function () {
      if (!S.bot.running) { toast(L('Start the bot first', 'මුලින් බොට් අරඹන්න'), 'bad'); return; }
      confirmBox(L('Close the app now?', 'දැන් යෙදුම වසන්නද?'),
        L('The bot stops scanning. Paper positions stay in storage; live sell orders stay on the exchange.',
          'බොට් පරීක්ෂා කිරීම නවතී. පේපර් ස්ථාන ගබඩාවේ රැඳේ; සජීවී විකුණුම් ඇණවුම් හුවමාරුවේ රැඳේ.'),
        function () {
          stopBot(L('app closed', 'යෙදුම වසා දමන ලදී'));
          setWake(false);
          try {
            var cap = global.Capacitor;
            if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.App) cap.Plugins.App.exitApp();
            else global.close();
          } catch (e) { }
          setTimeout(function () { toast(L('If the app is still open, your browser blocked window.close().', 'යෙදුම තවමත් විවෘත නම්, ඔබේ බ්‍රවුසරය window.close() අවහිර කර ඇත.')); }, 400);
        });
    });

    /* settings */
    on($('setLang'), 'change', function () { setLang(val('setLang', 'en')); });
    bindSwitch('setSound', function () { return S.settings.sound; }, function (v) { S.settings.sound = v; if (v) beep(980, 0.12); });
    bindSwitch('setHaptic', function () { return S.settings.haptic; }, function (v) { S.settings.haptic = v; if (v) buzz(14); });
    bindSwitch('setTts', function () { return S.settings.tts; }, function (v) { S.settings.tts = v; if (v) speak(L('Voice alerts on', 'හඬ ඇඟවීම් සක්‍රියයි')); });
    bindSwitch('setKeep', function () { return S.settings.keep; }, function (v) { S.settings.keep = v; setWake(); render247(); });
    bindSwitch('setTestnet', function () { return S.testnet; }, function (v) { S.testnet = v; FILTERS = {}; });
    on($('setEx'), 'change', function () {
      S.exchange = val('setEx', 'binance');
      R.candles = {}; R.tickers = []; R.sig = null; R.ctx = null;
      save(); renderSettings();
      toast(L('Market data now comes from ', 'වෙළඳපොළ දත්ත දැන් ලැබෙන්නේ ') + ex().name, 'ok');
      refresh(true);
    });
    on($('setSaveKeys'), 'click', saveKeys);
    on($('setTestKeys'), 'click', testKeys);
    on($('setClearKeys'), 'click', clearKeys);
    on($('setAiProvider'), 'change', readSettings);
    on($('setAiModel'), 'change', readSettings);
    on($('setAiBase'), 'change', readSettings);
    on($('setAiKey'), 'change', function () { S.ai.key = (val('setAiKey', '') || '').trim(); save(); });
    on($('setResetPaper'), 'click', resetPaper);
    on($('setWipe'), 'click', wipeAll);
  }

  function submitOrder(side) {
    readBotForm();
    var usdt = numVal('ordAmt', 0);
    var tp = numVal('ordTp', 0) || null;
    var sl = numVal('ordSl', 0) || null;
    var px = priceOf(S.symbol);
    if (!(usdt > 0)) { toast(L('Enter an amount in USDT', 'USDT වලින් ප්‍රමාණයක් ඇතුළත් කරන්න'), 'bad'); return; }
    if (S.mode === 'live') {
      if (!liveReady()) { toast(L('Add Binance API keys in Settings first', 'මුලින් සැකසුම්වල Binance API යතුරු එක් කරන්න'), 'bad'); return; }
      if (!R.native) { toast(L('A browser cannot sign live orders — install the Android app', 'බ්‍රවුසරයකට සජීවී ඇණවුම් අත්සන් කළ නොහැක — Android යෙදුම ස්ථාපනය කරන්න'), 'bad', 4200); return; }
      confirmBox(L('Send a LIVE order?', 'සජීවී ඇණවුමක් යවන්නද?'),
        '<b>' + esc(S.symbol) + '</b> · ' + (side === 'long' ? 'BUY' : 'SELL') + ' · ' + F.usd(usdt) + ' USDT · ' +
        (R.orderType === 'limit' ? L('limit', 'සීමා') + ' @ ' + F.price(numVal('ordPrice', px)) : L('market', 'වෙළඳපොළ')) +
        '<br>' + L('Real money on ', 'සැබෑ මුදල් ') + esc(ex().name) + (S.testnet ? ' testnet' : '') + '.',
        function () {
          liveOrder(side, usdt, {
            type: R.orderType === 'limit' ? 'limit' : 'market',
            price: R.orderType === 'limit' ? numVal('ordPrice', px) : px, tp: tp, sl: sl
          });
        });
      return;
    }
    if (R.orderType === 'limit') {
      placeLimit(side === 'long' ? 'buy' : 'sell', usdt, numVal('ordPrice', NaN), { tp: tp, sl: sl });
      return;
    }
    openTrade(side, usdt, { price: px, tp: tp, sl: sl });
  }

  /* =====================================================================
     BOOT
     ===================================================================== */
  function detectRuntime() {
    try {
      var cap = global.Capacitor;
      R.native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      R.platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
    } catch (e) { R.native = false; R.platform = 'web'; }
  }

  function boot() {
    if (R.booted) return;
    R.booted = true;
    detectRuntime();
    load();

    /* first paint with whatever we already know */
    txt($('symName'), S.symbol);
    txt($('ordSym'), S.symbol);
    $$('#tfChips .chip').forEach(function (c) { cls(c, 'on', c.getAttribute('data-tf') === S.tf); });
    $$('#indChips .chip').forEach(function (c) { cls(c, 'on', !!S.inds[c.getAttribute('data-ind')]); });
    $$('#mChips .chip').forEach(function (c) { cls(c, 'on', c.getAttribute('data-sort') === S.sort); });
    $$('#modeSeg button').forEach(function (b) { cls(b, 'on', b.getAttribute('data-mode') === S.mode); });
    $$('#typeSeg button').forEach(function (b) { cls(b, 'on', b.getAttribute('data-t') === (R.orderType || 'market')); });
    setVal('setLang', S.lang);
    applyI18n();
    wire();
    renderAll();
    setConn('off', '');

    /* demo candles immediately so the chart is never empty while the
       network request is in flight */
    setCandles(S.symbol, S.tf, demoCandles(S.symbol, S.tf, 200), true);
    R.tickers = demoTickers();
    setConn('demo', L('connecting…', 'සම්බන්ධ වෙමින්…'));
    renderTicker(); renderMarkets(); drawChart(); renderSignals(); renderTrade();

    refresh(true).then(function () {
      if (R.conn === 'live') toast(L('Connected to ', '') + ex().name, 'ok', 2200);
      else toast(L('Using demo data — check the network', 'ආදර්ශන දත්ත භාවිතා කරයි — ජාලය පරීක්ෂා කරන්න'), 'bad', 3600);
    });

    readBattery();
    setWake();

    /* market tick */
    R.timers.tick = setInterval(function () {
      if (doc.hidden) return;
      refresh(false);
    }, 20000);
    /* equity + persistence heartbeat */
    R.timers.beat = setInterval(function () { pushEquity(); save(); if (R.tab === 'trade') drawEquity(); }, 30000);
    /* keep positions honest even when the tab is hidden */
    on(doc, 'visibilitychange', function () {
      if (!doc.hidden) { refresh(false); render247(); setWake(); }
    });

    botLog('', '🚀 ' + APP.name + ' v' + APP.version + ' · ' + (R.native ? 'android' : 'web') + ' · ' +
      L('engine', 'එන්ජිම') + ' TA ' + TA.version + ' / ' + L('Brain', 'මොළය') + ' ' + Brain.version);
    renderBotLog();
    goTab('markets');
    console.log('[CryptoAI PRO] booted', APP.version, R.native ? 'native' : 'web');
  }

  /* export */
  APP.renderMarkets = renderMarkets; APP.renderTrade = renderTrade; APP.renderBot = renderBot;
  APP.renderSignals = renderSignals; APP.drawChart = drawChart; APP.drawEquity = drawEquity;
  APP.startBot = startBot; APP.stopBot = stopBot; APP.openTrade = openTrade; APP.closeTrade = closeTrade;
  APP.paperEquity = paperEquity; APP.posPnl = posPnl; APP.botTickMs = botTickMs; APP.boot = boot;
  APP.DEFAULTS = DEFAULTS; APP.STORE_KEY = STORE_KEY; APP.computeSignal = computeSignal;
  global.App = APP;

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
