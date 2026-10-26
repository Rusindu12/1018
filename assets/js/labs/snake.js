import { SnakeEvolution, SNAKE } from '../core/snake.js';
import { initNav, fitCanvas, drawLineChart, revealOnScroll, toast, rafLoop, $ } from '../ui.js';

initNav();
revealOnScroll();

const canvas = $('#snakeCanvas');
const chartCanvas = $('#snakeChart');
const minis = [$('#mini1'), $('#mini2'), $('#mini3')];

let evo = new SnakeEvolution({ population: SNAKE.population, seed: (Math.random() * 1e6) | 0 });
let running = true;
let speed = 1; // generations per second multiplier → ticks per second
let accumulator = 0;
let evolveAt = null;
let flash = null;
let lastUi = 0;
let leaderIndex = 0;
let population = SNAKE.population;
let mutationRate = SNAKE.mutationRate;
let mutationScale = SNAKE.mutationScale;

const hudGen = $('#hudGen');
const hudAlive = $('#hudAlive');
const hudScore = $('#hudScore');
const statGen = $('#statGen');
const statAlive = $('#statAlive');
const statScore = $('#statScore');
const statRecord = $('#statRecord');
const statLength = $('#statLength');
const statBest = $('#statBest');
const pauseBtn = $('#pauseBtn');
const pauseIcon = $('#pauseIcon');
const pauseLabel = $('#pauseLabel');

const TICKS_PER_SECOND = 16; // 1× speed

function drawGrid(ctx, w, h, game, { mini = false } = {}) {
  const cell = Math.min(w / SNAKE.cols, h / SNAKE.rows);
  const ox = (w - cell * SNAKE.cols) / 2;
  const oy = (h - cell * SNAKE.rows) / 2;

  ctx.fillStyle = mini ? '#070b11' : '#070b11';
  ctx.fillRect(0, 0, w, h);

  if (!mini) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= SNAKE.cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell + 0.5, oy);
      ctx.lineTo(ox + x * cell + 0.5, oy + SNAKE.rows * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= SNAKE.rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell + 0.5);
      ctx.lineTo(ox + SNAKE.cols * cell, oy + y * cell + 0.5);
      ctx.stroke();
    }
  }

  if (!game) return;

  // food
  const fx = ox + game.food.x * cell + cell / 2;
  const fy = oy + game.food.y * cell + cell / 2;
  const pulse = 0.65 + Math.sin(performance.now() / 260) * 0.25;
  if (!mini) {
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, cell * 2.4);
    glow.addColorStop(0, `rgba(255,194,102,${0.34 * pulse})`);
    glow.addColorStop(1, 'rgba(255,194,102,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffc266';
  ctx.beginPath();
  ctx.arc(fx, fy, Math.max(1.4, cell * 0.3), 0, Math.PI * 2);
  ctx.fill();

  // snake
  const n = game.body.length;
  for (let i = n - 1; i >= 0; i -= 1) {
    const seg = game.body[i];
    const t = n === 1 ? 0 : i / (n - 1);
    const r = Math.max(0, Math.round(90 + (169 - 90) * t));
    const g = Math.max(0, Math.round(217 + (139 - 217) * t));
    const b = Math.max(0, Math.round(255 + (255 - 255) * t));
    ctx.fillStyle = game.alive
      ? `rgba(${r},${g},${b},${mini ? 0.85 : 0.45 + 0.55 * (1 - t)})`
      : `rgba(${r},${g},${b},0.25)`;
    const pad = mini ? 1 : Math.max(1, cell * 0.12);
    const size = cell - pad * 2;
    const x = ox + seg.x * cell + pad;
    const y = oy + seg.y * cell + pad;
    const rad = i === 0 ? Math.min(size / 2, cell * 0.34) : Math.min(size / 2, cell * 0.22);
    roundRect(ctx, x, y, size, size, rad);
    ctx.fill();
  }

  // eyes on the head
  if (n) {
    const head = game.body[0];
    const hx = ox + head.x * cell + cell / 2;
    const hy = oy + head.y * cell + cell / 2;
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][game.dir] || [1, 0];
    ctx.fillStyle = '#05121a';
    const off = cell * 0.16;
    const eyeR = mini ? 0.8 : Math.max(1, cell * 0.075);
    ctx.beginPath();
    ctx.arc(hx + dx * cell * 0.16 - dy * off, hy + dy * cell * 0.16 + dx * off, eyeR, 0, Math.PI * 2);
    ctx.arc(hx + dx * cell * 0.16 + dy * off, hy + dy * cell * 0.16 - dx * off, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function render() {
  const { ctx, w, h } = fitCanvas(canvas, canvas.clientHeight || 560);
  const board = evo.leaderboard;
  const game = board[Math.min(leaderIndex, board.length - 1)];
  drawGrid(ctx, w, h, game);

  if (!running) {
    ctx.fillStyle = 'rgba(5,9,14,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9eff7';
    ctx.font = '600 22px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('නතර කර ඇත', w / 2, h / 2 - 6);
    ctx.textAlign = 'left';
  }

  if (flash && performance.now() - flash.at < 1100) {
    const alpha = 1 - (performance.now() - flash.at) / 1100;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#b9ff5c';
    ctx.font = '600 15px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flash.text, w / 2, 30);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function renderMinis() {
  const board = evo.leaderboard;
  minis.forEach((mini, i) => {
    if (!mini) return;
    const { ctx, w, h } = fitCanvas(mini, mini.clientHeight || 90);
    drawGrid(ctx, w, h, board[i], { mini: true });
    const label = mini.parentElement.querySelector('.mini-score');
    if (label) label.textContent = board[i] ? `score ${board[i].score}` : '—';
  });
}

function updateUi(now) {
  if (now - lastUi < 140) return;
  lastUi = now;
  const best = evo.leaderboard[0];
  const gen = evo.generation + 1;
  hudGen.textContent = `GEN ${String(gen).padStart(3, '0')}`;
  hudAlive.textContent = `ALIVE ${evo.aliveCount}/${evo.games.length}`;
  hudScore.textContent = `SCORE ${best ? best.score : 0}`;
  statGen.textContent = gen;
  statAlive.textContent = evo.aliveCount;
  statScore.textContent = best ? best.score : 0;
  statRecord.textContent = evo.record;
  statLength.textContent = best ? best.body.length : SNAKE.startLength;
  statBest.textContent = Math.round(best ? best.fitness : 0).toLocaleString();
  renderMinis();
}

function updateChart() {
  drawLineChart(
    chartCanvas,
    [
      { data: evo.history.map((h) => h.best), color: '#b9ff5c', fill: true, width: 2 },
      { data: evo.history.map((h) => h.avg), color: '#5ad9ff', width: 1.3 },
    ],
    { padL: 38, ticks: 4, yMin: 0 }
  );
  $('#genCount').textContent = evo.history.length ? evo.history[evo.history.length - 1].gen + 1 : 0;
  $('#recordStat').textContent = evo.record;
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

$('#turboBtn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'පරම්පරා 10ක් පුහුණු වෙනවා…';
  setTimeout(() => {
    for (let i = 0; i < 10; i += 1) evo.runGeneration();
    updateChart();
    flash = { text: `පරම්පරාව ${evo.generation} · වාර්තාව ${evo.record}`, at: performance.now() };
    btn.disabled = false;
    btn.textContent = label;
    toast('පරම්පරා 10ක් එකවර අවසන්');
  }, 40);
});

$('#resetBtn').addEventListener('click', () => {
  evo = new SnakeEvolution({ population, seed: (Math.random() * 1e6) | 0, mutationRate, mutationScale });
  accumulator = 0;
  evolveAt = null;
  updateChart();
  flash = { text: 'නව ජනගහනයක් — මුල සිට', at: performance.now() };
  toast('අලුත් ජනගහනයක්');
});

document.querySelectorAll('[data-watch]').forEach((btn) => {
  btn.addEventListener('click', () => {
    leaderIndex = Number(btn.dataset.watch);
    document.querySelectorAll('[data-watch]').forEach((b) => b.classList.toggle('on', b === btn));
  });
});

const popRange = $('#popRange');
const mutRange = $('#mutRange');
const scaleRange = $('#scaleRange');
popRange.addEventListener('input', () => {
  population = Number(popRange.value);
  $('#popVal').textContent = population;
});
mutRange.addEventListener('input', () => {
  mutationRate = Number(mutRange.value) / 100;
  $('#mutVal').textContent = mutationRate.toFixed(2);
  evo.mutationRate = mutationRate;
});
scaleRange.addEventListener('input', () => {
  mutationScale = Number(scaleRange.value) / 100;
  $('#scaleVal').textContent = mutationScale.toFixed(2);
  evo.mutationScale = mutationScale;
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    setRunning(!running);
  }
});

rafLoop((dt) => {
  const now = performance.now();
  if (running) {
    if (speed <= 30) {
      accumulator = Math.min(accumulator + dt * speed * TICKS_PER_SECOND, 40);
      while (accumulator >= 1 && evo.aliveCount > 0) {
        evo.step();
        accumulator -= 1;
      }
    } else {
      // Turbo: consume the generation as fast as the frame allows.
      let budget = 4000;
      while (budget > 0 && evo.aliveCount > 0) {
        evo.step();
        budget -= 1;
      }
    }

    if (evo.aliveCount === 0) {
      if (evolveAt === null) {
        evolveAt = now;
        const best = evo.leaderboard[0];
        flash = { text: `පරම්පරාව ${evo.generation + 1} අවසන් · හොඳම score ${best ? best.score : 0}`, at: now };
      } else if (now - evolveAt > (speed > 30 ? 30 : 800)) {
        evo.evolve();
        evolveAt = null;
        updateChart();
      }
    } else {
      evolveAt = null;
    }
  }
  render();
  updateUi(now);
});

setSpeed(1);
updateChart();
render();
window.addEventListener('resize', updateChart);
window.__neuralabSnake = { get evo() { return evo; } };
