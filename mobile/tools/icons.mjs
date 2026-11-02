/* =====================================================================
   CryptoAI PRO — icons.mjs
   Generates every Android launcher icon, adaptive-icon foreground and
   splash screen from resources/icon-source.png (1024×1024).

   usage:  node tools/icons.mjs        (needs: npm i -D sharp)
   ===================================================================== */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = join(root, 'resources', 'icon-source.png');
const RES = join(root, 'android', 'app', 'src', 'main', 'res');
if (!existsSync(SRC)) throw new Error('missing ' + SRC);

const BG = '#0a0e17';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
}

async function write(rel, buf) {
  const p = join(RES, rel);
  mkdirSync(dirname(p), { recursive: true });
  await sharp(buf).png().toFile(p);
  console.log('  ✓ ' + rel);
}

/* 1) classic launcher icons ------------------------------------------- */
for (const [d, scale] of Object.entries(DENSITIES)) {
  const size = Math.round(48 * scale);
  const base = await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toBuffer();
  await write(`mipmap-${d}/ic_launcher.png`, base);
  const round = await sharp(base)
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png().toBuffer();
  await write(`mipmap-${d}/ic_launcher_round.png`, round);

  /* 2) adaptive-icon foreground: 108dp canvas, art inside the 72dp safe zone */
  const fg = Math.round(108 * scale);
  const art = Math.round(fg * 0.62);
  const logo = await sharp(SRC).resize(art, art, { fit: 'cover' }).png().toBuffer();
  const fgBuf = await sharp({
    create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([{ input: logo, gravity: 'center' }]).png().toBuffer();
  await write(`mipmap-${d}/ic_launcher_foreground.png`, fgBuf);
}

/* 3) splash screens ---------------------------------------------------- */
const SPLASH = {
  'drawable-port-mdpi': [320, 470], 'drawable-port-hdpi': [480, 705], 'drawable-port-xhdpi': [720, 1058],
  'drawable-port-xxhdpi': [960, 1410], 'drawable-port-xxxhdpi': [1200, 1762],
  'drawable-land-mdpi': [470, 320], 'drawable-land-hdpi': [705, 480], 'drawable-land-xhdpi': [1058, 720],
  'drawable-land-xxhdpi': [1410, 960], 'drawable-land-xxxhdpi': [1762, 1200]
};
for (const [dir, [w, h]] of Object.entries(SPLASH)) {
  const logoSize = Math.round(Math.min(w, h) * 0.34);
  const logo = await sharp(SRC).resize(logoSize, logoSize, { fit: 'contain', background: BG }).png().toBuffer();
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }]).png().toBuffer();
  await write(`${dir}/splash.png`, buf);
}
{
  /* the density-independent fallback used before the splash plugin loads */
  const logo = await sharp(SRC).resize(220, 220, { fit: 'contain', background: BG }).png().toBuffer();
  const buf = await sharp({ create: { width: 720, height: 1280, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }]).png().toBuffer();
  await write('drawable/splash.png', buf);
}

/* 4) a 512px store/play icon + a web icon for the repo ---------------- */
mkdirSync(join(root, 'resources', 'out'), { recursive: true });
await sharp(SRC).resize(512, 512).png().toFile(join(root, 'resources', 'out', 'icon-512.png'));
await sharp(SRC).resize(192, 192).png().toFile(join(root, 'resources', 'out', 'icon-192.png'));
console.log('  ✓ resources/out/icon-512.png + icon-192.png');
console.log('\n  icons + splash generated from ' + SRC + '\n');
