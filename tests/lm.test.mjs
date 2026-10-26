import test from 'node:test';
import assert from 'node:assert/strict';
import { NGramModel, CORPORA, tokenize } from '../assets/js/core/ngram.js';

test('learns a deterministic pattern', () => {
  const model = new NGramModel({ order: 2 });
  model.feed('abcabcabcabc');
  model.finalize();
  const { options } = model.next('ab', { topK: 3 });
  assert.equal(options[0].ch, 'c');
  assert.ok(options[0].p > 0.99);
});

test('backoff works for unseen contexts', () => {
  const model = new NGramModel({ order: 3 });
  model.feed('the quick brown fox jumps over the lazy dog');
  model.finalize();
  const { options, matched } = model.next('zzz', { topK: 5 });
  assert.ok(options.length > 0);
  assert.ok(matched <= 1);
});

test('generation respects prompt and length', () => {
  const model = new NGramModel({ order: 2 });
  model.feed(CORPORA.english.text);
  model.finalize();
  const text = model.generate('The first', 160, { temperature: 1 });
  assert.ok(text.startsWith('The first'));
  assert.ok(text.length >= 160);
});

test('high temperature flattens the distribution', () => {
  const model = new NGramModel({ order: 2 });
  model.feed('aaaaaaaaaaaaaaaaaaaab');
  model.finalize();
  const cold = model.next('a', { temperature: 0.3, topK: 5 }).options;
  const hot = model.next('a', { temperature: 1.8, topK: 5 }).options;
  assert.ok(cold[0].p > hot[0].p);
});

test('perplexity returns finite bits per character', () => {
  const model = new NGramModel({ order: 3 });
  const text = CORPORA.programming.text;
  const cut = Math.floor(text.length * 0.85);
  model.feed(text.slice(0, cut));
  model.finalize();
  const { bpc, chars } = model.perplexity(text.slice(cut));
  assert.ok(chars > 10);
  assert.ok(Number.isFinite(bpc) && bpc > 0);
});

test('Sinhala is tokenised as grapheme clusters', () => {
  assert.equal(tokenize('ක්').length, 1);
  assert.equal(tokenize('අම්මා').length, 3);
  const model = new NGramModel({ order: 2 });
  model.feed(CORPORA.sinhala.text);
  model.finalize();
  const out = model.generate('අම්මා', 80);
  assert.ok(out.startsWith('අම්මා'));
  assert.ok(out.length > 60);
});
