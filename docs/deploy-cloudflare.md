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
5. `public/_headers` adds safety headers, long caching for the files in `/_next/static/`, and no caching for the
   service worker (`/sw.js`), the manifest and the offline page (see below).

## The installable app (phones, tablets, computers)

The site installs as an app: it opens from the home screen in its own window, with its icon, and still opens without a
connection. Nothing to switch on in Cloudflare: it is all in the built files.

| Part | Where |
|---|---|
| The manifest (name, colours, icons, its own window) | `src/app/manifest.ts` → `/manifest.webmanifest` |
| The icons (192, 512, 512 maskable, Apple 180, Android's small notification icon) | `public/icons/`, made from the logo by `node scripts/make-icons.mjs` (commit the PNGs) |
| iPhone/iPad tags, theme colours, the safe areas (notch, home bar) | `src/app/layout.tsx`, `src/app/styles.css` |
| The service worker | `public/sw.js`, registered by `src/shared/pwa/service-worker.tsx` (production builds, on https or localhost) |
| The offline page | `public/offline.html` (everything inside it: nothing else to download) |
| The install offers | the account menu's «ثبّت التطبيق», the iPhone/iPad how-to, the one-time hint on phones (`src/shared/pwa`) |

**What the service worker keeps** (in the browser's cache, on the person's device):

- `/_next/static/*` (scripts, styles, fonts): **cache first**. Their names carry a fingerprint, so a name never changes.
- Pages, the manifest, the icons, the small data files: **the network first** (always the newest), then the saved copy
  when there is no connection, then the offline page («لا يوجد اتصال بالإنترنت», with «أعد المحاولة») for a page never
  opened before. At install it keeps `/`, `/login`, the offline page and the icons, with the files they load.
- **Never:** the backend (`NEXT_PUBLIC_API_URL` is another address; and any `/api/` path anywhere), anything sent with an
  `Authorization` header, anything but `GET`. The pages are only the frame (the data comes from the API, in the
  browser), so nobody's data is ever kept in the cache, and signing out leaves nothing personal behind.

**Versions.** The worker is registered as `/sw.js?v=<build>` (the commit: `CF_PAGES_COMMIT_SHA` on Cloudflare, see
`next.config.ts`), and its cache is named `p3-v<SHELL_VERSION>-<build>`. So every deploy installs a new worker with a
fresh cache, and the old caches are deleted when it takes over. An open tab still on the old version shows
«نسخة جديدة من المنصة جاهزة» with «أعد التحميل». **Bump `SHELL_VERSION` in `public/sw.js`** when you change the worker's
own rules (what it keeps, and how). `_headers` serves `/sw.js` with `Cache-Control: no-cache`, so a new worker is seen at
once.

**The backend and the installed app:** the installed app is the same site at the same address (the same origin), so the
backend's CORS rule for the site's address covers it: nothing more to allow. Keep CORS for every address the site is
served from (the custom domain and `*.pages.dev`).

**Notifications:** the open app (also in the background) plays a short sound and shows a system notification for new
notifications and chat messages (`src/features/notifications`). While the app is closed only the backend can send them
(Web Push): set `NEXT_PUBLIC_PUSH_PUBLIC_KEY` once the backend sends push (docs/backend.md, section 20).

**Installing it:**

- **Android** (Chrome, Edge, Samsung Internet): the account menu → «ثبّت التطبيق», the hint on a phone, or the browser's
  menu → "Install app" / "Add to Home screen".
- **iPhone / iPad** (Safari; Chrome and Edge too from iOS 16.4): Share → «إضافة إلى الشاشة الرئيسية» → «إضافة». The account
  menu's «ثبّت التطبيق» shows these steps.
- **Computers** (Chrome, Edge): the install icon in the address bar, or the account menu.

To check it here: build and serve the plain files (below), open http://localhost:3100 in Chrome, then DevTools →
Application → Manifest, and Service workers. `tests/e2e/pwa.spec.ts` checks both.

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
