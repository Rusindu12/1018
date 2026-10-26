import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'about.html', 'labs/drone.html', 'labs/digits.html', 'labs/snake.html', 'labs/text.html'];

test('every local href/src in the pages exists', async () => {
  const missing = [];
  for (const page of PAGES) {
    const html = await readFile(join(ROOT, page), 'utf8');
    const dir = dirname(join(ROOT, page));
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (/^(https?:|data:|mailto:|\/\/)/.test(ref) || ref.startsWith('#')) continue;
      const target = resolve(join(dir, ref.split('?')[0]));
      const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
      if (!ok) missing.push(`${page} -> ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every javascript module parses', async () => {
  const { execFileSync } = await import('node:child_process');
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(full);
    }
  }
  await walk(join(ROOT, 'assets'));
  await walk(join(ROOT, 'tests'));
  for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  assert.ok(files.length >= 10);
});

test('client code never talks to a hard-coded localhost backend', async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  }
  await walk(join(ROOT, 'assets'));
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    assert.ok(!/https?:\/\/(localhost|127\.0\.0\.1)/.test(src), `${file} hard-codes localhost`);
  }
});

test('server serves pages, assets and a 404', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await new Promise((resolvePort, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 8000);
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
      const m = out.match(/localhost:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolvePort(Number(m[1]));
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited early (${code}): ${out}`)));
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    const html = await index.text();
    assert.match(html, /NeuraLab/);

    const css = await fetch(`${base}/assets/css/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const js = await fetch(`${base}/assets/js/core/mlp.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);

    const lab = await fetch(`${base}/labs/digits.html`);
    assert.equal(lab.status, 200);

    const missing = await fetch(`${base}/nope.html`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /404/);

    const traversal = await fetch(`${base}/../../etc/passwd`);
    assert.ok([403, 404].includes(traversal.status));
  } finally {
    child.kill('SIGTERM');
  }
});
