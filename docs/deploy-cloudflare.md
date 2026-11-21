# Deploying on Cloudflare Pages

The whole site runs in the browser (no server code), so Cloudflare Pages can host it as plain files.

## Settings in Cloudflare (Workers & Pages → Create → Pages → Connect to Git)

| Setting | Value |
|---|---|
| Repository | `team-1-aljadreyah/project-3` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build:static` |
| Build output directory | `out` |
| Root directory | (empty) |

**Environment variables** (Settings → Variables, for "Production" and "Preview"):

| Variable | Production (the real site) | A demo site |
|---|---|---|
| `NODE_VERSION` | `24` | `24` |
| `NEXT_PUBLIC_USE_MOCK` | `false` | `true` |
| `NEXT_PUBLIC_API_URL` | the backend's address, e.g. `https://api.example.com` (no `/api/v1`) | not needed |

`NEXT_PUBLIC_*` values are built into the files: after changing one, deploy again. Never put a secret in them.

## What the build does

1. `next build` with `output: "export"` (next.config.ts turns it on for `build:static`) writes the site into `out/`.
2. Each page with an id (`/projects/[id]`, `/tasks/[id]`, `/bugs/[id]`, `/announcements/[id]`, `/performance/[id]`,
   `/chat/[key]`) is built once, for the id `_`.
3. `scripts/flatten-segments.mjs` (run by npm after the build) copies the small preload files under the names the
   browser asks for.
4. `public/_redirects` (copied into `out/`) tells Cloudflare to serve the `_` page for every id. The page reads the real
   id from the address (`src/shared/lib/route-param.ts`).
5. `public/_headers` adds safety headers, and long caching for the files in `/_next/static/`.

## Before the real site goes live

- **The backend must allow the site's address (CORS):** the site calls the API from its own address, for example
  `https://project-3.pages.dev` or the client's domain. The backend has to accept requests from that origin (and send
  cookies, if the login uses them). To agree with the backend developer.
- **The domain:** Pages → Custom domains → add the client's domain (DNS by Cloudflare, or a CNAME to `*.pages.dev`).
- **Agree the move with DevOps**, since the live site is hosted elsewhere today.

## Try it on this computer

```bash
NEXT_PUBLIC_USE_MOCK=true npm run build:static   # the demo, as plain files
npm run serve:static                              # http://localhost:3100, with the same _redirects rules
E2E_STATIC=true npm run test:e2e                  # every browser test on it (all pass)
```
