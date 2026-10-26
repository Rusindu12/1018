import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeBrain, SnakeGame, SnakeEvolution, SNAKE, INPUTS } from '../assets/js/core/snake.js';
import { mulberry32 } from '../assets/js/core/rng.js';

test('brain shape and outputs', () => {
  const brain = new SnakeBrain();
  assert.equal(brain.genome.length, (INPUTS + 1) * SNAKE.hidden + (SNAKE.hidden + 1) * SNAKE.outputs);
  assert.equal(brain.genome.length, 147);
  for (let i = 0; i < 50; i += 1) {
    const choice = brain.forward(new Float32Array(INPUTS).fill(Math.random()));
    assert.ok(choice >= 0 && choice <= 2);
    assert.equal(Number.isInteger(choice), true);
  }
});

test('inputs have the documented length and stay finite', () => {
  const game = new SnakeGame(new SnakeBrain(), mulberry32(2));
  const inputs = game.inputs();
  assert.equal(inputs.length, INPUTS);
  assert.ok(inputs.every((v) => Number.isFinite(v)));
});

test('a snake that walks into a wall dies', () => {
  const brain = { forward: () => 1 }; // always straight
  const game = new SnakeGame(brain, mulberry32(1));
  game.dir = 1; // heading right, starting in the middle
  let steps = 0;
  while (game.alive && steps < 60) {
    game.step();
    steps += 1;
  }
  assert.equal(game.alive, false);
  assert.ok(steps < SNAKE.cols, `should hit the wall quickly, took ${steps}`);
  assert.equal(game.score, 0);
});

test('eating grows the snake and resets hunger', () => {
  const game = new SnakeGame({ forward: () => 1 }, mulberry32(1));
  // Put food directly to the right of the head.
  const head = game.body[0];
  game.food = { x: head.x + 1, y: head.y };
  const before = game.body.length;
  game.hunger = 50;
  game.step();
  assert.equal(game.score, 1);
  assert.equal(game.body.length, before + 1);
  assert.equal(game.hunger, 0);
});

test('a starving snake is removed', () => {
  const game = new SnakeGame({ forward: () => 1 }, mulberry32(1));
  game.hunger = 200;
  game.step();
  assert.equal(game.alive, false);
});

test('evolution improves the record over generations', () => {
  const evo = new SnakeEvolution({ population: 120, seed: 99 });
  for (let g = 0; g < 45; g += 1) evo.runGeneration();
  assert.equal(evo.history.length, 45);
  assert.ok(evo.record >= 6, `expected at least 6 food, got ${evo.record}`);
  assert.ok(evo.history.at(-1).best > evo.history[0].best, 'fitness should improve');
  for (const h of evo.history) {
    assert.ok(Number.isFinite(h.best) && Number.isFinite(h.avg));
  }
  const best = evo.leaderboard[0];
  assert.ok(best.body.length >= SNAKE.startLength);
});

test('a generation always terminates', () => {
  const evo = new SnakeEvolution({ population: 10, seed: 4 });
  let guard = 0;
  while (evo.aliveCount > 0 && guard < SNAKE.maxSteps + 10) {
    evo.step();
    guard += 1;
  }
  assert.equal(evo.aliveCount, 0);
});
