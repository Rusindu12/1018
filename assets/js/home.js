import { initNav, revealOnScroll, prefersReducedMotion, fitCanvas } from './ui.js';

initNav();
revealOnScroll();

/* Animated neural network in the hero, drawn with plain canvas 2D. */
const canvas = document.getElementById('heroCanvas');
if (canvas) {
  let { ctx, w, h } = fitCanvas(canvas, canvas.parentElement.clientHeight);
  const layers = [4, 7, 7, 5, 3];
  const nodes = [];
  const edges = [];
  const colors = ['#5ad9ff', '#b9ff5c', '#a98bff', '#5ad9ff', '#b9ff5c'];

  function build() {
    nodes.length = 0;
    edges.length = 0;
    const padX = w * 0.08;
    const spread = w * 0.84;
    layers.forEach((count, li) => {
      const x = padX + (spread * li) / (layers.length - 1);
      for (let i = 0; i < count; i += 1) {
        const y = h * 0.18 + ((h * 0.64) / Math.max(1, count - 1)) * i;
        nodes.push({
          x: x + (Math.random() - 0.5) * 26,
          y: y + (Math.random() - 0.5) * 18,
          r: 2 + Math.random() * 2.2,
          layer: li,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });
    for (let li = 0; li < layers.length - 1; li += 1) {
      const a = nodes.filter((n) => n.layer === li);
      const b = nodes.filter((n) => n.layer === li + 1);
      for (const from of a) {
        const sorted = [...b].sort((p, q) => Math.abs(p.y - from.y) - Math.abs(q.y - from.y));
        const take = 2 + Math.floor(Math.random() * 2);
        for (let k = 0; k < Math.min(take, sorted.length); k += 1) {
          if (Math.random() < 0.25) continue;
          edges.push({ from, to: sorted[k], t: Math.random(), speed: 0.06 + Math.random() * 0.12, color: colors[li] });
        }
      }
    }
  }
  build();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const fit = fitCanvas(canvas, canvas.parentElement.clientHeight);
      ctx = fit.ctx;
      w = fit.w;
      h = fit.h;
      build();
    }, 180);
  });

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);

    for (const e of edges) {
      ctx.strokeStyle = hexA(e.color, 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.stroke();

      e.t += e.speed * dt * 5;
      if (e.t > 1) e.t = 0;
      const px = e.from.x + (e.to.x - e.from.x) * e.t;
      const py = e.from.y + (e.to.y - e.from.y) * e.t;
      ctx.fillStyle = hexA(e.color, 0.55);
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      n.phase += dt * 1.4;
      const pulse = 0.65 + Math.sin(n.phase) * 0.35;
      const c = colors[n.layer];
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14);
      glow.addColorStop(0, hexA(c, 0.35 * pulse));
      glow.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = hexA(c, 0.5 + pulse * 0.5);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (prefersReducedMotion()) {
    draw(0);
  } else {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* count-up for the stats strip */
const counters = document.querySelectorAll('[data-count]');
if (counters.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const dur = 900;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    }
  }, { threshold: 0.5 });
  counters.forEach((c) => io.observe(c));
}
