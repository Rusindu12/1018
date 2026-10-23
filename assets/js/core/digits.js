// Procedural handwriting: stroke templates rasterised into 16×16 grids with
// random affine jitter, so a network can learn digits without any downloads.
import { mulberry32, gaussian } from './rng.js';

export const GRID = 16;
export const CLASSES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Strokes are polylines in a unit box. `w` is relative brush width.
const GLYPHS = {
  0: [[[[0.5, 0.06], [0.76, 0.18], [0.86, 0.5], [0.76, 0.84], [0.5, 0.94], [0.24, 0.84], [0.14, 0.5], [0.24, 0.18], [0.5, 0.06]]]],
  1: [
    [[[0.32, 0.22], [0.55, 0.06], [0.55, 0.94]]],
    [[[0.28, 0.94], [0.8, 0.94]]],
  ],
  2: [
    [[[0.16, 0.26], [0.3, 0.1], [0.55, 0.06], [0.78, 0.18], [0.82, 0.4], [0.66, 0.6], [0.2, 0.94], [0.84, 0.94]]],
  ],
  3: [
    [[[0.18, 0.16], [0.5, 0.05], [0.8, 0.2], [0.74, 0.42], [0.46, 0.5]]],
    [[[0.46, 0.5], [0.8, 0.62], [0.82, 0.84], [0.5, 0.95], [0.18, 0.86]]],
  ],
  4: [
    [[[0.62, 0.06], [0.16, 0.66], [0.9, 0.66]]],
    [[[0.72, 0.36], [0.72, 0.95]]],
  ],
  5: [
    [[[0.8, 0.08], [0.28, 0.08], [0.22, 0.48], [0.5, 0.42], [0.8, 0.56], [0.82, 0.8], [0.52, 0.94], [0.16, 0.86]]],
  ],
  6: [
    [[[0.72, 0.1], [0.4, 0.16], [0.2, 0.44], [0.16, 0.72], [0.32, 0.92], [0.6, 0.94], [0.8, 0.78], [0.78, 0.56], [0.56, 0.44], [0.3, 0.52], [0.18, 0.68]]],
  ],
  7: [
    [[[0.14, 0.08], [0.86, 0.08], [0.44, 0.94]]],
  ],
  8: [
    [[[0.5, 0.05], [0.26, 0.16], [0.24, 0.36], [0.5, 0.48], [0.76, 0.36], [0.74, 0.16], [0.5, 0.05]]],
    [[[0.5, 0.48], [0.18, 0.64], [0.16, 0.84], [0.5, 0.96], [0.84, 0.84], [0.82, 0.64], [0.5, 0.48]]],
  ],
  9: [
    [[[0.78, 0.36], [0.6, 0.14], [0.34, 0.12], [0.18, 0.3], [0.22, 0.52], [0.46, 0.6], [0.72, 0.52], [0.8, 0.36]]],
    [[[0.8, 0.36], [0.76, 0.7], [0.56, 0.92], [0.24, 0.94]]],
  ],
};

/** Rasterise one glyph variant into a GRID×GRID Float32Array in [0,1]. */
export function renderGlyph(digit, rng = Math.random, opts = {}) {
  const raw = GLYPHS[digit];
  if (!raw) throw new Error(`No glyph for ${digit}`);
  // Accept both [stroke] and [[stroke]] shapes for each glyph entry.
  const strokes = raw.map((st) => (typeof st[0][0] === 'number' ? st : st[0]));

  const rot = (opts.rotation ?? 0.22) * gaussian(rng);
  const shear = (opts.shear ?? 0.16) * gaussian(rng);
  const scaleX = 1 + (opts.scale ?? 0.14) * gaussian(rng);
  const scaleY = 1 + (opts.scale ?? 0.14) * gaussian(rng);
  const dx = (opts.shift ?? 0.06) * gaussian(rng);
  const dy = (opts.shift ?? 0.06) * gaussian(rng);
  const brush = (opts.brush ?? 0.075) * (1 + 0.25 * gaussian(rng));

  const SS = 4; // supersampling factor
  const size = GRID * SS;
  const hi = new Float32Array(size * size);

  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const plot = (x, y, r) => {
    const cx = x * size;
    const cy = y * size;
    const rr = Math.max(r * size, 0.6);
    const x0 = Math.max(0, Math.floor(cx - rr));
    const x1 = Math.min(size - 1, Math.ceil(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr));
    const y1 = Math.min(size - 1, Math.ceil(cy + rr));
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
        if (d <= rr) hi[py * size + px] = 1;
      }
    }
  };

  for (const stroke of strokes) {
    const pts = stroke.map(([px, py]) => {
      // Centre, jitter, rotate + shear, back to unit space.
      let x = px - 0.5;
      let y = py - 0.5;
      x *= scaleX;
      y *= scaleY;
      const sx = x + shear * y;
      const rx = sx * cos - y * sin;
      const ry = sx * sin + y * cos;
      return [0.5 + rx + dx, 0.5 + ry + dy];
    });
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * size * 1.6));
      for (let s = 0; s <= steps; s += 1) {
        plot(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps, brush);
      }
    }
    if (pts.length === 1) plot(pts[0][0], pts[0][1], brush);
  }

  // Downsample and normalise to a tight bounding box.
  const out = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      let sum = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          sum += hi[(y * SS + sy) * size + (x * SS + sx)];
        }
      }
      out[y * GRID + x] = sum / (SS * SS);
    }
  }
  return normaliseGrid(out);
}

/** Crop to the ink bounding box, scale to fit GRID with a small margin. */
export function normaliseGrid(grid) {
  const n = GRID;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (grid[y * n + x] > 0.12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return grid;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const inner = n - 3;
  const scale = Math.min(inner / w, inner / h);
  const offsetX = (n - w * scale) / 2;
  const offsetY = (n - h * scale) / 2;
  const out = new Float32Array(n * n);
  // Bilinear sample the source into the target box.
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const sx = (x - offsetX) / scale + minX + 0.5;
      const sy = (y - offsetY) / scale + minY + 0.5;
      out[y * n + x] = bilinear(grid, sx, sy);
    }
  }
  return out;
}

function bilinear(grid, x, y) {
  const n = GRID;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (ix, iy) => (ix < 0 || iy < 0 || ix >= n || iy >= n ? 0 : grid[iy * n + ix]);
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Build a synthetic training set. */
export function makeDigitDataset({ perClass = 160, seed = 42 } = {}) {
  const rng = mulberry32(seed);
  const X = [];
  const y = [];
  for (let d = 0; d < 10; d += 1) {
    for (let i = 0; i < perClass; i += 1) {
      // Part of the set is rendered clean, the rest jittered — teaches
      // the net to tolerate messy hand-writing.
      const jitter = i % 5 === 0 ? 0.05 : undefined;
      X.push(renderGlyph(d, rng, jitter ? { rotation: jitter, shear: jitter / 2, scale: jitter, shift: jitter / 2 } : {}));
      y.push(d);
    }
  }
  return { X, y };
}
