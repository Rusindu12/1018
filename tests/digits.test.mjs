import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGlyph, normaliseGrid, makeDigitDataset, GRID } from '../assets/js/core/digits.js';
import { MLP } from '../assets/js/core/mlp.js';
import { mulberry32 } from '../assets/js/core/rng.js';

test('every digit renders ink inside a 16x16 grid', () => {
  const rng = mulberry32(3);
  for (let d = 0; d < 10; d += 1) {
    const g = renderGlyph(d, rng);
    const ink = g.reduce((a, b) => a + b, 0);
    assert.equal(g.length, GRID * GRID);
    assert.ok(ink > 10, `digit ${d} should contain ink, got ${ink}`);
    assert.ok(g.every((v) => v >= 0 && v <= 1));
  }
});

test('normalisation crops and centres a shifted glyph', () => {
  const g = new Float32Array(GRID * GRID);
  // A 4x4 block in the top-left corner.
  for (let y = 1; y < 5; y += 1) for (let x = 1; x < 5; x += 1) g[y * GRID + x] = 1;
  const out = normaliseGrid(g);
  let minX = GRID;
  let maxX = -1;
  let minY = GRID;
  let maxY = -1;
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (out[y * GRID + x] > 0.12) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  assert.ok(Math.abs(cx - (GRID - 1) / 2) <= 1.5, `expected centred ink, centre x was ${cx}`);
  assert.ok(Math.abs(cy - (GRID - 1) / 2) <= 1.5, `expected centred ink, centre y was ${cy}`);
  assert.ok(maxX - minX >= GRID - 5, `expected scaled ink, width was ${maxX - minX}`);
});

test('dataset is balanced and labelled', () => {
  const { X, y } = makeDigitDataset({ perClass: 5, seed: 9 });
  assert.equal(X.length, 50);
  assert.equal(y.length, 50);
  const counts = new Array(10).fill(0);
  for (const label of y) counts[label] += 1;
  assert.deepEqual(counts, new Array(10).fill(5));
});

test('a small MLP learns the synthetic digits', () => {
  const train = makeDigitDataset({ perClass: 40, seed: 42 });
  const net = new MLP([GRID * GRID, 64, 32, 10], { seed: 3 });
  for (let e = 0; e < 8; e += 1) {
    for (let i = 0; i < train.X.length; i += 32) {
      net.trainBatch(train.X.slice(i, i + 32), train.y.slice(i, i + 32), 0.0016);
    }
  }
  const probe = makeDigitDataset({ perClass: 4, seed: 123 });
  assert.ok(net.accuracy(probe.X, probe.y) > 0.8, `accuracy was ${net.accuracy(probe.X, probe.y)}`);
  assert.ok(net.lastLoss < 1.5);
});
