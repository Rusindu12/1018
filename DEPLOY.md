# Deploying NeuraLab

NeuraLab is a **pure static site**: HTML, CSS and ES modules. There is no build step, no environment
variable and no server-side code in production (`server.js` is only a convenience for local previews).

## Live right now

| URL | What it is |
|-----|------------|
| <https://neuralab-seven.vercel.app> | short link; forwards to the site below |
| <https://cdn.jsdelivr.net/gh/Rusindu12/1018@main/index.html> | the site, served straight from this repository's `main` branch by jsDelivr's global CDN |

Both are public and need no build step: jsDelivr reads the files from GitHub, so every push to
`main` (after its ~12 h cache expires) updates the live site. Nothing has to be installed or run.

### Making it a native deployment (two one-click upgrades)

A native host serves the files itself instead of mirroring them. Both need a permission that only the
repository owner can grant, which is why they are not done yet:

1. **GitHub Pages** — *Settings → Pages → Source = GitHub Actions*. The included
   `.github/workflows/pages.yml` then publishes `https://<user>.github.io/1018/` on every push to
   `main`. (Without that setting the workflow stops at the *Setup Pages* step.)
2. **Vercel** — *Account Settings → Authentication → Login Connections → connect GitHub*, then import
   `Rusindu12/1018` as a project (Framework preset: **Other**, no build command, output directory `.`).
   `vercel.json` already sets the security and cache headers, and every push to `main` re-deploys.

That means it runs anywhere that can serve files. Below are the paths that are pre-configured in
this repository.

| Target | Status | URL pattern |
|--------|--------|-------------|
| GitHub Pages | workflow included (`.github/workflows/pages.yml`) | `https://<user>.github.io/1018/` |
| Vercel | `vercel.json` included | `https://<project>.vercel.app` |
| Netlify / Cloudflare Pages | zero config — publish directory `.` | `https://<site>.netlify.app` |
| Any static host / S3 / nginx | copy the repo root | — |
| Local | `npm start` → `http://localhost:4173` | — |

## GitHub Pages (one-time setting)

1. Repository → **Settings → Pages**.
2. Under *Build and deployment*, set **Source = GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually from the Actions tab).

The workflow uploads the repository root as the site. It already handles the `/1018/` sub-path:
`404.html` derives the base path from `location`, and every other page uses relative URLs.

## Vercel (two options)

**Option A — Git integration (recommended, auto-deploys on every push)**

1. In Vercel, open **Account Settings → Authentication → Login Connections** and connect GitHub
   (this is the “Login Connection” Vercel asks for when linking a repository).
2. **Add New → Project → Import Git Repository → `Rusindu12/1018`.**
3. Framework preset: **Other**. Build command: *(empty)*. Output directory: `.`
4. Deploy. `vercel.json` already sets the security/cache headers.

**Option B — CLI, no GitHub integration needed**

```bash
npm i -g vercel
vercel login
vercel --prod          # run from the repository root
```

Both options serve the same files, so links, themes and every lab behave identically.

## Android APK (CryptoAI PRO)

A second artefact lives in `mobile/`: the **CryptoAI PRO** app, built as one self-contained HTML file
and wrapped in a Capacitor Android project.

| Target | Status | Where the file lands |
|--------|--------|----------------------|
| Browser | `cryptoai.html` is already served by Pages / Vercel / jsDelivr | `https://<host>/cryptoai.html` |
| Android APK | `.github/workflows/android-apk.yml` builds on every push to `main` and on `v*` tags | **Releases → “CryptoAI PRO APK (latest build)”**, or the run's artefact |
| Local build | `cd mobile && npm ci && npm run build && npx cap sync android && npm run apk:debug` | `mobile/android/app/build/outputs/apk/debug/` |

The workflow needs no secrets for a debug APK. Set `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
`KEY_ALIAS` and `KEY_PASSWORD` as repository secrets to get a signed release APK instead.
Full instructions, permissions and troubleshooting: **[mobile/README.md](mobile/README.md)**.

## Notes

- Google Fonts is the only external request at runtime. The site falls back to system fonts offline.
- All training data is generated in the browser, so no CDN, API or dataset hosting is required.
- `npm test` (40 tests) is safe to run in CI; the HTTP smoke test binds an ephemeral port.
