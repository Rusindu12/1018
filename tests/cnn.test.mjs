import test from 'node:test';
import assert from 'node:assert/strict';
import { CNN, CNN_SHAPE } from '../assets/js/core/cnn.js';
import { makeDigitDataset, GRID } from '../assets/js/core/digits.js';
import { mulberry32, gaussian } from '../assets/js/core/rng.js';

test('a forward pass produces a probability distribution', () => {
  const net = new CNN({ seed: 1 });
  const x = new Float32Array(GRID * GRID).fill(0.5);
  const out = net.predict(x);
  assert.equal(out.length, 10);
  const sum = out.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-5);
  assert.ok(out.every((v) => v >= 0 && v <= 1));
});

test('parameter count matches the documented shape', () => {
  const net = new CNN({ seed: 1 });
  // conv1 6*9+6, conv2 12*6*9+12, dense 32*192+32, out 10*32+10
  assert.equal(net.paramCount, 6 * 9 + 6 + 12 * 6 * 9 + 12 + 32 * 192 + 32 + 10 * 32 + 10);
  assert.equal(net.paramCount, 7226);
  assert.equal(net.size, CNN_SHAPE.size);
});

test('same seed gives deterministic initialisation', () => {
  const a = new CNN({ seed: 9 });
  const b = new CNN({ seed: 9 });
  const x = new Float32Array(GRID * GRID).map((_, i) => (i % 7) / 7);
  assert.deepEqual(Array.from(a.predict(x)), Array.from(b.predict(x)));
});

test('backpropagation matches numerical gradients', () => {
  const net = new CNN({ size: 4, c1: 2, c2: 2, dense: 3, classes: 3, seed: 5, l2: 0 });
  const rng = mulberry32(11);
  const x = new Float32Array(16).map(() => rng());
  const y = 1;
  const eps = 1e-3;
  const loss = () => -Math.log(net.forward(x)[y]);

  for (const [W, dW] of [
    [net.W1, net.dW1],
    [net.W2, net.dW2],
    [net.W3, net.dW3],
    [net.W4, net.dW4],
    [net.b1, net.db1],
    [net.b4, net.db4],
  ]) {
    net.zeroGrads();
    net.forward(x);
    net.backward(y);
    for (let i = 0; i < Math.min(W.length, 5); i += 1) {
      const orig = W[i];
      W[i] = orig + eps;
      const plus = loss();
      W[i] = orig - eps;
      const minus = loss();
      W[i] = orig;
      const numeric = (plus - minus) / (2 * eps);
      const analytic = dW[i];
      const rel = Math.abs(numeric - analytic) / Math.max(1e-4, Math.abs(numeric) + Math.abs(analytic));
      assert.ok(rel < 0.02, `gradient mismatch: numeric ${numeric} analytic ${analytic}`);
    }
  }
});

test('learns synthetic digits', () => {
  const train = makeDigitDataset({ perClass: 30, seed: 42 });
  const net = new CNN({ seed: 3 });
  for (let e = 0; e < 14; e += 1) {
    for (let i = 0; i < train.X.length; i += 24) {
      net.trainBatch(train.X.slice(i, i + 24), train.y.slice(i, i + 24), 0.005);
    }
  }
  const probe = makeDigitDataset({ perClass: 4, seed: 123 });
  const acc = net.accuracy(probe.X, probe.y);
  assert.ok(acc > 0.7, `accuracy was ${acc}`);
  assert.ok(net.lastLoss < 2.2);
});

test('different images produce different predictions', () => {
  const net = new CNN({ seed: 2 });
  const a = new Float32Array(GRID * GRID);
  const b = new Float32Array(GRID * GRID);
  for (let i = 0; i < a.length; i += 1) {
    a[i] = i % 3 === 0 ? 1 : 0;
    b[i] = i % 5 === 0 ? 1 : 0;
  }
  const pa = Array.from(net.predict(a));
  const pb = Array.from(net.predict(b));
  assert.notDeepEqual(pa, pb);
  assert.ok(Math.abs(pa.reduce((x, y) => x + y, 0) - 1) < 1e-5);
});

test('input size must be divisible by 4', () => {
  assert.throws(() => new CNN({ size: 6 }), /divisible by 4/);
});

test('a smaller network works for quick experiments', () => {
  const net = new CNN({ size: 8, c1: 2, c2: 2, dense: 4, classes: 2, seed: 2 });
  assert.equal(net.p1, 4);
  assert.equal(net.p2, 2);
  assert.equal(net.flat, 8);
  const out = net.predict(new Float32Array(64).fill(0.3));
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0] + out[1] - 1) < 1e-5);
});

test('gaussian helper is sane (sanity check of the shared RNG)', () => {
  const rng = mulberry32(3);
  const values = Array.from({ length: 5000 }, () => gaussian(rng));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(Math.abs(mean) < 0.08);
});
