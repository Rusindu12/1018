# Deploying NeuraLab

NeuraLab is a **pure static site**: HTML, CSS and ES modules. There is no build step, no environment
variable and no server-side code in production (`server.js` is only a convenience for local previews).

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

## Notes

- Google Fonts is the only external request at runtime. The site falls back to system fonts offline.
- All training data is generated in the browser, so no CDN, API or dataset hosting is required.
- `npm test` (40 tests) is safe to run in CI; the HTTP smoke test binds an ephemeral port.
