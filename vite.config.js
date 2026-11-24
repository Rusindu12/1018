import { defineConfig } from 'vite';

export default defineConfig({
  root: 'crypto',
  base: './',
  publicDir: 'public',
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { outDir: '../dist', emptyOutDir: true },
});
