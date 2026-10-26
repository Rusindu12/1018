// Small shared helpers: canvas fitting, charts, reveal animations, toasts.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function fitCanvas(canvas, fixedHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width || canvas.clientWidth || 600);
  const cssH = Math.max(1, fixedHeight || rect.height || canvas.clientHeight || 400);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH, dpr };
}

export function niceMax(value, fallback = 1) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const m = value / base;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return step * base;
}

/** Simple multi-series line chart with an optional area fill. */
export function drawLineChart(canvas, series, opts = {}) {
  const { ctx, w, h } = fitCanvas(canvas, opts.height);
  ctx.clearRect(0, 0, w, h);
  const padL = opts.padL ?? 34;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const values = series.flatMap((s) => s.data.filter((v) => Number.isFinite(v)));
  let max = opts.yMax;
  if (!max) {
    const m = values.length ? Math.max(...values) : 1;
    max = niceMax(m, 1);
  }
  let min = opts.yMin ?? 0;
  if (max <= min) max = min + 1;

  // grid + y labels
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.fillStyle = 'rgba(160,175,195,0.55)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.lineWidth = 1;
  const ticks = opts.ticks ?? 4;
  for (let i = 0; i <= ticks; i += 1) {
    const y = padT + (innerH * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(padL, y + 0.5);
    ctx.lineTo(w - padR, y + 0.5);
    ctx.stroke();
    const v = max - ((max - min) * i) / ticks;
    ctx.fillText(formatTick(v), 4, y + 3);
  }
  ctx.restore();

  const count = Math.max(1, ...series.map((s) => s.data.length));
  const xAt = (i) => padL + (innerW * i) / Math.max(1, count - 1);
  const yAt = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;

  for (const s of series) {
    if (!s.data.length) continue;
    const color = s.color || '#b9ff5c';
    if (s.fill) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      grad.addColorStop(0, hexA(color, 0.24));
      grad.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(xAt(0), padT + innerH);
      s.data.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
      ctx.lineTo(xAt(s.data.length - 1), padT + innerH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = s.width || 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    if (s.dot && s.data.length <= 40) {
      ctx.fillStyle = color;
      s.data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(v), 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  return { max, min };
}

function formatTick(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(v === 0 ? 0 : 2);
}

function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function revealOnScroll(root = document) {
  const els = $$('.reveal', root);
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  els.forEach((el) => io.observe(el));
}

export function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  let stored = null;
  try {
    stored = localStorage.getItem('neuralab-theme');
  } catch {
    stored = null;
  }
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = stored || (prefersLight ? 'light' : 'dark');
  applyTheme(theme);

  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem('neuralab-theme', next);
    } catch {
      /* private mode — ignore */
    }
  });

  function applyTheme(next) {
    root.dataset.theme = next;
    if (!btn) return;
    btn.setAttribute('aria-label', next === 'light' ? 'අඳුරු තේමාවට මාරු වන්න' : 'ආලෝක තේමාවට මාරු වන්න');
    btn.title = btn.getAttribute('aria-label');
    btn.innerHTML = next === 'light'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke-linecap="round"/></svg>';
  }
}

export function initNav() {
  initTheme();
  const toggle = $('.nav-toggle');
  const links = $('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }
}

let toastTimer = null;
export function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export function rafLoop(fn) {
  let last = performance.now();
  let stopped = false;
  const tick = (now) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    stopped = true;
  };
}

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
