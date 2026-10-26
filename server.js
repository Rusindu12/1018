// Zero-dependency static server for NeuraLab.
// Usage: PORT=4173 node server.js
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const NOT_FOUND = `<!doctype html>
<html lang="si"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 — NeuraLab</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06080c;color:#e9eff7;
       font-family:system-ui,sans-serif;text-align:center;padding:24px}
  h1{font-size:72px;margin:0;letter-spacing:-.05em;background:linear-gradient(90deg,#b9ff5c,#5ad9ff,#a98bff);
     -webkit-background-clip:text;background-clip:text;color:transparent}
  p{color:#8c9aac;max-width:44ch;line-height:1.7}
  a{color:#b9ff5c;text-decoration:none;border:1px solid rgba(255,255,255,.16);padding:10px 18px;
    border-radius:999px;display:inline-block;margin-top:10px}
</style></head>
<body><div><h1>404</h1>
<p>මෙම ලිපිනයේ ගොනුවක් නැහැ. ලැබ් පිටුවකට යන්නද?</p>
<a href="/">NeuraLab මුල් පිටුව</a></div></body></html>`;

const server = createServer(async (req, res) => {
  const send = (status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
    res.writeHead(status, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
      ...extra,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    send(405, 'Method not allowed', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    send(400, 'Bad request');
    return;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(ROOT, normalize(pathname)));

  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    send(403, 'Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    const data = await readFile(filePath);
    send(200, data, MIME[extname(filePath).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(404, NOT_FOUND, 'text/html; charset=utf-8');
  }
});

server.listen(PORT, HOST, () => {
  const { port } = server.address();
  console.log(`NeuraLab listening on http://localhost:${port} (bound ${HOST})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
