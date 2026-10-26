// A small convolutional network written from scratch for 16×16 digit grids.
//   conv(6, 3×3, pad 1) → ReLU → maxpool 2 → conv(12, 3×3, pad 1) → ReLU
//   → maxpool 2 → dense(32) → ReLU → dense(10) → softmax
// Trained with Adam. Inputs and activations live in Float32Arrays.
import { mulberry32 } from './rng.js';

export const CNN_SHAPE = { size: 16, c1: 6, c2: 12, dense: 32, classes: 10 };

function im2colIndex(y, x, c, w, h, ch) {
  return (y * w + x) * ch + c;
}

export class CNN {
  constructor(opts = {}) {
    this.size = opts.size ?? CNN_SHAPE.size;
    this.c1 = opts.c1 ?? CNN_SHAPE.c1;
    this.c2 = opts.c2 ?? CNN_SHAPE.c2;
    this.dense = opts.dense ?? CNN_SHAPE.dense;
    this.classes = opts.classes ?? CNN_SHAPE.classes;
    this.l2 = opts.l2 ?? 1e-4;
    this.lr = opts.lr ?? 0.002;
    this.beta1 = 0.9;
    this.beta2 = 0.999;
    this.eps = 1e-8;
    this.t = 0;

    const rng = mulberry32(opts.seed ?? 1234);
    const S = this.size;
    if (S % 4 !== 0) throw new Error('CNN input size must be divisible by 4 (two 2×2 pools)');

    this.p1 = S / 2; // 16 → 8
    this.p2 = this.p1 / 2; // 8 → 4

    this.W1 = this.initConv(rng, this.c1, 1);
    this.b1 = new Float32Array(this.c1);
    this.W2 = this.initConv(rng, this.c2, this.c1);
    this.b2 = new Float32Array(this.c2);

    const flat = this.p2 * this.p2 * this.c2;
    this.flat = flat;
    this.W3 = this.initDense(rng, this.dense, flat);
    this.b3 = new Float32Array(this.dense);
    this.W4 = this.initDense(rng, this.classes, this.dense);
    this.b4 = new Float32Array(this.classes);

    // forward caches
    this.x = new Float32Array(S * S);
    this.z1 = new Float32Array(S * S * this.c1);
    this.a1 = new Float32Array(S * S * this.c1);
    this.m1 = new Float32Array(this.p1 * this.p1 * this.c1);
    this.z2 = new Float32Array(this.p1 * this.p1 * this.c2);
    this.a2 = new Float32Array(this.p1 * this.p1 * this.c2);
    this.m2 = new Float32Array(this.p2 * this.p2 * this.c2);
    this.z3 = new Float32Array(this.dense);
    this.a3 = new Float32Array(this.dense);
    this.out = new Float32Array(this.classes);

    // gradients
    this.dW1 = new Float32Array(this.W1.length);
    this.db1 = new Float32Array(this.b1.length);
    this.dW2 = new Float32Array(this.W2.length);
    this.db2 = new Float32Array(this.b2.length);
    this.dW3 = new Float32Array(this.W3.length);
    this.db3 = new Float32Array(this.b3.length);
    this.dW4 = new Float32Array(this.W4.length);
    this.db4 = new Float32Array(this.b4.length);

    this.dz1 = new Float32Array(this.z1.length);
    this.dm1 = new Float32Array(this.m1.length);
    this.dz2 = new Float32Array(this.z2.length);
    this.dm2 = new Float32Array(this.m2.length);
    this.dz3 = new Float32Array(this.dense);
    this.dout = new Float32Array(this.classes);

    this.mW = [this.W1, this.W2, this.W3, this.W4].map((w) => new Float32Array(w.length));
    this.vW = [this.W1, this.W2, this.W3, this.W4].map((w) => new Float32Array(w.length));
    this.mB = [this.b1, this.b2, this.b3, this.b4].map((b) => new Float32Array(b.length));
    this.vB = [this.b1, this.b2, this.b3, this.b4].map((b) => new Float32Array(b.length));

    this.lastLoss = 0;
  }

  initConv(rng, outCh, inCh) {
    const n = outCh * inCh * 9;
    const scale = Math.sqrt(2 / (inCh * 9));
    const w = new Float32Array(n);
    for (let i = 0; i < n; i += 1) w[i] = (rng() * 2 - 1) * scale;
    return w;
  }

  initDense(rng, rows, cols) {
    const w = new Float32Array(rows * cols);
    const scale = Math.sqrt(2 / cols);
    for (let i = 0; i < w.length; i += 1) w[i] = (rng() * 2 - 1) * scale;
    return w;
  }

  get paramCount() {
    return this.W1.length + this.b1.length + this.W2.length + this.b2.length
      + this.W3.length + this.b3.length + this.W4.length + this.b4.length;
  }

  convForward(input, inW, inH, inCh, W, b, outCh, out) {
    const pad = 1;
    for (let oc = 0; oc < outCh; oc += 1) {
      const bias = b[oc];
      const wBase = oc * inCh * 9;
      for (let y = 0; y < inH; y += 1) {
        for (let x = 0; x < inW; x += 1) {
          let sum = bias;
          for (let ic = 0; ic < inCh; ic += 1) {
            const wOff = wBase + ic * 9;
            for (let ky = 0; ky < 3; ky += 1) {
              const iy = y + ky - pad;
              if (iy < 0 || iy >= inH) continue;
              for (let kx = 0; kx < 3; kx += 1) {
                const ix = x + kx - pad;
                if (ix < 0 || ix >= inW) continue;
                sum += W[wOff + ky * 3 + kx] * input[im2colIndex(iy, ix, ic, inW, inH, inCh)];
              }
            }
          }
          out[im2colIndex(y, x, oc, inW, inH, outCh)] = sum;
        }
      }
    }
  }

  convBackward(input, inW, inH, inCh, W, dW, dOut, outCh, dIn, dOutCh) {
    const pad = 1;
    for (let oc = 0; oc < outCh; oc += 1) {
      const wBase = oc * inCh * 9;
      for (let y = 0; y < inH; y += 1) {
        for (let x = 0; x < inW; x += 1) {
          const grad = dOut[im2colIndex(y, x, oc, inW, inH, outCh)];
          if (grad === 0) continue;
          for (let ic = 0; ic < inCh; ic += 1) {
            const wOff = wBase + ic * 9;
            for (let ky = 0; ky < 3; ky += 1) {
              const iy = y + ky - pad;
              if (iy < 0 || iy >= inH) continue;
              for (let kx = 0; kx < 3; kx += 1) {
                const ix = x + kx - pad;
                if (ix < 0 || ix >= inW) continue;
                dW[wOff + ky * 3 + kx] += grad * input[im2colIndex(iy, ix, ic, inW, inH, inCh)];
                if (dIn) dIn[im2colIndex(iy, ix, ic, inW, inH, dOutCh)] += grad * W[wOff + ky * 3 + kx];
              }
            }
          }
        }
      }
    }
  }

  forward(x) {
    const S = this.size;
    const { c1, c2 } = this;
    this.x.set(x);

    this.convForward(this.x, S, S, 1, this.W1, this.b1, c1, this.z1);
    for (let i = 0; i < this.z1.length; i += 1) this.a1[i] = this.z1[i] > 0 ? this.z1[i] : 0;

    // maxpool 2×2 → 8×8
    const p1 = this.p1;
    for (let oy = 0; oy < p1; oy += 1) {
      for (let ox = 0; ox < p1; ox += 1) {
        for (let c = 0; c < c1; c += 1) {
          let best = -Infinity;
          for (let ky = 0; ky < 2; ky += 1) {
            for (let kx = 0; kx < 2; kx += 1) {
              const v = this.a1[im2colIndex(oy * 2 + ky, ox * 2 + kx, c, S, S, c1)];
              if (v > best) best = v;
            }
          }
          this.m1[im2colIndex(oy, ox, c, p1, p1, c1)] = best;
        }
      }
    }

    this.convForward(this.m1, p1, p1, c1, this.W2, this.b2, c2, this.z2);
    for (let i = 0; i < this.z2.length; i += 1) this.a2[i] = this.z2[i] > 0 ? this.z2[i] : 0;

    // maxpool 2×2 → 4×4
    const p2 = this.p2;
    for (let oy = 0; oy < p2; oy += 1) {
      for (let ox = 0; ox < p2; ox += 1) {
        for (let c = 0; c < c2; c += 1) {
          let best = -Infinity;
          for (let ky = 0; ky < 2; ky += 1) {
            for (let kx = 0; kx < 2; kx += 1) {
              const v = this.a2[im2colIndex(oy * 2 + ky, ox * 2 + kx, c, p1, p1, c2)];
              if (v > best) best = v;
            }
          }
          this.m2[im2colIndex(oy, ox, c, p2, p2, c2)] = best;
        }
      }
    }

    // dense 1
    for (let o = 0; o < this.dense; o += 1) {
      let sum = this.b3[o];
      const row = o * this.flat;
      for (let i = 0; i < this.flat; i += 1) sum += this.W3[row + i] * this.m2[i];
      this.z3[o] = sum;
      this.a3[o] = sum > 0 ? sum : 0;
    }

    // dense 2 → logits
    for (let o = 0; o < this.classes; o += 1) {
      let sum = this.b4[o];
      const row = o * this.dense;
      for (let i = 0; i < this.dense; i += 1) sum += this.W4[row + i] * this.a3[i];
      this.out[o] = sum;
    }

    // softmax in place, keeping logits for the backward pass
    let max = -Infinity;
    for (let i = 0; i < this.classes; i += 1) if (this.out[i] > max) max = this.out[i];
    let total = 0;
    for (let i = 0; i < this.classes; i += 1) {
      this.out[i] = Math.exp(this.out[i] - max);
      total += this.out[i];
    }
    for (let i = 0; i < this.classes; i += 1) this.out[i] /= total;
    return this.out;
  }

  predict(x) {
    return this.forward(x);
  }

  predictClass(x) {
    const p = this.forward(x);
    let best = 0;
    for (let i = 1; i < p.length; i += 1) if (p[i] > p[best]) best = i;
    return { index: best, confidence: p[best], probs: p };
  }

  /** One mini-batch step. Returns mean cross-entropy loss. */
  trainBatch(X, labels, lr = this.lr) {
    const B = X.length;
    if (!B) return 0;
    this.zeroGrads();
    let loss = 0;

    for (let s = 0; s < B; s += 1) {
      const p = this.forward(X[s]);
      const y = labels[s];
      loss -= Math.log(Math.max(p[y], 1e-9));
      this.backward(y);
    }

    this.adam(lr, B);
    this.lastLoss = loss / B;
    return this.lastLoss;
  }

  zeroGrads() {
    for (const g of [this.dW1, this.db1, this.dW2, this.db2, this.dW3, this.db3, this.dW4, this.db4]) g.fill(0);
  }

  backward(y) {
    const S = this.size;
    const { c1, c2, p1, p2 } = this;

    // output delta
    for (let i = 0; i < this.classes; i += 1) this.dout[i] = this.out[i] - (i === y ? 1 : 0);

    // dense 2 grads
    for (let o = 0; o < this.classes; o += 1) {
      const d = this.dout[o];
      const row = o * this.dense;
      for (let i = 0; i < this.dense; i += 1) this.dW4[row + i] += d * this.a3[i];
      this.db4[o] += d;
    }
    // dense 1 delta
    this.dz3.fill(0);
    for (let i = 0; i < this.dense; i += 1) {
      if (this.a3[i] <= 0) continue;
      let sum = 0;
      for (let o = 0; o < this.classes; o += 1) sum += this.W4[o * this.dense + i] * this.dout[o];
      this.dz3[i] = sum;
    }
    for (let o = 0; o < this.dense; o += 1) {
      const d = this.dz3[o];
      const row = o * this.flat;
      for (let i = 0; i < this.flat; i += 1) this.dW3[row + i] += d * this.m2[i];
      this.db3[o] += d;
    }

    // delta on the pooled features
    const dFlat = this.dm2;
    dFlat.fill(0);
    for (let i = 0; i < this.flat; i += 1) {
      let sum = 0;
      for (let o = 0; o < this.dense; o += 1) sum += this.W3[o * this.flat + i] * this.dz3[o];
      dFlat[i] = sum;
    }

    // unpool #2 → dA2
    this.dz2.fill(0);
    for (let oy = 0; oy < p2; oy += 1) {
      for (let ox = 0; ox < p2; ox += 1) {
        for (let c = 0; c < c2; c += 1) {
          const target = dFlat[im2colIndex(oy, ox, c, p2, p2, c2)];
          if (target === 0) continue;
          // Route the gradient to the max element of each pooling window.
          let bestV = -Infinity;
          let bi = 0;
          let bj = 0;
          for (let ky = 0; ky < 2; ky += 1) {
            for (let kx = 0; kx < 2; kx += 1) {
              const v = this.a2[im2colIndex(oy * 2 + ky, ox * 2 + kx, c, p1, p1, c2)];
              if (v > bestV) {
                bestV = v;
                bi = ky;
                bj = kx;
              }
            }
          }
          this.dz2[im2colIndex(oy * 2 + bi, ox * 2 + bj, c, p1, p1, c2)] = target;
        }
      }
    }
    // ReLU mask
    for (let i = 0; i < this.dz2.length; i += 1) if (this.a2[i] <= 0) this.dz2[i] = 0;

    // conv2 backward → dM1
    const dM1 = new Float32Array(p1 * p1 * c1);
    this.convBackward(this.m1, p1, p1, c1, this.W2, this.dW2, this.dz2, c2, dM1, c1);
    // conv2 dW2 needs the bias grads too
    for (let oy = 0; oy < p1; oy += 1) {
      for (let ox = 0; ox < p1; ox += 1) {
        for (let c = 0; c < c2; c += 1) this.db2[c] += this.dz2[im2colIndex(oy, ox, c, p1, p1, c2)];
      }
    }

    // unpool #1 → dA1
    this.dz1.fill(0);
    for (let oy = 0; oy < p1; oy += 1) {
      for (let ox = 0; ox < p1; ox += 1) {
        for (let c = 0; c < c1; c += 1) {
          const target = dM1[im2colIndex(oy, ox, c, p1, p1, c1)];
          if (target === 0) continue;
          let bestV = -Infinity;
          let bi = 0;
          let bj = 0;
          for (let ky = 0; ky < 2; ky += 1) {
            for (let kx = 0; kx < 2; kx += 1) {
              const v = this.a1[im2colIndex(oy * 2 + ky, ox * 2 + kx, c, S, S, c1)];
              if (v > bestV) {
                bestV = v;
                bi = ky;
                bj = kx;
              }
            }
          }
          this.dz1[im2colIndex(oy * 2 + bi, ox * 2 + bj, c, S, S, c1)] = target;
        }
      }
    }
    for (let i = 0; i < this.dz1.length; i += 1) if (this.a1[i] <= 0) this.dz1[i] = 0;

    // conv1 backward (input gradient not needed)
    this.convBackward(this.x, S, S, 1, this.W1, this.dW1, this.dz1, c1, null, 1);
    for (let oy = 0; oy < S; oy += 1) {
      for (let ox = 0; ox < S; ox += 1) {
        for (let c = 0; c < c1; c += 1) this.db1[c] += this.dz1[im2colIndex(oy, ox, c, S, S, c1)];
      }
    }
  }

  adam(lr, batch) {
    this.t += 1;
    const b1 = this.beta1;
    const b2 = this.beta2;
    const bc1 = 1 - Math.pow(b1, this.t);
    const bc2 = 1 - Math.pow(b2, this.t);
    const params = [this.W1, this.W2, this.W3, this.W4];
    const grads = [this.dW1, this.dW2, this.dW3, this.dW4];
    const biases = [this.b1, this.b2, this.b3, this.b4];
    const bgrads = [this.db1, this.db2, this.db3, this.db4];

    for (let pi = 0; pi < params.length; pi += 1) {
      const p = params[pi];
      const g = grads[pi];
      const m = this.mW[pi];
      const v = this.vW[pi];
      for (let i = 0; i < p.length; i += 1) {
        const grad = g[i] / batch + this.l2 * p[i];
        m[i] = b1 * m[i] + (1 - b1) * grad;
        v[i] = b2 * v[i] + (1 - b2) * grad * grad;
        p[i] -= (lr * (m[i] / bc1)) / (Math.sqrt(v[i] / bc2) + this.eps);
      }
      const bp = biases[pi];
      const bg = bgrads[pi];
      const bm = this.mB[pi];
      const bv = this.vB[pi];
      for (let i = 0; i < bp.length; i += 1) {
        const grad = bg[i] / batch;
        bm[i] = b1 * bm[i] + (1 - b1) * grad;
        bv[i] = b2 * bv[i] + (1 - b2) * grad * grad;
        bp[i] -= (lr * (bm[i] / bc1)) / (Math.sqrt(bv[i] / bc2) + this.eps);
      }
    }
  }

  accuracy(X, labels) {
    if (!X.length) return 0;
    let ok = 0;
    for (let i = 0; i < X.length; i += 1) {
      if (this.predictClass(X[i]).index === labels[i]) ok += 1;
    }
    return ok / X.length;
  }
}
