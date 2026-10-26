import { MLP } from '../core/mlp.js';
import { CNN } from '../core/cnn.js';
import { renderGlyph, normaliseGrid, GRID, CLASSES } from '../core/digits.js';
import { mulberry32 } from '../core/rng.js';
import { initNav, revealOnScroll, drawLineChart, toast, $ } from '../ui.js';

initNav();
revealOnScroll();

const canvas = $('#drawCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const SIZE = 512;
canvas.width = SIZE;
canvas.height = SIZE;
const PAPER = '#f4f6f1';
const INK = '#101826';

const gridPreview = $('#gridPreview');
const gctx = gridPreview.getContext('2d');
gridPreview.width = 160;
gridPreview.height = 160;

const barsEl = $('#bars');
const predDigit = $('#predDigit');
const predConf = $('#predConf');
const statusEl = $('#trainStatus');
const progressEl = $('#progressBar');
const epochStat = $('#epochStat');
const accStat = $('#accStat');
const paramStat = $('#paramStat');
const sampleStat = $('#sampleStat');
const lossChart = $('#lossChart');
const samplesEl = $('#samples');
const teachBtn = $('#teachBtn');
const chipsEl = $('#teachChips');
const trainBtn = $('#retrainBtn');
const clearBtn = $('#clearBtn');

const MODELS = {
  mlp: { perClass: 70, epochs: 12, batch: 32, lr: 0.0016, hidden: [64, 32], testPerClass: 14 },
  cnn: { perClass: 55, epochs: 20, batch: 24, lr: 0.005, testPerClass: 8 },
};
let modelKind = 'mlp';
let config = MODELS[modelKind];

function makeModel(seed) {
  if (modelKind === 'cnn') return new CNN({ seed, lr: config.lr });
  return new MLP([GRID * GRID, ...config.hidden, 10], { seed, l2: 1e-4 });
}
const train = { X: [], y: [] };
const test = { X: [], y: [] };
let net = null;
let busy = false;
let lossHistory = [];
let accHistory = [];
let selectedLabel = null;
let manualLabel = false;
let hasInk = false;
let drawIdleTimer = null;
let lastPrediction = null;

/* ---------- drawing ---------- */
function resetCanvas() {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SIZE, SIZE);
  hasInk = false;
  $('#drawHint').classList.remove('hide');
  setPrediction(null);
  drawGridPreview(new Float32Array(GRID * GRID));
}

let drawing = false;
let lastPoint = null;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * SIZE,
    y: ((e.clientY - r.top) / r.height) * SIZE,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  lastPoint = pos(e);
  dot(lastPoint);
  hasInk = true;
  $('#drawHint').classList.add('hide');
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  e.preventDefault();
  const p = pos(e);
  stroke(lastPoint, p);
  lastPoint = p;
  if (drawIdleTimer) clearTimeout(drawIdleTimer);
  drawIdleTimer = setTimeout(predictNow, 180);
});

function endStroke(e) {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  if (e && e.pointerId) {
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  predictNow();
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', (e) => { if (drawing) endStroke(e); });

function dot({ x, y }) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
}

function stroke(a, b) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.quadraticCurveTo(a.x, a.y, mx, my);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

const off = document.createElement('canvas');
off.width = 64;
off.height = 64;
const offCtx = off.getContext('2d', { willReadFrequently: true });

/** Convert the drawing to the same 16×16 ink grid the network trained on. */
function rasterize() {
  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, 64, 64);
  offCtx.imageSmoothingEnabled = true;
  offCtx.imageSmoothingQuality = 'high';
  offCtx.drawImage(canvas, 0, 0, 64, 64);
  const img = offCtx.getImageData(0, 0, 64, 64).data;
  const small = new Float32Array(GRID * GRID);
  const block = 4;
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      let sum = 0;
      for (let by = 0; by < block; by += 1) {
        for (let bx = 0; bx < block; bx += 1) {
          const i = ((y * block + by) * 64 + (x * block + bx)) * 4;
          const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
          sum += Math.max(0, Math.min(1, (245 - lum) / 220));
        }
      }
      small[y * GRID + x] = sum / (block * block);
    }
  }
  return normaliseGrid(small);
}

function inkAmount(grid) {
  let s = 0;
  for (const v of grid) if (v > 0.15) s += v;
  return s;
}

function drawGridPreview(grid) {
  const n = GRID;
  const cell = 160 / n;
  gctx.fillStyle = '#05080c';
  gctx.fillRect(0, 0, 160, 160);
  gctx.strokeStyle = 'rgba(255,255,255,0.05)';
  gctx.lineWidth = 1;
  for (let i = 0; i <= n; i += 1) {
    gctx.beginPath();
    gctx.moveTo(i * cell + 0.5, 0);
    gctx.lineTo(i * cell + 0.5, 160);
    gctx.stroke();
    gctx.beginPath();
    gctx.moveTo(0, i * cell + 0.5);
    gctx.lineTo(160, i * cell + 0.5);
    gctx.stroke();
  }
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const v = grid[y * n + x];
      if (v < 0.02) continue;
      gctx.fillStyle = `rgba(185,255,92,${Math.min(1, v * 1.15)})`;
      gctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
    }
  }
}

/* ---------- predictions ---------- */
function setPrediction(result) {
  lastPrediction = result;
  if (!result) {
    predDigit.textContent = '–';
    predConf.textContent = 'පින්තූරයක් අඳින්න';
    barsEl.querySelectorAll('.bar-row').forEach((row) => {
      row.classList.remove('top');
      row.querySelector('.bar-fill').style.width = '0%';
      row.querySelector('.pct').textContent = '0%';
    });
    selectedLabel = null;
    syncChips();
    updateTeachLabel();
    return;
  }
  const { probs, index, confidence } = result;
  predDigit.textContent = String(index);
  predConf.textContent = `විශ්වාසය ${(confidence * 100).toFixed(1)}%`;
  barsEl.querySelectorAll('.bar-row').forEach((row, i) => {
    const p = probs[i];
    row.classList.toggle('top', i === index);
    row.querySelector('.bar-fill').style.width = `${Math.max(1, p * 100)}%`;
    row.querySelector('.pct').textContent = `${(p * 100).toFixed(0)}%`;
  });
  if (!manualLabel) {
    selectedLabel = index;
    syncChips();
    updateTeachLabel();
  }
}

function predictNow() {
  if (!net) return;
  const grid = rasterize();
  drawGridPreview(grid);
  hasInk = inkAmount(grid) > 2.5;
  if (!hasInk) {
    setPrediction(null);
    return;
  }
  setPrediction(net.predictClass(grid));
}

/* ---------- dataset + training ---------- */
const nextTick = () => new Promise((r) => setTimeout(r, 0));

function setStatus(text, progress = null) {
  statusEl.textContent = text;
  if (progress !== null) progressEl.style.width = `${Math.round(progress * 100)}%`;
}

async function buildAndTrain({ fresh = true, epochs = config.epochs } = {}) {
  epochs = config.epochs;
  if (busy) return;
  busy = true;
  train.X = [];
  train.y = [];
  test.X = [];
  test.y = [];
  lossHistory = [];
  accHistory = [];
  sampleStat.textContent = '0';
  epochStat.textContent = `0/${epochs}`;
  accStat.textContent = '–';
  trainBtn.disabled = true;
  teachBtn.disabled = true;
  setStatus('දත්ත සකස් වෙමින්…', 0.02);
  await nextTick();

  const rng = mulberry32(fresh ? (Math.random() * 1e9) | 0 : 4242);
  const total = 10 * config.perClass + 10 * config.testPerClass;
  let made = 0;

  for (let d = 0; d < 10; d += 1) {
    for (let i = 0; i < config.perClass; i += 1) {
      const jitter = i % 5 === 0;
      const g = renderGlyph(d, rng, jitter
        ? { rotation: 0.05, shear: 0.03, scale: 0.05, shift: 0.03 }
        : {});
      train.X.push(g);
      train.y.push(d);
      made += 1;
      if (made % 50 === 0) {
        setStatus(`දත්ත සකස් වෙමින්… ${made}`, 0.02 + (made / total) * 0.13);
        await nextTick();
      }
    }
  }
  for (let d = 0; d < 10; d += 1) {
    for (let i = 0; i < config.testPerClass; i += 1) {
      test.X.push(renderGlyph(d, mulberry32(9001 + i * 31 + d), {}));
      test.y.push(d);
    }
  }
  sampleStat.textContent = train.X.length.toLocaleString();

  net = makeModel(fresh ? (Math.random() * 1e6) | 0 : 11);
  paramStat.textContent = net.paramCount.toLocaleString();
  lossHistory = [net.lastLoss || Math.log(10)];
  accHistory = [0];

  for (let e = 0; e < epochs; e += 1) {
    const order = Array.from({ length: train.X.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < order.length; i += config.batch) {
      const idx = order.slice(i, i + config.batch);
      const bx = idx.map((k) => train.X[k]);
      const by = idx.map((k) => train.y[k]);
      net.trainBatch(bx, by, config.lr);
      if (i % (config.batch * 4) === 0) {
        const p = 0.15 + (e / epochs) * 0.85;
        setStatus(`පුහුණු වෙමින්… epoch ${e + 1}/${epochs}`, p);
        await nextTick();
      }
    }
    lossHistory.push(net.lastLoss);
    const acc = net.accuracy(test.X, test.y);
    accHistory.push(acc);
    epochStat.textContent = `${e + 1}/${epochs}`;
    accStat.textContent = `${(acc * 100).toFixed(1)}%`;
    drawLoss();
    setStatus(`පුහුණු වෙමින්… epoch ${e + 1}/${epochs} · loss ${net.lastLoss.toFixed(3)}`, 0.15 + ((e + 1) / epochs) * 0.85);
  }

  net.lastLoss = lossHistory[lossHistory.length - 1];
  setStatus(`සූදානම් · ${train.X.length.toLocaleString()} උදාහරණ · test නිරවද්‍යතාව ${(accHistory[accHistory.length - 1] * 100).toFixed(1)}%`, 1);
  trainBtn.disabled = false;
  teachBtn.disabled = false;
  busy = false;
  renderSamples();
  predictNow();
  toast('ආකෘතිය සූදානම්');
}

function drawLoss() {
  drawLineChart(lossChart, [{ data: lossHistory, color: '#5ad9ff', fill: true, width: 2 }], {
    padL: 30,
    ticks: 3,
    yMin: 0,
  });
}

function renderSamples() {
  samplesEl.innerHTML = '';
  for (let d = 0; d < 10; d += 1) {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    c.title = `උදාහරණය: ${d}`;
    const g = c.getContext('2d');
    g.fillStyle = '#060a0f';
    g.fillRect(0, 0, 48, 48);
    const sample = train.X[d * config.perClass + 3];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const v = sample[y * GRID + x];
        if (v > 0.02) {
          g.fillStyle = `rgba(185,255,92,${Math.min(1, v)})`;
          g.fillRect(x * 3, y * 3, 3, 3);
        }
      }
    }
    c.addEventListener('click', () => loadSample(d));
    samplesEl.appendChild(c);
  }
}

function loadSample(d) {
  const sample = train.X[d * config.perClass + 3];
  const img = offCtx;
  img.fillStyle = PAPER;
  img.fillRect(0, 0, 64, 64);
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const v = sample[y * GRID + x];
      if (v > 0.02) {
        img.fillStyle = `rgba(16,24,38,${Math.min(1, v)})`;
        img.fillRect(x * 4, y * 4, 4, 4);
      }
    }
  }
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, SIZE, SIZE);
  $('#drawHint').classList.add('hide');
  manualLabel = false;
  predictNow();
  toast(`උදාහරණය ${d} පූරණය විය`);
}

/* ---------- teaching ---------- */
function buildChips() {
  chipsEl.innerHTML = '';
  for (const label of CLASSES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.label = label;
    b.textContent = label;
    b.addEventListener('click', () => {
      manualLabel = true;
      selectedLabel = Number(label);
      syncChips();
      updateTeachLabel();
    });
    chipsEl.appendChild(b);
  }
}

function syncChips() {
  chipsEl.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('on', Number(c.dataset.label) === selectedLabel);
  });
}

function updateTeachLabel() {
  if (selectedLabel === null) {
    teachBtn.textContent = 'මේක උගන්වන්න';
  } else {
    teachBtn.textContent = `මේක “${selectedLabel}” ට උගන්වන්න`;
  }
}

teachBtn.addEventListener('click', async () => {
  if (busy || !net) return;
  const grid = rasterize();
  if (inkAmount(grid) < 2.5) {
    toast('මුලින්ම අංකයක් අඳින්න');
    return;
  }
  if (selectedLabel === null) {
    toast('හරි අංකය තෝරන්න');
    return;
  }
  busy = true;
  teachBtn.disabled = true;
  train.X.push(grid);
  train.y.push(selectedLabel);
  sampleStat.textContent = train.X.length.toLocaleString();
  setStatus(`ඔබේ උදාහරණය එකතු විය · නැවත පුහුණු වෙමින්…`, 0.3);
  await nextTick();
  const epochs = modelKind === 'cnn' ? 2 : 3;
  for (let e = 0; e < epochs; e += 1) {
    const idx = Array.from({ length: train.X.length }, (_, i) => i);
    for (let i = 0; i < idx.length; i += config.batch) {
      const slice = idx.slice(i, i + config.batch);
      net.trainBatch(slice.map((k) => train.X[k]), slice.map((k) => train.y[k]), config.lr * 0.8);
      if (i % (config.batch * 8) === 0) await nextTick();
    }
    setStatus(`ඔබේ දත්ත සමඟ පුහුණු වෙමින්… ${e + 1}/${epochs}`, 0.3 + ((e + 1) / epochs) * 0.7);
    await nextTick();
  }
  lossHistory.push(net.lastLoss);
  drawLoss();
  const acc = net.accuracy(test.X, test.y);
  accStat.textContent = `${(acc * 100).toFixed(1)}%`;
  setStatus(`ඔබේ උදාහරණය ඇතුළත් · test නිරවද්‍යතාව ${(acc * 100).toFixed(1)}%`, 1);
  teachBtn.disabled = false;
  busy = false;
  predictNow();
  toast('ඉගෙන ගත්තා — දැන් මේ වගේ එකක් හඳුනාගන්න පුළුවන්');
});

trainBtn.addEventListener('click', () => {
  if (busy) return;
  buildAndTrain({ fresh: true });
});
clearBtn.addEventListener('click', () => {
  manualLabel = false;
  resetCanvas();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && document.activeElement === document.body) {
    e.preventDefault();
    clearBtn.click();
  }
});

/* boot */
buildChips();
resetCanvas();
drawLoss();
buildAndTrain();

document.querySelectorAll('[data-model]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (busy || btn.dataset.model === modelKind) return;
    modelKind = btn.dataset.model;
    config = MODELS[modelKind];
    document.querySelectorAll('[data-model]').forEach((b) => b.classList.toggle('on', b === btn));
    $('#modelNote').textContent = modelKind === 'cnn'
      ? 'CNN: 6 + 12 filters · 20 epochs · ~4s (වඩා නිරවද්‍ය)'
      : 'MLP: 256→64→32→10 · 12 epochs · ~2s';
    buildAndTrain({ fresh: true });
  });
});
window.addEventListener('resize', () => drawLoss());
