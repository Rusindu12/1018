import { EvolutionSim, WORLD, Brain } from '../core/evolution.js';
import { initNav, fitCanvas, drawLineChart, revealOnScroll, toast, rafLoop, $ } from '../ui.js';
import { mulberry32 } from '../core/rng.js';

initNav();
revealOnScroll();

const canvas = $('#droneCanvas');
const chartCanvas = $('#fitnessChart');

let sim = new EvolutionSim({ population: 80, seed: 7, mutationRate: 0.12, mutationScale: 0.42 });
let running = true;
let speed = 4;
let pausedAt = null;
let evolveAt = null;
let flash = null;
let lastHud = 0;
let bestTrail = [];

const statGen = $('#statGen');
const statAlive = $('#statAlive');
const statGates = $('#statGates');
const statRecord = $('#statRecord');
const statBest = $('#statBest');
const hudGen = $('#hudGen');
const hudAlive = $('#hudAlive');
const hudAcc = $('#hudAcc');
const pauseBtn = $('#pauseBtn');
const pauseIcon = $('#pauseIcon');
const pauseLabel = $('#pauseLabel');

const stars = (() => {
  const rng = mulberry32(99);
  return Array.from({ length: 90 }, () => ({ x: rng(), y: rng(), r: rng() * 1.4 + 0.3, a: rng() * 0.5 + 0.08 }));
})();

function render() {
  const { ctx, w, h } = fitCanvas(canvas, canvas.clientHeight || 600);
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#070b12');
  bg.addColorStop(0.55, '#080e16');
  bg.addColorStop(1, '#05080d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // horizon glow
  const glow = ctx.createRadialGradient(w * 0.12, h * 0.52, 0, w * 0.12, h * 0.52, w * 0.5);
  glow.addColorStop(0, 'rgba(90,217,255,0.09)');
  glow.addColorStop(1, 'rgba(90,217,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // gates
  sim.gates.forEach((g) => {
    const x = g.x * sx;
    const gw = WORLD.gateWidth * sx;
    if (x + gw < -20) return;
    const topH = g.gapY * sy;
    const botY = (g.gapY + g.gap) * sy;

    const barGrad = ctx.createLinearGradient(x, 0, x + gw, 0);
    barGrad.addColorStop(0, 'rgba(185,255,92,0.16)');
    barGrad.addColorStop(0.5, 'rgba(185,255,92,0.5)');
    barGrad.addColorStop(1, 'rgba(90,217,255,0.18)');
    ctx.fillStyle = barGrad;
    roundRect(ctx, x, -10, gw, topH + 10, 8);
    ctx.fill();
    roundRect(ctx, x, botY, gw, h - botY + 10, 8);
    ctx.fill();

    // gate number / gap highlight
    ctx.strokeStyle = 'rgba(185,255,92,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x - 6, g.gapY * sy);
    ctx.lineTo(x + gw + 6, g.gapY * sy);
    ctx.moveTo(x - 6, botY);
    ctx.lineTo(x + gw + 6, botY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(185,255,92,0.55)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`G${g.id + 1}`, x + 4, 14);
  });

  // all agents (ghosts)
  const agents = sim.agents;
  for (let i = 0; i < agents.length; i += 1) {
    const a = agents[i];
    if (!a.alive) continue;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#5ad9ff';
    ctx.beginPath();
    ctx.arc(WORLD.agentX * sx, a.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // best agent
  const best = sim.best;
  if (best) {
    const bx = WORLD.agentX * sx;
    const by = best.y * sy;

    if (best.alive) {
      bestTrail.push(by);
      if (bestTrail.length > 55) bestTrail.shift();
    } else if (bestTrail.length) {
      bestTrail.shift();
    }

    if (bestTrail.length > 1) {
      ctx.strokeStyle = 'rgba(185,255,92,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      bestTrail.forEach((y, i) => {
        const x = bx - (bestTrail.length - i) * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const r = WORLD.radius * sx;
    const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, r * 4);
    g2.addColorStop(0, 'rgba(185,255,92,0.36)');
    g2.addColorStop(1, 'rgba(185,255,92,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(bx, by, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(bx, by);
    const angle = Math.max(-0.5, Math.min(0.5, best.vy / 900));
    ctx.rotate(angle);
    ctx.fillStyle = '#b9ff5c';
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r, r * 0.85);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(185,255,92,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, r * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // bottom gradient + hint
  const bottom = ctx.createLinearGradient(0, h - 80, 0, h);
  bottom.addColorStop(0, 'rgba(5,8,13,0)');
  bottom.addColorStop(1, 'rgba(5,8,13,0.9)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h - 80, w, 80);

  if (!running) {
    ctx.fillStyle = 'rgba(5,9,14,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9eff7';
    ctx.font = '600 22px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('නතර කර ඇත', w / 2, h / 2 - 8);
    ctx.fillStyle = 'rgba(160,175,195,0.7)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('SPACE', w / 2, h / 2 + 16);
    ctx.textAlign = 'left';
  }

  if (flash && performance.now() - flash.at < 900) {
    const alpha = 1 - (performance.now() - flash.at) / 900;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#b9ff5c';
    ctx.font = '600 16px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flash.text, w / 2, 44);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function updateHud(now) {
  if (now - lastHud < 120) return;
  lastHud = now;
  const best = sim.best;
  const acc = best ? Math.min(1, Math.max(0, best.out)) : 0;
  hudGen.textContent = `GEN ${String(sim.generation + 1).padStart(3, '0')}`;
  hudAlive.textContent = `ALIVE ${sim.aliveCount}/${sim.agents.length}`;
  hudAcc.textContent = `FLAP ${acc.toFixed(2)}`;
  statGen.textContent = sim.generation + 1;
  statAlive.textContent = sim.aliveCount;
  statGates.textContent = best ? best.gates : 0;
  statRecord.textContent = sim.record;
  statBest.textContent = Math.round(best ? best.fitness : 0).toLocaleString();
}

function updateChart() {
  drawLineChart(
    chartCanvas,
    [
      { data: sim.history.map((h) => h.best), color: '#b9ff5c', fill: true, width: 2 },
      { data: sim.history.map((h) => h.avg), color: '#5ad9ff', width: 1.4 },
    ],
    { padL: 36, ticks: 4, yMin: 0 }
  );
  $('#genCount').textContent = sim.history.length ? sim.history[sim.history.length - 1].gen + 1 : 0;
  $('#recordGates').textContent = sim.record;
}

function setRunning(next) {
  running = next;
  pauseBtn.setAttribute('aria-pressed', String(!next));
  pauseIcon.innerHTML = next
    ? '<path d="M8 5v14M16 5v14" stroke-linecap="round"/>'
    : '<path d="M8 5l11 7-11 7V5Z" stroke-linejoin="round" fill="currentColor"/>';
  pauseLabel.textContent = next ? 'නවත්වන්න' : 'දිගටම';
}

function setSpeed(next) {
  speed = next;
  document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === next));
}

pauseBtn.addEventListener('click', () => setRunning(!running));

document.querySelectorAll('[data-speed]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSpeed(Number(btn.dataset.speed));
    if (!running) setRunning(true);
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  const pop = Number($('#popRange').value);
  const mr = Number($('#mutRange').value) / 100;
  const ms = Number($('#scaleRange').value) / 100;
  sim = new EvolutionSim({ population: pop, seed: (Math.random() * 1e6) | 0, mutationRate: mr, mutationScale: ms });
  bestTrail = [];
  updateChart();
  flash = { text: 'නව ජනගහනයක් — මුල සිට', at: performance.now() };
  toast('නව ජනගහනයක් පිහිටුවා');
});

document.getElementById('turboBtn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'පරම්පරා 8ක් පුහුණු වෙනවා…';
  setTimeout(() => {
    for (let i = 0; i < 8; i += 1) sim.runGeneration();
    updateChart();
    bestTrail = [];
    flash = { text: `පරම්පරාව ${sim.generation} — වාර්තාව ${sim.record} gates`, at: performance.now() };
    btn.disabled = false;
    btn.textContent = orig;
    toast('පරම්පරා 8ක් එකවර අවසන්');
  }, 40);
});

// sliders
const mutRange = $('#mutRange');
const scaleRange = $('#scaleRange');
const popRange = $('#popRange');
mutRange.addEventListener('input', () => {
  $('#mutVal').textContent = (Number(mutRange.value) / 100).toFixed(2);
  sim.mutationRate = Number(mutRange.value) / 100;
});
scaleRange.addEventListener('input', () => {
  $('#scaleVal').textContent = (Number(scaleRange.value) / 100).toFixed(2);
  sim.mutationScale = Number(scaleRange.value) / 100;
});
popRange.addEventListener('input', () => {
  $('#popVal').textContent = popRange.value;
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    setRunning(!running);
  }
});

// main loop
let last = performance.now();
rafLoop(() => {
  const now = performance.now();
  const frameMs = now - last;
  last = now;
  const frames = Math.min(4, Math.max(1, Math.round(frameMs / 16.7)));

  if (running) {
    for (let f = 0; f < frames; f += 1) {
      for (let s = 0; s < speed; s += 1) {
        if (sim.aliveCount > 0) sim.step(1 / 60);
      }
      if (sim.aliveCount === 0) break;
    }
    if (sim.aliveCount === 0) {
      if (evolveAt === null) {
        evolveAt = now;
        const best = sim.best;
        flash = { text: `පරම්පරාව ${sim.generation + 1} අවසන් — හොඳම ${best ? best.gates : 0} gates`, at: now };
      } else if (now - evolveAt > 900) {
        sim.evolve();
        bestTrail = [];
        evolveAt = null;
        updateChart();
      }
    } else {
      evolveAt = null;
    }
  }
  render();
  updateHud(now);
});

setSpeed(4);
updateChart();
updateHud(0);
render();
window.addEventListener('resize', () => {
  updateChart();
});

// expose for debugging in the console
window.__neuralab = { get sim() { return sim; }, Brain, WORLD };
