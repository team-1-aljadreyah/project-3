# Projects Platform (front end)

The company's platform for running projects, tasks, teams and staff in one place: boards, chat, announcements,
bug tracking, performance and reports. Arabic first (right to left), with English, and light and dark themes.

> The platform's name is a placeholder until the client names it (`src/shared/lib/brand.ts`).

Built with **React 19, Vite, React Router, TypeScript and Tailwind CSS 4**. The site is plain files (`dist/`), so
any static host can serve it.

## Getting started

You need Node.js 24 and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:3000. With `VITE_USE_MOCK=true` the site runs on demo data in the browser,
no backend needed. The login page has a one-tap button for each job (demo only; the real site never has them).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Builds the site into `dist/` |
| `npm run preview` | Serves `dist/` on port 3100, like the real host |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output files |
| `npm test` | Unit tests (Vitest) for the rules and helpers |
| `npm run test:e2e` | Browser tests (Playwright) on phone and desktop sizes. Run `npm run build` first, with `VITE_USE_MOCK=true` |
| `npm run check:no-demo` | After a real build (`VITE_USE_MOCK=false`): fails if a demo account or password is in the files |

Jenkins runs `npm ci`, lint, typecheck, unit tests, the real build with the no-demo check, the demo build and
the browser tests on every push.

## Configuration

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | The backend's address, without `/api/v1` (it is added) |
| `VITE_USE_MOCK` | `true`: demo data in the browser. `false`: the real API |

`VITE_*` values are built into the files and anyone can read them. Never put a secret in them.

**Hosting (not decided yet):** the site has one HTML page and React Router draws every address in the browser,
so the host must answer every path (`/projects/1`) with `index.html`. Cloudflare Pages does this by itself (when
there is no `404.html`); nginx needs `try_files $uri /index.html;`.

## How it is built

The code is in **feature folders**: everything about one part of the product (its pages, components, API calls,
demo backend and types) sits together.

```text
index.html            the one HTML page (Arabic, right to left; a tiny script sets the saved language and theme)
src/
├── main.tsx          the start: draws the app into index.html
├── app/              routing only: every address and its page (routes.tsx), the layouts, 404, styles.css
├── features/
│   ├── auth/         sign in, the sign-in check for signed-in pages, the list of people
│   ├── projects/     the projects list, project types and counts (done, late, blocked)
│   └── tasks/        the project board, the task page, task rules, and their parts
├── shared/
│   ├── ui/           the design system (tokens in app/styles.css)
│   ├── shell/        the top bar, the account menu, the signed-in frame
│   ├── api/          the HTTP client, errors, the demo switch, shared types
│   └── lib/          language, theme, dates, session, loading data, access rules
└── mock/             the demo database (seed + browser storage) and helpers for the demo backends
tests/
├── unit/             Vitest
└── e2e/              Playwright
```

**The four rules of the folders:**

1. `app/` only routes. Pages live in their feature.
2. A feature is a closed box: other code imports it only from its `index.ts`.
3. `shared/` never imports a feature. The direction is `app → features → shared`.
4. Each feature owns its `api.ts`, `mock.ts` and `types.ts`.

Between features: `tasks` uses `projects` and `auth`, `projects` uses `auth`, never the other way, so there is no loop.

**How data flows:**

- **Pages never call the network themselves.** They call a feature's API (`tasksApi`, `projectsApi`, `authApi`).
  Each one is the real server (`…Http`) or the demo backend (`mock.ts`), chosen by `VITE_USE_MOCK`. Both follow the
  same interface, so switching to the real backend changes no page.
- **The demo backend never reaches the real site.** The switch is written out in full where each demo file is
  imported (see `src/shared/api/demo.ts`), so the real build drops those files. `npm run check:no-demo` proves it.
- **Server answers:** `{ "success": true, "data": … }` or `{ "success": false, "message", "code", "errors" }`.
  `src/shared/api/axios.ts` unwraps them, adds the token and the language, and signs out on 401.
- **Statuses belong to each project** (`project.statuses`), each in a colour family (`tone`). The board never
  assumes the seven default statuses.
- **The server is the judge** of who sees what. The interface only hides what a job doesn't use.

## Documentation

- [docs/backend.md](docs/backend.md): the backend contract: every call, who may do what, and the task rules
  the server must enforce. It changes in the same pull request as any API change.

## Working on it

- One branch per change (`feature/…`, `fix/…`, `docs/…`, `chore/…`), merged through a pull request.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
- Every new feature or fix comes with a test.
- Arabic text is written in Modern Standard Arabic (فصحى).
