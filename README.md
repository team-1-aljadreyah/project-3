# Projects Platform (front end)

The company's platform for running projects, tasks, teams and staff in one place: boards, chat, announcements,
bug tracking, performance and reports. Arabic first (right to left), with English, and light and dark themes.

> The platform's name is a placeholder until the client names it (`lib/brand.ts`).

## Getting started

You need Node.js 24 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. With `NEXT_PUBLIC_USE_MOCK=true` the site runs on demo data in the browser,
no backend needed. The login page has a one-tap button for each job (demo only; the real site never has them).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output files |
| `npm test` | Unit tests (Vitest) for the rules in `lib/` |
| `npm run test:e2e` | Browser tests (Playwright) on phone and desktop sizes. Run `npm run build` first, with `NEXT_PUBLIC_USE_MOCK=true` |

| `npm run check:no-demo` | After a real build (`NEXT_PUBLIC_USE_MOCK=false`): fails if a demo account or password is in the files |

Jenkins runs `npm ci`, lint, typecheck, unit tests, the real build with the no-demo check, the demo build and
the browser tests on every push.

## Configuration

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | The backend's address, without `/api/v1` (it is added) |
| `NEXT_PUBLIC_USE_MOCK` | `true`: demo data in the browser. `false`: the real API |

`NEXT_PUBLIC_*` values are built into the files and anyone can read them. Never put a secret in them.

## How it is built

- **Pages never call the network themselves.** They call `api` (`lib/api/index.ts`), which is the demo backend
  (`lib/api/mock.ts`) or the HTTP client (`lib/api/http.ts`), chosen by `NEXT_PUBLIC_USE_MOCK`. Both follow the
  `Api` interface, so switching to the real backend changes no page.
- **Server answers:** `{ "success": true, "data": … }` or `{ "success": false, "message", "code", "errors" }`.
  `lib/api/axios.ts` unwraps them, adds the token and the language, and signs out on 401.
- **Statuses belong to each project** (`project.statuses`), each in a colour family (`tone`). The board never
  assumes the seven default statuses.
- **The server is the judge** of who sees what. The interface only hides what a job doesn't use.

```text
app/
├── (app)/            signed-in pages, inside the top bar (components/shell)
├── login/            sign in
components/
├── ui/               the design system (tokens in app/globals.css)
├── shell/            top bar, account menu, the signed-in frame
├── board/, projects/ feature parts
lib/
├── api/              api switch, HTTP client, types, demo backend (mock/)
├── tasks.ts          task rules (grouping, lateness, counts)
├── format.ts, i18n   Arabic / English text, numbers and dates
tests/
├── unit/             Vitest
└── e2e/              Playwright
```

## Working on it

- One branch per change (`feature/…`, `fix/…`, `docs/…`, `chore/…`), merged through a pull request.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
- Every new feature or fix comes with a test.
- Arabic text is written in Modern Standard Arabic (فصحى).
