import test from 'node:test';
import assert from 'node:assert/strict';
import { MLP, softmaxInPlace } from '../assets/js/core/mlp.js';
import { mulberry32, gaussian } from '../assets/js/core/rng.js';

test('softmax produces a valid probability distribution', () => {
  const z = new Float32Array([1.2, -0.4, 0.1, 3.1]);
  softmaxInPlace(z);
  const sum = z.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.ok(z.every((v) => v >= 0 && v <= 1));
  assert.equal(z.indexOf(Math.max(...z)), 3);
});

test('network has the expected parameter count and output shape', () => {
  const net = new MLP([8, 5, 3], { seed: 1 });
  assert.equal(net.paramCount, 8 * 5 + 5 + 5 * 3 + 3);
  const out = net.predict(new Float32Array(8).fill(0.5));
  assert.equal(out.length, 3);
  assert.ok(Math.abs(out.reduce((a, b) => a + b, 0) - 1) < 1e-5);
});

test('same seed gives deterministic initialisation', () => {
  const a = new MLP([4, 6, 2], { seed: 42 });
  const b = new MLP([4, 6, 2], { seed: 42 });
  const x = new Float32Array([0.2, 0.4, 0.6, 0.8]);
  assert.deepEqual(Array.from(a.predict(x)), Array.from(b.predict(x)));
});

test('learns a non-linear 3-class problem', () => {
  const rng = mulberry32(5);
  const X = [];
  const y = [];
  for (let c = 0; c < 3; c += 1) {
    for (let i = 0; i < 120; i += 1) {
      const a = c * 2.1;
      X.push(new Float32Array([Math.cos(a) * 2 + gaussian(rng) * 0.45 + 3, Math.sin(a) * 2 + gaussian(rng) * 0.45 + 3]));
      y.push(c);
    }
  }
  const net = new MLP([2, 8, 3], { seed: 2, l2: 0 });
  for (let e = 0; e < 150; e += 1) {
    for (let i = 0; i < X.length; i += 20) {
      net.trainBatch(X.slice(i, i + 20), y.slice(i, i + 20), 0.01);
    }
  }
  assert.ok(net.accuracy(X, y) > 0.98, 'accuracy should approach 1');
  assert.ok(net.lastLoss < 0.1);
});

test('rejects mismatched inputs', () => {
  const net = new MLP([4, 3]);
  assert.throws(() => net.predict(new Float32Array(3)));
});
