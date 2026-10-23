import test from 'node:test';
import assert from 'node:assert/strict';
import { Brain, EvolutionSim, WORLD } from '../assets/js/core/evolution.js';

test('brain has 49 genes and outputs a sigmoid probability', () => {
  const brain = new Brain();
  assert.equal(brain.genome.length, 49);
  for (let i = 0; i < 100; i += 1) {
    const out = brain.forward([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()]);
    assert.ok(out >= 0 && out <= 1);
  }
});

test('same seed produces the same course', () => {
  const a = new EvolutionSim({ population: 20, seed: 11 });
  const b = new EvolutionSim({ population: 20, seed: 11 });
  assert.deepEqual(a.layout.slice(0, 10), b.layout.slice(0, 10));
  assert.deepEqual(a.gates.map((g) => g.gapY), b.gates.map((g) => g.gapY));
});

test('the population learns to pass gates over generations', () => {
  const sim = new EvolutionSim({ population: 80, seed: 7 });
  const first = sim.runGeneration();
  assert.ok(first.gates >= 0);
  for (let g = 0; g < 13; g += 1) sim.runGeneration();
  assert.equal(sim.history.length, 14);
  assert.ok(sim.record >= 6, `expected at least 6 gates, got ${sim.record}`);
  assert.ok(sim.history.at(-1).best > sim.history[0].best, 'best fitness should improve');
  for (const h of sim.history) {
    assert.ok(Number.isFinite(h.best) && Number.isFinite(h.avg));
  }
  assert.ok(sim.record === Math.max(...sim.history.map((h) => h.gates)));
});

test('agents share a fixed course and always start centred', () => {
  const sim = new EvolutionSim({ population: 12, seed: 3 });
  const ys = new Set(sim.agents.map((a) => a.y));
  assert.equal(ys.size, 1);
  assert.equal([...ys][0], WORLD.height * 0.45);
});

test('a generation terminates even if everyone survives', () => {
  const sim = new EvolutionSim({ population: 6, seed: 5 });
  const gate = { x: 100, gapY: 0, gap: WORLD.height, prevX: 100 };
  sim.gates = [gate, gate, gate];
  let steps = 0;
  while (sim.aliveCount > 0 && steps < WORLD.maxSteps + 100) {
    sim.step(1 / 60);
    steps += 1;
  }
  assert.equal(sim.aliveCount, 0);
  assert.ok(steps <= WORLD.maxSteps + 2);
});
