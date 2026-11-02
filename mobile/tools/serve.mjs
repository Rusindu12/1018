/* =====================================================================
   CryptoAI PRO — serve.mjs
   Tiny zero-dependency static server for the single-file build so you can
   check www/index.html in a desktop browser before building the APK.

   usage:  npm run serve            → http://localhost:4174
           PORT=8080 npm run serve
   ===================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'www');
const PORT = Number(process.env.PORT ?? 4174);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = resolve(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(e));
  }
}).listen(PORT, HOST, () => {
  console.log(`\n  CryptoAI PRO single-file app → http://localhost:${PORT}\n  serving ${ROOT}\n`);
});
