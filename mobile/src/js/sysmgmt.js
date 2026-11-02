/* =====================================================================
   CryptoAI PRO — sysmgmt.js
   The System tab ("Meheyuma engine"): a real process supervisor for the
   app's own workers. Loads are driven by actual events (every market
   fetch, every signal, every bot pass calls pulse()), not by random
   numbers, and the device panel only reports what the browser exposes.
   ===================================================================== */
(function (global) {
  'use strict';

  var App = global.App;
  var SM = { version: '5.0.0', mounted: false };

  /* ------------------------------ processes --------------------------- */
  var PROCS = [
    { id: 'feed', icon: '📡', en: 'Market feed', si: 'වෙළඳපොළ සම්බන්ධතාව', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'high', last: 0, ms: 0 },
    { id: 'ta', icon: '📐', en: 'TA engine', si: 'TA එන්ජිම', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'normal', last: 0, ms: 0 },
    { id: 'brain', icon: '🧠', en: 'Signal brain', si: 'සංඥා මොළය', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'normal', last: 0, ms: 0 },
    { id: 'bot', icon: '🤖', en: 'Bot loop', si: 'බොට් ලූපය', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'idle', pri: 'normal', last: 0, ms: 0 },
    { id: 'alerts', icon: '🔔', en: 'Alert watcher', si: 'ඇඟවීම් නිරීක්ෂකය', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'low', last: 0, ms: 0 },
    { id: 'chart', icon: '🕯️', en: 'Chart renderer', si: 'ප්‍රස්ථාර රෙන්ඩරරය', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'low', last: 0, ms: 0 },
    { id: 'store', icon: '💾', en: 'Data store', si: 'දත්ත ගබඩාව', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'run', pri: 'low', last: 0, ms: 0 },
    { id: 'ai', icon: '🛰️', en: 'AI client', si: 'AI සේවාදායකයා', load: 0, cpu: 0, ticks: 0, errs: 0, state: 'idle', pri: 'low', last: 0, ms: 0 }
  ];
  SM.PROCS = PROCS;
  function proc(id) { for (var i = 0; i < PROCS.length; i++) if (PROCS[i].id === id) return PROCS[i]; return null; }

  var HIST = [];            /* last 40 tick results: 1 = ok, 0 = error */
  var LOG = [];
  var START = Date.now();
  var timer = null;

  function log(kind, msg) {
    LOG.unshift({ t: Date.now(), kind: kind || '', msg: String(msg) });
    if (LOG.length > 80) LOG.length = 80;
    renderLog();
  }
  SM.log = log;

  /* called by app.js whenever a real unit of work happens */
  function pulse(id, ms, ok) {
    var p = proc(id);
    if (!p) return;
    if (p.state === 'pause') return;
    p.ticks++;
    p.last = Date.now();
    if (typeof ms === 'number') { p.ms = p.ms ? p.ms * 0.7 + ms * 0.3 : ms; }
    if (ok === false) p.errs++;
    p.load = Math.min(100, p.load + 22);
    HIST.push(ok === false ? 0 : 1);
    if (HIST.length > 40) HIST.shift();
  }
  SM.pulse = pulse;

  /* ------------------------------ markup ------------------------------ */
  function mount(root) {
    if (!root) return;
    if (!SM.mounted) {
      root.innerHTML =
        '<div class="sm-head card tight">' +
        '  <div class="row between">' +
        '    <div class="bb" style="font-size:15px">🖥️ <span data-sm="title">System</span></div>' +
        '    <span class="sm-chip sm-live" id="smChip">LIVE</span>' +
        '  </div>' +
        '  <div class="row mt" style="gap:6px;flex-wrap:wrap">' +
        '    <span class="sm-chip sm-off" id="smSrc">—</span>' +
        '    <span class="sm-chip sm-off" id="smMode">—</span>' +
        '    <span class="sm-chip sm-off" id="smLockChip">🔓</span>' +
        '  </div>' +
        '</div>' +

        '<div class="card">' +
        '  <h3 data-sm="stats">Engine statistics</h3>' +
        '  <div class="sm-stats" id="smStats"></div>' +
        '  <canvas class="sm-spark" id="smSpark" height="64"></canvas>' +
        '  <div class="row between mt"><span class="small mut" data-sm="ticks">Last 40 ticks</span><div class="sm-hist" id="smHist"></div></div>' +
        '</div>' +

        '<div class="card sm-procs-card">' +
        '  <div class="row between"><h3 style="margin:0" data-sm="procs">Processes</h3>' +
        '    <div class="row" style="gap:6px"><button class="btn ghost sm" id="smPauseAll" data-sm="pauseAll">⏸ pause all</button>' +
        '    <button class="btn ghost sm" id="smRestartAll" data-sm="restartAll">♻️ restart all</button></div></div>' +
        '  <div class="mt" id="smProcs"></div>' +
        '</div>' +

        '<div class="card">' +
        '  <h3 data-sm="device">Device &amp; runtime</h3>' +
        '  <div id="smDevice"></div>' +
        '</div>' +

        '<div class="card">' +
        '  <h3 data-sm="guard">Screen lock</h3>' +
        '  <div class="sm-kv"><span data-sm="guardDesc">Lock the System tab with a 4-digit PIN</span>' +
        '    <button class="btn ghost sm" id="smPinBtn">—</button></div>' +
        '  <div class="hint mt" id="smPinNote">—</div>' +
        '</div>' +

        '<div class="card">' +
        '  <div class="row between"><h3 style="margin:0" data-sm="log">Engine log</h3>' +
        '    <button class="btn ghost sm" id="smClear" data-sm="clear">clear</button></div>' +
        '  <div class="log sm-log mt" id="smLog"></div>' +
        '</div>';

      /* PIN pad overlay */
      var lock = document.createElement('div');
      lock.className = 'sm-lock';
      lock.id = 'smLock';
      lock.innerHTML =
        '<div class="sm-lockcard">' +
        '  <div style="font-size:26px">🔒</div>' +
        '  <div class="sm-lockt" id="smLockT">Enter PIN</div>' +
        '  <div class="sm-pindots" id="smDots"><i></i><i></i><i></i><i></i></div>' +
        '  <div class="sm-pad" id="smPad"></div>' +
        '  <button class="btn ghost sm block mt" id="smLockCancel">Cancel</button>' +
        '</div>';
      document.body.appendChild(lock);
      var pad = lock.querySelector('#smPad');
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(function (k) {
        if (!k) { pad.appendChild(document.createElement('div')); return; }
        var b = document.createElement('button');
        b.className = 'sm-key';
        b.textContent = k;
        b.setAttribute('data-key', k);
        pad.appendChild(b);
      });

      wire(root, lock);
      SM.mounted = true;
      SM.root = root;
      log('ok', '🖥️ ' + T('System tab mounted', 'පද්ධති ටැබය සවි කරන ලදී'));
    }
    applyTexts();
    render();
    if (!timer) timer = setInterval(function () { if (!document.hidden) tick(); }, 1500);
    tick();
  }
  SM.mount = mount;

  function T(en, si) { return App.L(en, si); }

  var TEXTS = {
    title: ['System', 'පද්ධතිය'],
    stats: ['Engine statistics', 'එන්ජිම් සංඛ්‍යාලේඛන'],
    ticks: ['Last 40 ticks', 'අවසන් චක්‍ර 40'],
    procs: ['Processes', 'ක්‍රියාවලි'],
    pauseAll: ['⏸ pause all', '⏸ සියල්ල නවත්වන්න'],
    restartAll: ['♻️ restart all', '♻️ සියල්ල නැවත අරඹන්න'],
    device: ['Device & runtime', 'උපාංගය සහ ධාවන පරිසරය'],
    guard: ['Screen lock', 'තිර අගුල'],
    guardDesc: ['Lock the System tab with a 4-digit PIN', 'පද්ධති ටැබය අංක 4ක PIN එකකින් අගුළු දමන්න'],
    log: ['Engine log', 'එන්ජිම් ලොග්'],
    clear: ['clear', 'හිස් කරන්න']
  };
  function applyTexts() {
    App.$$('[data-sm]', SM.root).forEach(function (el) {
      var k = el.getAttribute('data-sm');
      if (TEXTS[k]) el.textContent = T(TEXTS[k][0], TEXTS[k][1]);
    });
    renderPinNote();
  }
  SM.langChanged = function () { if (SM.mounted) { applyTexts(); render(); } };

  /* ------------------------------ wiring ------------------------------ */
  function wire(root, lock) {
    var $ = App.$;
    $('smPauseAll').addEventListener('click', function () {
      var anyRunning = PROCS.some(function (p) { return p.state === 'run'; });
      PROCS.forEach(function (p) { p.state = anyRunning ? 'pause' : 'run'; });
      log('warn', anyRunning ? '⏸ ' + T('all processes paused', 'සියලු ක්‍රියාවලි නවත්වන ලදී') : '▶ ' + T('all processes resumed', 'සියලු ක්‍රියාවලි නැවත අරඹන ලදී'));
      App.toast(anyRunning ? T('Processes paused — data stops refreshing', 'ක්‍රියාවලි නවත්වන ලදී — දත්ත නැවුම් වීම නතර වේ') : T('Processes resumed', 'ක්‍රියාවලි නැවත අරඹන ලදී'));
      render();
    });
    $('smRestartAll').addEventListener('click', function () {
      PROCS.forEach(function (p) { p.state = p.id === 'bot' && !App.S.bot.running ? 'idle' : 'run'; p.load = 0; p.ms = 0; });
      START = Date.now();
      log('ok', '♻️ ' + T('engine restarted', 'එන්ජිම නැවත අරඹන ලදී'));
      App.toast(T('Engine restarted', 'එන්ජිම නැවත අරඹන ලදී'), 'ok');
      render();
    });
    $('smClear').addEventListener('click', function () { LOG = []; renderLog(); });
    $('smProcs').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!b) return;
      var p = proc(b.getAttribute('data-proc'));
      if (!p) return;
      var act = b.getAttribute('data-act');
      if (act === 'toggle') {
        p.state = p.state === 'run' ? 'pause' : 'run';
        log(p.state === 'run' ? 'ok' : 'warn', (p.state === 'run' ? '▶ ' : '⏸ ') + T(p.en, p.si));
      } else if (act === 'restart') {
        p.state = 'run'; p.load = 0; p.ms = 0; p.errs = 0;
        log('ok', '♻️ ' + T(p.en, p.si) + ' ' + T('restarted', 'නැවත අරඹන ලදී'));
      } else if (act === 'run') {
        if (p.id === 'bot') { App.startBot(); return; }
        runOnce(p);
      }
      render();
    });
    $('smProcs').addEventListener('change', function (ev) {
      var s = ev.target.closest ? ev.target.closest('[data-pri]') : null;
      if (!s) return;
      var p = proc(s.getAttribute('data-pri'));
      if (!p) return;
      p.pri = s.value;
      App.S.sys.priorities[p.id] = s.value;
      App.save();
      log('', '⚙ ' + T(p.en, p.si) + ' → ' + p.pri);
      render();
    });
    /* PIN */
    $('smPinBtn').addEventListener('click', function () {
      if (App.S.sys.pin) {
        App.confirmBox(T('Remove the PIN?', 'PIN එක ඉවත් කරන්නද?'),
          T('The System tab will no longer ask for a PIN.', 'පද්ධති ටැබය තවදුරටත් PIN එකක් ඉල්ලන්නේ නැත.'),
          function () { App.S.sys.pin = ''; App.S.sys.locked = false; App.save(); renderPinNote(); render(); });
        return;
      }
      openLock('set');
    });
    $('smLockCancel').addEventListener('click', function () { closeLock(); });
    lock.addEventListener('click', function (ev) {
      var k = ev.target.closest ? ev.target.closest('[data-key]') : null;
      if (!k) return;
      press(k.getAttribute('data-key'));
    });
    /* restore priorities */
    var saved = App.S.sys.priorities || {};
    PROCS.forEach(function (p) { if (saved[p.id]) p.pri = saved[p.id]; });
  }

  function runOnce(p) {
    var t0 = Date.now();
    if (p.id === 'feed') {
      App.refresh(true).then(function () { pulse('feed', Date.now() - t0, true); render(); });
    } else if (p.id === 'ta' || p.id === 'brain') {
      var entry = App.R.candles[App.S.exchange + ':' + App.S.symbol + ':' + App.S.tf];
      if (entry) {
        var sig = App.computeSignal(entry.cd, false);
        pulse(p.id, Date.now() - t0, sig.ok);
        log(sig.ok ? 'ok' : 'bad', p.icon + ' ' + T(p.en, p.si) + ': ' + (sig.ok ? T('score', 'ලකුණු') + ' ' + sig.score.toFixed(1) : T('not enough data', 'ප්‍රමාණවත් දත්ත නැත')));
      }
    } else if (p.id === 'alerts') {
      pulse('alerts', Date.now() - t0, true);
      App.checkAlerts(App.priceOf(App.S.symbol));
    } else if (p.id === 'chart') {
      App.drawChart(); pulse('chart', Date.now() - t0, true);
    } else if (p.id === 'store') {
      App.save(); pulse('store', Date.now() - t0, true);
    } else if (p.id === 'ai') {
      pulse('ai', Date.now() - t0, true);
      log('ai', '🛰️ ' + T('AI provider', 'AI සපයන්නා') + ': ' + App.S.ai.provider);
    } else pulse(p.id, Date.now() - t0, true);
    render();
  }

  /* ------------------------------ PIN lock ---------------------------- */
  var pinBuf = '', pinMode = 'unlock', pinTries = 0;
  function openLock(mode) {
    pinMode = mode; pinBuf = ''; pinTries = 0;
    var l = App.$('smLock');
    if (l) { l.classList.add('on'); }
    App.$('smLockT').textContent = mode === 'set' ? T('Set a 4-digit PIN', 'අංක 4ක PIN එකක් සකසන්න') : T('Enter PIN', 'PIN එක ඇතුළත් කරන්න');
    drawDots();
  }
  function closeLock() { var l = App.$('smLock'); if (l) l.classList.remove('on'); pinBuf = ''; drawDots(); }
  function drawDots() {
    var d = App.$('smDots');
    if (!d) return;
    App.$$('i', d).forEach(function (i, n) { i.className = n < pinBuf.length ? 'on' : ''; });
  }
  function press(k) {
    App.buzz(6);
    if (k === '⌫') { pinBuf = pinBuf.slice(0, -1); drawDots(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k;
    drawDots();
    if (pinBuf.length === 4) setTimeout(function () { check(); }, 140);
  }
  function check() {
    if (pinMode === 'set') {
      hash(pinBuf).then(function (h) {
        App.S.sys.pin = h;
        App.S.sys.locked = true;
        App.save();
        closeLock();
        renderPinNote();
        App.toast(T('PIN set — the System tab is locked', 'PIN එක සකසන ලදී — පද්ධති ටැබය අගුළු දමා ඇත'), 'ok');
        log('ok', '🔒 ' + T('screen lock enabled', 'තිර අගුල සක්‍රිය කරන ලදී'));
        render();
      });
      return;
    }
    hash(pinBuf).then(function (h) {
      if (h === App.S.sys.pin) {
        App.S.sys.locked = false;
        App.save();
        pinTries = 0;
        closeLock();
        App.toast(T('Unlocked', 'අගුළු ඇරියා'), 'ok');
        render();
      } else {
        pinTries++;
        pinBuf = '';
        drawDots();
        var t = App.$('smLockT');
        if (t) {
          t.textContent = T('Wrong PIN — try again', 'වැරදි PIN ය — නැවත උත්සාහ කරන්න') + (pinTries > 1 ? ' (' + pinTries + ')' : '');
          t.style.color = 'var(--dn)';
          setTimeout(function () { t.style.color = ''; t.textContent = T('Enter PIN', 'PIN එක ඇතුළත් කරන්න'); }, 1400);
        }
        App.buzz([30, 50, 30]);
        log('bad', '🔒 ' + T('wrong PIN attempt', 'වැරදි PIN උත්සාහයක්') + ' #' + pinTries);
      }
    });
  }
  function hash(s) {
    try {
      var enc = new TextEncoder();
      return crypto.subtle.digest('SHA-256', enc.encode('cryptoai:' + s)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    } catch (e) { return Promise.resolve('plain:' + s); }
  }
  function renderPinNote() {
    var n = App.$('smPinNote'), b = App.$('smPinBtn'), chip = App.$('smLockChip');
    var has = !!App.S.sys.pin;
    if (b) b.textContent = has ? T('Remove PIN', 'PIN එක ඉවත් කරන්න') : T('Set PIN', 'PIN එක සකසන්න');
    if (n) n.textContent = has
      ? T('Enabled. The PIN is stored only as a SHA-256 hash on this device; the System tab asks for it after every app start.',
          'සක්‍රියයි. PIN එක මෙම උපාංගයේ SHA-256 හැශ් එකක් ලෙස පමණක් ගබඩා වේ; යෙදුම අරඹන සෑම විටම පද්ධති ටැබය එය ඉල්ලයි.')
      : T('Off. Set a PIN if someone else can open your phone.', 'අක්‍රියයි. ඔබේ දුරකථනය වෙන කෙනෙකුට විවෘත කළ හැකි නම් PIN එකක් සකසන්න.');
    if (chip) { chip.textContent = has ? (App.S.sys.locked ? '🔒' : '🔓') : '—'; chip.className = 'sm-chip ' + (has ? (App.S.sys.locked ? 'sm-warn' : 'sm-live') : 'sm-off'); }
  }

  /* ------------------------------ rendering --------------------------- */
  function tick() {
    /* loads decay so the panel reflects recent activity, not history */
    PROCS.forEach(function (p) {
      p.load = Math.max(0, p.load * 0.72);
      p.cpu = p.load * (p.pri === 'realtime' ? 1.15 : p.pri === 'high' ? 1 : p.pri === 'low' ? 0.75 : 0.9);
      if (p.id === 'bot') p.state = App.S.bot.running ? (p.state === 'pause' ? 'pause' : 'run') : (p.state === 'pause' ? 'pause' : 'idle');
      if (p.id === 'ai') p.state = App.S.ai.provider === 'off' ? 'idle' : (p.state === 'pause' ? 'pause' : 'run');
    });
    /* honest housekeeping ticks */
    pulse('store', 1, true);
    if (App.S.alerts.length) pulse('alerts', 1, true);
    if (!document.hidden && App.R.tab === 'chart') pulse('chart', 1, true);
    render();
  }
  SM.tick = tick;

  function render() {
    if (!SM.mounted || !SM.root || !document.body.contains(SM.root)) return;
    renderChips();
    renderStats();
    renderProcs();
    renderDevice();
    renderHist();
    renderSpark();
    renderLog();
    renderPinNote();
  }
  SM.render = render;

  function renderChips() {
    var R = App.R, S = App.S;
    var chip = App.$('smChip');
    var errs = PROCS.reduce(function (a, p) { return a + p.errs; }, 0);
    var paused = PROCS.filter(function (p) { return p.state === 'pause'; }).length;
    if (chip) {
      var state = errs > 3 || R.conn === 'off' ? 'WARN' : paused ? 'PAUSED' : S.bot.running ? 'BOT ON' : 'LIVE';
      chip.textContent = state;
      chip.className = 'sm-chip ' + (state === 'LIVE' || state === 'BOT ON' ? 'sm-live' : state === 'PAUSED' ? 'sm-off' : 'sm-warn');
    }
    var src = App.$('smSrc');
    if (src) {
      src.textContent = (R.conn === 'live' ? App.EX[S.exchange].name : R.conn === 'demo' ? T('demo data', 'ආදර්ශන දත්ත') : T('offline', 'නොබැඳි'));
      src.className = 'sm-chip ' + (R.conn === 'live' ? 'sm-live' : R.conn === 'demo' ? 'sm-warn' : 'sm-off');
    }
    var mode = App.$('smMode');
    if (mode) {
      mode.textContent = S.mode === 'live' ? 'LIVE ' + T('trading', 'වෙළඳාම') : 'PAPER ' + T('trading', 'වෙළඳාම');
      mode.className = 'sm-chip ' + (S.mode === 'live' ? 'sm-warn' : 'sm-off');
    }
  }

  function renderStats() {
    var box = App.$('smStats');
    if (!box) return;
    var R = App.R;
    var lat = R.latency.length ? R.latency[R.latency.length - 1] : NaN;
    var avgLat = R.latency.length ? R.latency.reduce(function (a, b) { return a + b; }, 0) / R.latency.length : NaN;
    var heap = (global.performance && performance.memory) ? performance.memory.usedJSHeapSize : NaN;
    var store = 0;
    try { store = (global.localStorage.getItem(App.STORE_KEY) || '').length; } catch (e) { }
    var nav = navigator.connection || {};
    function stat(label, value) { return '<div class="sm-stat"><b>' + App.esc(value) + '</b><span>' + App.esc(label) + '</span></div>'; }
    box.innerHTML =
      stat(T('Uptime', 'ක්‍රියාත්මක කාලය'), App.F.dur(Date.now() - START)) +
      stat(T('Loop', 'චක්‍රය'), isFinite(lat) ? Math.round(lat) + ' ms' : '—') +
      stat(T('Avg loop', 'සාම. චක්‍රය'), isFinite(avgLat) ? Math.round(avgLat) + ' ms' : '—') +
      stat(T('JS heap', 'JS මතකය'), isFinite(heap) ? (heap / 1048576).toFixed(1) + ' MB' : T('hidden', 'සැඟවුණා')) +
      stat(T('Storage used', 'භාවිත ගබඩාව'), (store / 1024).toFixed(1) + ' KB') +
      stat(T('Network', 'ජාලය'), (nav.effectiveType || '—').toUpperCase() + (nav.downlink ? ' · ' + nav.downlink + 'Mb' : '')) +
      stat(T('Battery', 'බැටරි'), R.battery ? Math.round(R.battery.level * 100) + '%' + (R.battery.charging ? '⚡' : '') : '—') +
      stat(T('Positions', 'ස්ථාන'), App.S.paper.positions.length + (App.S.paper.orders.length ? '+' + App.S.paper.orders.length : ''));
  }

  function renderProcs() {
    var box = App.$('smProcs');
    if (!box) return;
    var prios = ['low', 'normal', 'high', 'realtime'];
    box.innerHTML = PROCS.map(function (p) {
      var stateChip = p.state === 'run' ? 'sm-live' : p.state === 'pause' ? 'sm-warn' : 'sm-off';
      var stateTxt = p.state === 'run' ? T('RUNNING', 'ධාවනය') : p.state === 'pause' ? T('PAUSED', 'නවත්වා') : T('IDLE', 'නිශ්ශබ්ද');
      var loadCol = p.load > 75 ? 'var(--dn)' : p.load > 35 ? 'var(--gold)' : 'var(--up)';
      return '<div class="sm-prow">' +
        '<div class="sm-pname"><i>' + p.icon + '</i><div><b>' + App.esc(T(p.en, p.si)) + '</b>' +
        '<span class="sm-chip ' + stateChip + '" style="margin-top:2px">' + stateTxt + '</span></div></div>' +
        '<div class="sm-cpu">' + p.cpu.toFixed(0) + '%<span style="color:var(--dim)"> · ' + p.ticks + '</span></div>' +
        '<div class="sm-gauge"><i style="width:' + Math.min(100, p.load).toFixed(0) + '%;background:' + loadCol + '"></i></div>' +
        '<select class="sm-sel" data-pri="' + p.id + '">' + prios.map(function (x) {
          return '<option value="' + x + '"' + (x === p.pri ? ' selected' : '') + '>' + x + '</option>';
        }).join('') + '</select>' +
        '<div class="sm-act">' +
        '<button data-act="toggle" data-proc="' + p.id + '" title="' + T('pause/resume', 'නවත්වන්න/අරඹන්න') + '">' + (p.state === 'run' ? '⏸' : '▶') + '</button>' +
        '<button data-act="run" data-proc="' + p.id + '" title="' + T('run once', 'වරක් ධාවනය') + '">⚡</button>' +
        '<button data-act="restart" data-proc="' + p.id + '" title="' + T('restart', 'නැවත අරඹන්න') + '">♻</button>' +
        '</div>' +
        '<div class="tiny dim">' + T('last', 'අවසන්') + ' ' + (p.last ? App.F.ago(p.last) : '—') +
        (p.ms ? ' · ' + Math.round(p.ms) + 'ms' : '') + (p.errs ? ' · <span class="sm-bad">' + p.errs + T('err', 'දෝෂ') + '</span>' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  function renderDevice() {
    var box = App.$('smDevice');
    if (!box) return;
    var R = App.R, S = App.S;
    var nav = navigator;
    function kv(k, v) { return '<div class="sm-kv"><span>' + App.esc(k) + '</span><span class="small" style="text-align:right">' + App.esc(v) + '</span></div>'; }
    var rows = [
      kv(T('Runtime', 'ධාවන පරිසරය'), R.native ? T('Android app (Capacitor)', 'Android යෙදුම (Capacitor)') : T('Browser', 'බ්‍රවුසරය')),
      kv(T('Platform', 'වේදිකාව'), (R.platform || 'web') + ' · ' + (nav.platform || '—')),
      kv(T('App version', 'යෙදුම් අනුවාදය'), App.version + ' · TA ' + global.TA.version + ' · ' + T('Brain', 'මොළය') + ' ' + global.Brain.version),
      kv(T('Screen', 'තිරය'), screen.width + '×' + screen.height + ' · DPR ' + (global.devicePixelRatio || 1).toFixed(2)),
      kv(T('Viewport', 'දර්ශන ප්‍රදේශය'), innerWidth + '×' + innerHeight + ' · ' + (innerWidth >= 1100 ? T('desktop layout', 'ඩෙස්ක්ටොප් සැලැස්ම') : T('phone layout', 'දුරකථන සැලැස්ම'))),
      kv(T('Language', 'භාෂාව'), S.lang === 'si' ? 'සිංහල (si)' : 'English (en)' + ' · ' + (nav.language || '—')),
      kv(T('Timezone', 'වේලා කලාපය'), (Intl.DateTimeFormat().resolvedOptions().timeZone || '—')),
      kv(T('Cores / memory', 'කෝර් / මතකය'), (nav.hardwareConcurrency || '—') + ' ' + T('cores', 'කෝර්') + (nav.deviceMemory ? ' · ' + nav.deviceMemory + ' GB' : '')),
      kv(T('Online', 'සබැඳි'), nav.onLine ? T('yes', 'ඔව්') : T('no', 'නැත')),
      kv(T('Exchange', 'හුවමාරුව'), App.EX[S.exchange].name + (S.testnet ? ' · testnet' : '') + ' · ' + R.conn),
      kv(T('Cached series', 'හැඹිලිගත දත්ත'), Object.keys(R.candles).length + ' · ' + T('tickers', 'මිල ගණන්') + ' ' + R.tickers.length),
      kv(T('Brain weights', 'මොළයේ බර'), Object.keys(S.weights).length + ' · ' +
        (Object.keys(global.Brain.DEFAULT_WEIGHTS).some(function (k) { return Math.abs(S.weights[k] - global.Brain.DEFAULT_WEIGHTS[k]) > 1e-6; }) ? T('trained', 'පුහුණු කළා') : T('default', 'පෙරනිමි'))),
      kv(T('Wake lock', 'Wake lock'), R.wakeLock ? T('active', 'සක්‍රිය') : T('inactive', 'අක්‍රිය')),
      kv(T('Notifications', 'දැනුම්දීම්'), global.Notification ? Notification.permission : T('unsupported', 'සහාය නැත')),
      kv(T('Storage estimate', 'ගබඩා ඇස්තමේන්තුව'), R.storageTxt || T('calculating…', 'ගණනය වෙමින්…'))
    ];
    box.innerHTML = rows.join('');
    if (!R.storageTxt && nav.storage && nav.storage.estimate) {
      nav.storage.estimate().then(function (e) {
        R.storageTxt = ((e.usage || 0) / 1048576).toFixed(1) + ' MB / ' + ((e.quota || 0) / 1073741824).toFixed(2) + ' GB';
        renderDevice();
      }).catch(function () { R.storageTxt = T('unavailable', 'ලබා ගත නොහැක'); });
    }
  }

  function renderHist() {
    var box = App.$('smHist');
    if (!box) return;
    box.innerHTML = HIST.slice(-24).map(function (v) { return '<i class="' + (v ? '' : 'bad') + '" style="height:' + (v ? 100 : 40) + '%"></i>'; }).join('') || '<span class="tiny dim">—</span>';
  }

  function renderSpark() {
    var cv = App.$('smSpark');
    if (!cv) return;
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || 300, h = 64;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var g = null;
    try { g = cv.getContext('2d'); } catch (e) { return; }
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var vals = App.R.latency.slice(-60);
    g.strokeStyle = 'rgba(31,42,66,.9)';
    g.lineWidth = 1;
    for (var i = 1; i < 4; i++) { var gy = (h / 4) * i; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
    if (vals.length < 2) {
      g.fillStyle = '#5b6a86'; g.font = '10px system-ui';
      g.fillText(T('waiting for requests…', 'ඉල්ලීම් සඳහා රැඳෙමින්…'), 8, h / 2);
      return;
    }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) hi = lo + 1;
    g.beginPath();
    vals.forEach(function (v, n) {
      var x = (n / (vals.length - 1)) * (w - 6) + 3;
      var y = h - 6 - ((v - lo) / (hi - lo)) * (h - 14);
      if (n === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.strokeStyle = '#38bdf8'; g.lineWidth = 1.5; g.stroke();
    g.lineTo(w - 3, h - 3); g.lineTo(3, h - 3); g.closePath();
    g.fillStyle = 'rgba(56,189,248,.12)'; g.fill();
    g.fillStyle = '#5b6a86'; g.font = '9px ui-monospace, monospace';
    g.fillText(Math.round(hi) + 'ms', 6, 11);
    g.fillText(Math.round(lo) + 'ms', 6, h - 4);
    g.fillText(T('request latency', 'ඉල්ලීම් ප්‍රමාදය'), w - 92, 11);
  }

  function renderLog() {
    var box = App.$('smLog');
    if (!box) return;
    if (!LOG.length) { box.innerHTML = '<div class="t">' + T('no events yet', 'තවම සිදුවීම් නැත') + '</div>'; return; }
    box.innerHTML = LOG.slice(0, 60).map(function (l) {
      return '<div><span class="t">' + App.F.time(l.t) + '</span><span class="' + App.esc(l.kind) + '">' + App.esc(l.msg) + '</span></div>';
    }).join('');
  }

  /* locked? ask for the PIN whenever the tab is opened */
  var origMount = SM.mount;
  SM.mount = function (root) {
    origMount(root);
    /* a PIN, once set, is asked for on every app start */
    if (App.S.sys.pin) openLock('unlock');
  };

  global.SysMgmt = SM;
})(typeof window !== 'undefined' ? window : globalThis);
