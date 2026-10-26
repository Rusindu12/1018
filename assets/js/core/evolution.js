// Neuroevolution sandbox: a tiny neural network learns to fly a drone through
// gates using a genetic algorithm. Pure simulation — no DOM — so it can be
// unit-tested in Node and rendered by the browser lab.
import { mulberry32, gaussian } from './rng.js';
import { clamp } from './util.js';

export const WORLD = {
  width: 1000,
  height: 600,
  gravity: 1450,
  flap: -430,
  speed: 275,
  radius: 13,
  gap: 175,
  gateWidth: 86,
  spacing: 330,
  agentX: 230,
  maxSteps: 60 * 30,
  alignWeight: 0.35,
};

const BRAIN_SIZES = [4, 8, 1];

export class Brain {
  constructor(sizes = BRAIN_SIZES, genome = null, rng = Math.random) {
    this.sizes = sizes.slice();
    let n = 0;
    for (let i = 1; i < sizes.length; i += 1) n += sizes[i] * (sizes[i - 1] + 1);
    if (genome) {
      this.genome = new Float32Array(genome);
    } else {
      this.genome = new Float32Array(n);
      for (let i = 0; i < n; i += 1) this.genome[i] = gaussian(rng) * 0.6;
    }
    this.acts = sizes.map((s) => new Float32Array(s));
    this.out = 0;
  }

  forward(x) {
    this.acts[0].set(x);
    let off = 0;
    for (let l = 1; l < this.sizes.length; l += 1) {
      const inN = this.sizes[l - 1];
      const outN = this.sizes[l];
      const a = this.acts[l - 1];
      const z = this.acts[l];
      for (let o = 0; o < outN; o += 1) {
        let sum = this.genome[off + o * (inN + 1)]; // bias first
        const base = off + o * (inN + 1) + 1;
        for (let i = 0; i < inN; i += 1) sum += this.genome[base + i] * a[i];
        z[o] = l === this.sizes.length - 1 ? 1 / (1 + Math.exp(-sum)) : Math.tanh(sum);
      }
      off += outN * (inN + 1);
    }
    this.out = this.acts[this.sizes.length - 1][0];
    return this.out;
  }
}

function tournament(pop, rng, size = 3) {
  let best = pop[Math.floor(rng() * pop.length)];
  for (let i = 1; i < size; i += 1) {
    const c = pop[Math.floor(rng() * pop.length)];
    if (c.fitness > best.fitness) best = c;
  }
  return best;
}

function mate(a, b, rng, mutRate, mutScale) {
  const genome = new Float32Array(a.genome.length);
  for (let i = 0; i < genome.length; i += 1) {
    genome[i] = rng() < 0.5 ? a.genome[i] : b.genome[i];
    if (rng() < mutRate) genome[i] += gaussian(rng) * mutScale;
    if (rng() < 0.015) genome[i] = gaussian(rng) * 0.8;
  }
  return new Brain(BRAIN_SIZES, genome, rng);
}

export class EvolutionSim {
  constructor({ population = 80, seed = 7, mutationRate = 0.06, mutationScale = 0.25 } = {}) {
    this.population = population;
    this.seed = seed >>> 0;
    this.mutationRate = mutationRate;
    this.mutationScale = mutationScale;
    this.layout = this.makeLayout();
    this.generation = 0;
    this.history = []; // { gen, best, avg, gates }
    this.record = 0;
    this.agents = [];
    this.gates = [];
    this.steps = 0;
    this.best = null;
    this.avgFitness = 0;
    this.spawnPopulation(this.population);
    this.startRun();
  }

  spawnPopulation(n) {
    const rng = mulberry32(this.seed + this.generation * 7919);
    const parents = this.agents.length && this.generation > 0 ? this.agents : null;
    const next = [];
    const source = parents
      ? [...parents].sort((a, b) => b.fitness - a.fitness)
      : [];
    const eliteCount = parents ? Math.max(2, Math.round(n * 0.1)) : 0;
    for (let i = 0; i < eliteCount; i += 1) {
      next.push(this.makeAgent(new Brain(BRAIN_SIZES, source[i].brain.genome, rng)));
    }
    while (next.length < n) {
      if (source.length) {
        const a = tournament(source, rng, 4);
        const b = tournament(source, rng, 4);
        next.push(this.makeAgent(mate(a.brain, b.brain, rng, this.mutationRate, this.mutationScale)));
      } else {
        next.push(this.makeAgent(new Brain(BRAIN_SIZES, null, rng)));
      }
    }
    this.agents = next;
  }

  makeAgent(brain) {
    return {
      brain,
      y: WORLD.height * 0.45,
      vy: 0,
      alive: true,
      fitness: 0,
      gates: 0,
      distance: 0,
      age: 0,
      out: 0,
      align: 0,
      lastInputs: new Float32Array(4),
    };
  }

  startRun() {
    const rng = mulberry32(this.seed + this.generation * 104729 + 17);
    this.steps = 0;
    this.gates = [];
    this.gateCursor = 0;
    let x = WORLD.width + 320;
    for (let i = 0; i < 3; i += 1) {
      this.gates.push(this.makeGate(x, this.layout[this.gateCursor], this.gateCursor));
      this.gateCursor += 1;
      x += WORLD.spacing;
    }
    for (const a of this.agents) {
      a.y = WORLD.height * 0.45;
      a.vy = 0;
      a.alive = true;
      a.fitness = 0;
      a.gates = 0;
      a.distance = 0;
      a.align = 0;
      a.age = 0;
    }
    this.best = this.agents[0];
    this.aliveCount = this.agents.length;
  }

  /** A fixed course, shared by every generation, so progress is comparable. */
  makeLayout() {
    const rng = mulberry32(this.seed ^ 0x9e3779b9);
    const margin = 70;
    const span = Math.max(1, WORLD.height - WORLD.gap - margin * 2);
    return Array.from({ length: 240 }, () => margin + rng() * span);
  }

  makeGate(x, gapY, id = 0) {
    return { x, gapY, gap: WORLD.gap, prevX: x, id };
  }

  nextGate(y) {
    let best = null;
    let bestDx = Infinity;
    for (const g of this.gates) {
      const dx = g.x + WORLD.gateWidth - WORLD.agentX;
      if (dx > -WORLD.gateWidth && dx < bestDx) {
        bestDx = dx;
        best = g;
      }
    }
    return best || this.gates[0] || { x: 1200, gapY: WORLD.height / 2, gap: WORLD.gap };
  }

  /** Advance the whole population by one fixed step. */
  step(dt = 1 / 60) {
    if (!this.aliveCount) return false;
    this.steps += 1;

    for (const g of this.gates) {
      g.prevX = g.x;
      g.x -= WORLD.speed * dt;
    }

    // Spawn gates ahead of the flock, following the fixed course.
    const last = this.gates[this.gates.length - 1];
    if (!last || last.x < WORLD.width + WORLD.spacing) {
      const gapY = this.layout[this.gateCursor % this.layout.length];
      this.gates.push(this.makeGate((last ? last.x : WORLD.width) + WORLD.spacing, gapY, this.gateCursor));
      this.gateCursor += 1;
    }
    if (this.gates.length > 5) this.gates.shift();

    let alive = 0;
    for (const agent of this.agents) {
      if (!agent.alive) continue;
      agent.age += 1;

      const gate = this.nextGate(agent.y);
      const cx = gate.x + WORLD.gateWidth;
      const cy = gate.gapY + gate.gap / 2;
      const inputs = agent.lastInputs;
      inputs[0] = clamp((agent.y - cy) / WORLD.height, -1, 1);
      inputs[1] = clamp(agent.vy / 700, -1, 1);
      inputs[2] = clamp((cx - WORLD.agentX) / WORLD.width, -1, 1);
      inputs[3] = clamp(agent.y / WORLD.height, 0, 1);

      agent.out = agent.brain.forward(inputs);
      if (agent.out > 0.5) agent.vy = WORLD.flap;

      agent.vy += WORLD.gravity * dt;
      agent.y += agent.vy * dt;
      agent.distance += WORLD.speed * dt;
      // Shaping: reward being lined up with the upcoming gate. Without it the
      // GA plateaus for dozens of generations before a lucky mutant gets it.
      const align = Math.max(0, 1 - Math.abs(agent.y - cy) / (WORLD.height * 0.5));
      agent.align += align;
      agent.fitness = agent.distance + agent.gates * 420 + agent.align * WORLD.alignWeight;

      // Ceiling / floor.
      if (agent.y < WORLD.radius || agent.y > WORLD.height - WORLD.radius) {
        agent.alive = false;
      }

      // Gate collision (only the next gate matters).
      const gw = WORLD.gateWidth;
      const r = WORLD.radius;
      if (agent.alive && WORLD.agentX + r > gate.x && WORLD.agentX - r < gate.x + gw) {
        const inGap = agent.y - r > gate.gapY && agent.y + r < gate.gapY + gate.gap;
        if (!inGap) agent.alive = false;
      }

      // Passing a gate: award each flier exactly once, when the gate's right
      // edge crosses the drone this step.
      if (agent.alive && gate.x + gw < WORLD.agentX && gate.prevX + gw >= WORLD.agentX) {
        agent.gates += 1;
        agent.fitness = agent.distance + agent.gates * 420;
      }

      if (agent.age >= WORLD.maxSteps) {
        agent.alive = false;
        agent.fitness += 5000; // survived the whole run
      }

      if (agent.alive) alive += 1;
    }
    this.aliveCount = alive;

    // Track the best current flier for rendering.
    let best = null;
    for (const a of this.agents) if (!best || a.fitness > best.fitness) best = a;
    this.best = best;

    return alive > 0;
  }

  /** Score the finished generation and build the next one. */
  evolve() {
    const scored = [...this.agents].sort((a, b) => b.fitness - a.fitness);
    const best = scored[0];
    const avg = this.agents.reduce((s, a) => s + a.fitness, 0) / this.agents.length;
    this.history.push({ gen: this.generation, best: best.fitness, avg, gates: best.gates });
    if (this.history.length > 400) this.history.shift();
    this.record = Math.max(this.record, best.gates);
    this.generation += 1;
    this.agents = scored; // parents, best first
    this.spawnPopulation(this.population);
    this.startRun();
  }

  /** Run a full generation headlessly — used by tests and turbo mode. */
  runGeneration() {
    let guard = 0;
    while (this.aliveCount > 0 && guard < WORLD.maxSteps + 10) {
      this.step(1 / 60);
      guard += 1;
    }
    this.evolve();
    return this.history[this.history.length - 1];
  }
}
