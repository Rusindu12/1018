// A dependency-free multilayer perceptron: ReLU hidden layers, softmax output,
// Adam and optional L2. Everything lives in Float32Arrays so it is fast enough
// to train inside an animation frame.
import { mulberry32 } from './rng.js';

export class MLP {
  /**
   * @param {number[]} sizes e.g. [400, 64, 32, 10]
   * @param {{seed?:number, l2?:number, beta1?:number, beta2?:number, eps?:number}} opts
   */
  constructor(sizes, opts = {}) {
    if (!Array.isArray(sizes) || sizes.length < 2) throw new Error('MLP needs at least input+output layers');
    this.sizes = sizes.slice();
    this.nLayers = sizes.length - 1;
    this.seed = opts.seed ?? 1337;
    this.l2 = opts.l2 ?? 1e-4;
    this.beta1 = opts.beta1 ?? 0.9;
    this.beta2 = opts.beta2 ?? 0.999;
    this.eps = opts.eps ?? 1e-8;
    const rng = mulberry32(this.seed);

    this.W = [];
    this.B = [];
    this.mW = [];
    this.vW = [];
    this.mB = [];
    this.vB = [];
    this.dW = [];
    this.dB = [];

    for (let l = 0; l < this.nLayers; l += 1) {
      const fanIn = sizes[l];
      const fanOut = sizes[l + 1];
      const isLast = l === this.nLayers - 1;
      const scale = Math.sqrt((isLast ? 1 : 2) / fanIn);
      const w = new Float32Array(fanIn * fanOut);
      for (let i = 0; i < w.length; i += 1) w[i] = (rng() * 2 - 1) * scale;
      this.W.push(w);
      this.B.push(new Float32Array(fanOut));
      this.mW.push(new Float32Array(w.length));
      this.vW.push(new Float32Array(w.length));
      this.mB.push(new Float32Array(fanOut));
      this.vB.push(new Float32Array(fanOut));
      this.dW.push(new Float32Array(w.length));
      this.dB.push(new Float32Array(fanOut));
    }

    // Scratch buffers reused between forward/backward passes.
    this.acts = sizes.map((n) => new Float32Array(n));
    this.deltas = sizes.map((n) => new Float32Array(n));
    this.steps = 0;
    this.t = 0;

    // Loss is cross-entropy of the last forward pass.
    this.lastLoss = 0;
  }

  get paramCount() {
    return this.sizes.reduce((acc, n, i) => acc + (i ? n * (this.sizes[i - 1] + 1) : 0), 0);
  }

  /** Forward pass. Returns the softmax probabilities (a Float32Array). */
  predict(x) {
    if (x.length !== this.sizes[0]) throw new Error(`Expected ${this.sizes[0]} inputs, got ${x.length}`);
    this.acts[0].set(x);
    for (let l = 0; l < this.nLayers; l += 1) {
      const inN = this.sizes[l];
      const outN = this.sizes[l + 1];
      const w = this.W[l];
      const b = this.B[l];
      const a = this.acts[l];
      const z = this.acts[l + 1];
      for (let o = 0; o < outN; o += 1) {
        let sum = b[o];
        const row = o * inN;
        for (let i = 0; i < inN; i += 1) sum += w[row + i] * a[i];
        z[o] = sum;
      }
      if (l < this.nLayers - 1) {
        for (let o = 0; o < outN; o += 1) if (z[o] < 0) z[o] = 0; // ReLU
      } else {
        softmaxInPlace(z);
      }
    }
    return this.acts[this.nLayers];
  }

  predictClass(x) {
    const p = this.predict(x);
    let best = 0;
    for (let i = 1; i < p.length; i += 1) if (p[i] > p[best]) best = i;
    return { index: best, confidence: p[best], probs: p };
  }

  /**
   * Train on one mini-batch. X is an array of equal-length Float32Arrays,
   * labels an array of integer class ids.
   */
  trainBatch(X, labels, lr = 0.02) {
    const B = X.length;
    if (!B) return 0;
    for (let l = 0; l < this.nLayers; l += 1) {
      this.dW[l].fill(0);
      this.dB[l].fill(0);
    }

    let loss = 0;
    for (let s = 0; s < B; s += 1) {
      const probs = this.predict(X[s]);
      const y = labels[s];
      loss -= Math.log(Math.max(probs[y], 1e-9));

      // Output delta: softmax + cross entropy.
      const dOut = this.deltas[this.nLayers];
      dOut.set(probs);
      dOut[y] -= 1;

      for (let l = this.nLayers - 1; l >= 0; l -= 1) {
        const inN = this.sizes[l];
        const outN = this.sizes[l + 1];
        const a = this.acts[l];
        const d = this.deltas[l + 1];
        const dW = this.dW[l];
        const dB = this.dB[l];
        for (let o = 0; o < outN; o += 1) {
          const dv = d[o];
          if (dv === 0) continue;
          const row = o * inN;
          for (let i = 0; i < inN; i += 1) dW[row + i] += dv * a[i];
          dB[o] += dv;
        }

        if (l > 0) {
          // Backprop through the ReLU of this layer.
          const prev = this.deltas[l];
          prev.fill(0);
          const w = this.W[l];
          for (let o = 0; o < outN; o += 1) {
            const dv = d[o];
            if (dv === 0) continue;
            const row = o * inN;
            for (let i = 0; i < inN; i += 1) prev[i] += w[row + i] * dv;
          }
          const act = this.acts[l];
          for (let i = 0; i < inN; i += 1) if (act[i] <= 0) prev[i] = 0;
        }
      }
    }

    const invB = 1 / B;
    const l2 = this.l2;
    const b1 = this.beta1;
    const b2 = this.beta2;
    const t = (this.t += 1);
    const bc1 = 1 - Math.pow(b1, t);
    const bc2 = 1 - Math.pow(b2, t);
    for (let l = 0; l < this.nLayers; l += 1) {
      const W = this.W[l];
      const Bv = this.B[l];
      const dW = this.dW[l];
      const dB = this.dB[l];
      const mW = this.mW[l];
      const vW = this.vW[l];
      const mB = this.mB[l];
      const vB = this.vB[l];
      for (let k = 0; k < W.length; k += 1) {
        const g = dW[k] * invB + l2 * W[k];
        mW[k] = b1 * mW[k] + (1 - b1) * g;
        vW[k] = b2 * vW[k] + (1 - b2) * g * g;
        W[k] -= (lr * (mW[k] / bc1)) / (Math.sqrt(vW[k] / bc2) + this.eps);
      }
      for (let k = 0; k < Bv.length; k += 1) {
        const g = dB[k] * invB;
        mB[k] = b1 * mB[k] + (1 - b1) * g;
        vB[k] = b2 * vB[k] + (1 - b2) * g * g;
        Bv[k] -= (lr * (mB[k] / bc1)) / (Math.sqrt(vB[k] / bc2) + this.eps);
      }
    }

    this.steps += 1;
    this.lastLoss = loss / B;
    return this.lastLoss;
  }

  /** Accuracy over a list of examples. */
  accuracy(X, labels) {
    if (!X.length) return 0;
    let ok = 0;
    for (let i = 0; i < X.length; i += 1) {
      if (this.predictClass(X[i]).index === labels[i]) ok += 1;
    }
    return ok / X.length;
  }
}

export function softmaxInPlace(z) {
  let max = -Infinity;
  for (let i = 0; i < z.length; i += 1) if (z[i] > max) max = z[i];
  let sum = 0;
  for (let i = 0; i < z.length; i += 1) {
    z[i] = Math.exp(z[i] - max);
    sum += z[i];
  }
  const inv = 1 / (sum || 1);
  for (let i = 0; i < z.length; i += 1) z[i] *= inv;
  return z;
}
