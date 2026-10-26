// Snake AI: a population of snakes, each driven by a tiny neural network,
// evolved with a genetic algorithm. Pure logic — rendering lives in the lab.
import { mulberry32, gaussian } from './rng.js';

export const SNAKE = {
  cols: 22,
  rows: 16,
  population: 120,
  maxSteps: 700,
  startLength: 3,
  hidden: 8,
  outputs: 3, // turn left, go straight, turn right
  mutationRate: 0.05,
  mutationScale: 0.15,
  eliteRatio: 0.1,
  foodReward: 600,
  stepReward: 0,
  shaping: 2,
};

const DIRS = [
  [0, -1], // up
  [1, 0], // right
  [0, 1], // down
  [-1, 0], // left
];

export const INPUTS = 14;

export class SnakeBrain {
  constructor(sizes = [INPUTS, SNAKE.hidden, SNAKE.outputs], genome = null, rng = Math.random) {
    this.sizes = sizes.slice();
    let n = 0;
    for (let i = 1; i < sizes.length; i += 1) n += sizes[i] * (sizes[i - 1] + 1);
    if (genome) {
      this.genome = new Float32Array(genome);
    } else {
      this.genome = new Float32Array(n);
      for (let i = 0; i < n; i += 1) this.genome[i] = gaussian(rng) * 0.7;
    }
    this.acts = sizes.map((s) => new Float32Array(s));
  }

  get size() {
    return this.genome.length;
  }

  forward(inputs) {
    this.acts[0].set(inputs);
    let off = 0;
    for (let l = 1; l < this.sizes.length; l += 1) {
      const inN = this.sizes[l - 1];
      const outN = this.sizes[l];
      const a = this.acts[l - 1];
      const z = this.acts[l];
      const last = l === this.sizes.length - 1;
      for (let o = 0; o < outN; o += 1) {
        let sum = this.genome[off + o * (inN + 1)];
        const base = off + o * (inN + 1) + 1;
        for (let i = 0; i < inN; i += 1) sum += this.genome[base + i] * a[i];
        z[o] = last ? sum : Math.tanh(sum);
      }
      off += outN * (inN + 1);
    }
    const out = this.acts[this.sizes.length - 1];
    let best = 0;
    for (let i = 1; i < out.length; i += 1) if (out[i] > out[best]) best = i;
    return best;
  }
}

const key = (x, y) => y * SNAKE.cols + x;

export class SnakeGame {
  constructor(brain, rng = Math.random) {
    this.brain = brain;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const cx = (SNAKE.cols / 2) | 0;
    const cy = (SNAKE.rows / 2) | 0;
    this.body = [];
    for (let i = 0; i < SNAKE.startLength; i += 1) this.body.push({ x: cx - i, y: cy });
    this.occupied = new Set(this.body.map((p) => key(p.x, p.y)));
    this.dir = 1; // right
    this.alive = true;
    this.score = 0;
    this.steps = 0;
    this.hunger = 0;
    this.progress = 0;
    this.bestDist = Infinity;
    this.fitness = 0;
    this.food = this.spawnFood();
    this.bestDist = this.distanceToFood();
  }

  spawnFood() {
    for (let attempt = 0; attempt < SNAKE.cols * SNAKE.rows * 2; attempt += 1) {
      const x = Math.floor(this.rng() * SNAKE.cols);
      const y = Math.floor(this.rng() * SNAKE.rows);
      if (!this.occupied.has(key(x, y))) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  freeAhead(x, y, dx, dy, max = 6) {
    let n = 0;
    for (let i = 1; i <= max; i += 1) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= SNAKE.cols || ny >= SNAKE.rows) return n / max;
      if (this.occupied.has(key(nx, ny))) return n / max;
      n += 1;
    }
    return 1;
  }

  danger(x, y, dx, dy) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= SNAKE.cols || ny >= SNAKE.rows) return 1;
    return this.occupied.has(key(nx, ny)) ? 1 : 0;
  }

  inputs() {
    const head = this.body[0];
    const [fx, fy] = DIRS[this.dir];
    const left = (this.dir + 3) % 4;
    const right = (this.dir + 1) % 4;
    const [lx, ly] = DIRS[left];
    const [rx, ry] = DIRS[right];
    const dx = this.food.x - head.x;
    const dy = this.food.y - head.y;
    const manhattan = Math.abs(dx) + Math.abs(dy);
    const maxDist = SNAKE.cols + SNAKE.rows;

    return [
      this.danger(head.x, head.y, fx, fy),
      this.danger(head.x, head.y, lx, ly),
      this.danger(head.x, head.y, rx, ry),
      this.dir === 0 ? 1 : 0,
      this.dir === 1 ? 1 : 0,
      this.dir === 2 ? 1 : 0,
      this.dir === 3 ? 1 : 0,
      Math.sign(dx),
      Math.sign(dy),
      manhattan / maxDist,
      Math.min(1, this.hunger / 80),
      this.freeAhead(head.x, head.y, fx, fy),
      this.body.length / (SNAKE.cols * SNAKE.rows),
      this.freeAhead(head.x, head.y, lx, ly, 6) * 0.5 + this.freeAhead(head.x, head.y, rx, ry, 6) * 0.5,
    ];
  }

  distanceToFood() {
    const head = this.body[0];
    return Math.abs(this.food.x - head.x) + Math.abs(this.food.y - head.y);
  }

  step() {
    if (!this.alive) return false;
    this.steps += 1;
    this.hunger += 1;

    const choice = this.brain.forward(this.inputs());
    // 0 = left, 1 = straight, 2 = right
    this.dir = (this.dir + (choice === 0 ? 3 : choice === 2 ? 1 : 0)) % 4;

    const [dx, dy] = DIRS[this.dir];
    const head = this.body[0];
    const nx = head.x + dx;
    const ny = head.y + dy;

    if (nx < 0 || ny < 0 || nx >= SNAKE.cols || ny >= SNAKE.rows) {
      this.alive = false;
      this.fitness = this.computeFitness();
      return false;
    }

    const tail = this.body[this.body.length - 1];
    const eatsFood = nx === this.food.x && ny === this.food.y;
    // The tail cell is vacated this step unless we grow.
    const hitsBody = this.occupied.has(key(nx, ny)) && !(!eatsFood && nx === tail.x && ny === tail.y);
    if (hitsBody) {
      this.alive = false;
      this.fitness = this.computeFitness();
      return false;
    }

    this.body.unshift({ x: nx, y: ny });
    this.occupied.add(key(nx, ny));

    if (eatsFood) {
      this.score += 1;
      this.hunger = 0;
      this.food = this.spawnFood();
      // Potential-based shaping: only genuine new records count, so a snake
      // cannot farm fitness by oscillating next to the food forever.
      this.bestDist = this.distanceToFood();
      this.progress += SNAKE.shaping;
    } else {
      const removed = this.body.pop();
      this.occupied.delete(key(removed.x, removed.y));
      const after = this.distanceToFood();
      if (after < this.bestDist) {
        this.progress += (this.bestDist - after) * SNAKE.shaping;
        this.bestDist = after;
      }
    }

    this.fitness = this.computeFitness();

    if (this.hunger > 160) {
      this.alive = false;
      return false;
    }
    return true;
  }

  computeFitness() {
    return this.score * SNAKE.foodReward + this.steps * SNAKE.stepReward + this.progress;
  }
}

function pickTournament(pop, rng, size = 4) {
  let best = pop[Math.floor(rng() * pop.length)];
  for (let i = 1; i < size; i += 1) {
    const challenger = pop[Math.floor(rng() * pop.length)];
    if (challenger.fitness > best.fitness) best = challenger;
  }
  return best;
}

function breed(a, b, rng, mutationRate, mutationScale) {
  const n = a.genome.length;
  const genome = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    genome[i] = rng() < 0.5 ? a.genome[i] : b.genome[i];
    if (rng() < mutationRate) genome[i] += gaussian(rng) * mutationScale;
    if (rng() < 0.01) genome[i] = gaussian(rng) * 0.8;
  }
  return new SnakeBrain([INPUTS, SNAKE.hidden, SNAKE.outputs], genome, rng);
}

export class SnakeEvolution {
  constructor({ population = SNAKE.population, seed = 7, mutationRate = SNAKE.mutationRate, mutationScale = SNAKE.mutationScale } = {}) {
    this.population = population;
    this.seed = seed >>> 0;
    this.mutationRate = mutationRate;
    this.mutationScale = mutationScale;
    this.generation = 0;
    this.history = [];
    this.record = 0;
    this.recordLength = 0;
    this.games = [];
    this.tick = 0;
    this.spawn();
  }

  spawn(parents = null) {
    const rng = mulberry32(this.seed + this.generation * 7919);
    const next = [];
    const sorted = parents ? [...parents].sort((a, b) => b.fitness - a.fitness) : [];
    const elite = parents ? Math.max(2, Math.round(this.population * SNAKE.eliteRatio)) : 0;
    for (let i = 0; i < elite; i += 1) {
      next.push(new SnakeBrain(undefined, sorted[i].brain.genome, rng));
    }
    while (next.length < this.population) {
      if (sorted.length) {
        const a = pickTournament(sorted, rng).brain;
        const b = pickTournament(sorted, rng).brain;
        next.push(breed(a, b, rng, this.mutationRate, this.mutationScale));
      } else {
        next.push(new SnakeBrain());
      }
    }
    this.games = next.map((brain, i) => {
      // Each snake gets its own deterministic food stream for this generation.
      const game = new SnakeGame(brain, mulberry32(this.seed + this.generation * 104729 + i * 7919));
      game.index = i;
      return game;
    });
    this.tick = 0;
    this.aliveCount = this.games.length;
  }

  get aliveGames() {
    return this.games.reduce((n, g) => n + (g.alive ? 1 : 0), 0);
  }

  get best() {
    let best = this.games[0];
    for (const g of this.games) if (g.fitness > best.fitness) best = g;
    return best;
  }

  get leaderboard() {
    return [...this.games].sort((a, b) => b.fitness - a.fitness);
  }

  /** Advance every living snake by one move. Returns true if any are alive. */
  step() {
    this.tick += 1;
    let alive = 0;
    for (const game of this.games) {
      if (!game.alive) continue;
      game.step();
      if (game.alive && this.tick >= SNAKE.maxSteps) {
        game.alive = false;
      }
      if (game.alive) alive += 1;
    }
    this.aliveCount = alive;
    return alive > 0;
  }

  evolve() {
    const sorted = this.leaderboard;
    const best = sorted[0];
    const avg = this.games.reduce((s, g) => s + g.fitness, 0) / this.games.length;
    this.history.push({ gen: this.generation, best: best.fitness, avg, score: best.score });
    if (this.history.length > 400) this.history.shift();
    this.record = Math.max(this.record, best.score);
    this.recordLength = Math.max(this.recordLength, best.body.length);
    this.generation += 1;
    this.spawn(sorted);
    return this.history[this.history.length - 1];
  }

  runGeneration() {
    let guard = 0;
    while (this.aliveCount > 0 && guard < SNAKE.maxSteps + 5) {
      this.step();
      guard += 1;
    }
    return this.evolve();
  }
}
