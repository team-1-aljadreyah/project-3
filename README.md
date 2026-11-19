# Projects Platform (front end)

The company's platform for running projects, tasks, teams and staff in one place: boards, chat, announcements,
bug tracking, performance and reports. Arabic first (right to left), with English, and light and dark themes.

> The platform's name is a placeholder until the client names it (`src/shared/lib/brand.ts`).

Built with **Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4**. `npm run build` makes `.next/`, and
`npm run start` serves it (a Node.js server).

## Getting started

You need Node.js 24 and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:3000. With `NEXT_PUBLIC_USE_MOCK=true` the site runs on demo data in the browser,
no backend needed. The login page has a one-tap button for each job (demo only; the real site never has them).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Builds the site into `.next/` |
| `npm run start` | Serves the built site (port 3000; the browser tests use 3100) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Next.js route types, then TypeScript (no output files) |
| `npm test` | Unit tests (Vitest) for the rules and helpers |
| `npm run test:e2e` | Browser tests (Playwright) on phone and desktop sizes. Run `npm run build` first, with `NEXT_PUBLIC_USE_MOCK=true` |
| `npm run check:no-demo` | After a real build (`NEXT_PUBLIC_USE_MOCK=false`): fails if a demo account or password is in `.next/` |

Jenkins runs `npm ci`, lint, typecheck, unit tests, the real build with the no-demo check, the demo build and
the browser tests on every push.

## Configuration

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | The backend's address, without `/api/v1` (it is added) |
| `NEXT_PUBLIC_USE_MOCK` | `true`: demo data in the browser. `false`: the real API |

`NEXT_PUBLIC_*` values are built into the files and anyone can read them. Never put a secret in them.
They are read when the site is **built**: change them, then build again (or restart `npm run dev`).

**Hosting (not decided yet):** Next.js needs a Node.js 24 server (`npm ci && npm run build && npm run start`, behind
nginx or in Docker) or a host that runs Next.js (Vercel, Cloudflare with OpenNext). Addresses like `/projects/1` are
made when they are opened, so a plain static host is not enough.

**Drawn in the browser:** the signed-in person, the language and the demo data live in the browser's storage, so the
pages are drawn in the browser (`src/app/providers.tsx` waits for it). The server sends the frame, the title and the
start-up script. Drawing pages on the server can come later, with the real backend's cookie session.

## How it is built

The code is in **feature folders**: everything about one part of the product (its pages, components, API calls,
demo backend and types) sits together.

```text
src/
├── app/              Next.js App Router, routes only: a folder per address with its page.tsx (one line: the
│                     feature's page), layout.tsx (the HTML page, the start-up script), providers.tsx, the
│                     (signed-in) group with its layout, not-found, error, loading, styles.css
├── features/
│   ├── admin/        users and roles, teams, settings, data health, and the audit log
│   ├── announcements/ company announcements, who has and hasn't seen them
│   ├── attachments/  file attachments (tasks, projects) and the project files page
│   ├── auth/         sign in, the sign-in check for signed-in pages, the list of people
│   ├── chat/         project, team and private chats: replies, @mentions, files, unread counts
│   ├── performance/  per person and team over a period, review criteria (CEO), reviews and their trend
│   ├── reports/      the CEO dashboard and the reports (by project, team and person, sprint), CSV download
│   ├── projects/     the projects list, project setup (members, statuses, phases, sprints, history), sprint rules, templates, counts
│   ├── bugs/         the bug tracker: report, the fix flow, reports
│   ├── github/       the GitHub link: per-project setting, PRs and commits on tasks and bugs
│   ├── notifications/ the bell, the notifications page and preferences
│   └── tasks/        the project boards (Kanban, Scrum: sprint, backlog), the task page, dependencies, my tasks, task rules
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

Between features: `bugs` uses `tasks`, `attachments`, `projects` and `auth`; `tasks` uses `attachments`, `projects` and `auth`; `chat` uses `attachments` and `auth`; `reports` uses `bugs`, `projects`, `announcements` and `auth`; `performance` uses `projects` and `auth`; `admin` uses `auth`; `projects`, `tasks` and `bugs` use `github` (it uses no feature); `attachments` uses `projects` and `auth`; `projects`,
`notifications` and `announcements` use `auth`. Never the other way, so there is no loop.

**How data flows:**

- **Pages never call the network themselves.** They call a feature's API (`tasksApi`, `projectsApi`, `authApi`).
  Each one is the real server (`…Http`) or the demo backend (`mock.ts`), chosen by `NEXT_PUBLIC_USE_MOCK`. Both follow the
  same interface, so switching to the real backend changes no page.
- **The demo backend never reaches the real site.** The switch is written out in full where each demo file is
  imported (see `src/shared/api/demo.ts`), so the real build drops those files. `npm run check:no-demo` proves it.
- **Server answers:** `{ "success": true, "data": … }` or `{ "success": false, "message", "code", "errors" }`.
  `src/shared/api/axios.ts` unwraps them, adds the token and the language, and signs out on 401.
- **Statuses belong to each project** (`project.statuses`), each in a colour family (`tone`). The board never
  assumes the seven default statuses.
- **The server is the judge** of who sees what. The interface only hides what a job doesn't use.

## Colours and motion

- **Colours:** wine #7C0E44, mauve #AA5E7A, dusty rose #D49A9A, blush #F2DACE, as tokens in `src/app/styles.css`
  (light and dark). Every text pair is at least 4.5:1. Task status colours stay apart from the brand colour.
- **Motion:** things arrive slightly out of focus and settle into place. `Reveal` (`src/shared/ui/motion.tsx`) does it
  for a block when it scrolls into view; each part of the signed-in site settles in (`.settle` in the frame).
- **The front door** (the sign-in page, `src/features/auth/components/front-door.tsx`): a ring counts the page in and
  folds into the logo (once per visit); a bundle of fine threads of light turns round a bright knot beside the text
  and winds down the page behind the content (`LightThreads`, `src/shared/ui/light-threads.tsx`; placed from the
  blocks marked `data-threads`), and its ends drop down the page as you scroll. Cards and the middle section are
  frosted glass over it (`Frost`: a blurred picture made once, not a live blur, so it stays smooth). A tilting glass
  window shows a live task, a plate opens out of the logo mid-page, and a sprint meter you drag. Signing in is always
  at the top.
- **"Reduce motion"** (the device setting) turns all of it off: the page is simply there. No animation library is used.

## Documentation

- [docs/backend.md](docs/backend.md): the backend contract: every call, who may do what, and the task rules
  the server must enforce. It changes in the same pull request as any API change.

## Claude skills

`.claude/skills/` teaches Claude (Claude Code, opened in this repo) three jobs the team repeats, so they are done
the same way every time, by anyone:

| Skill | What it does |
|---|---|
| `clean-copy-check` | The Jenkins-style check before every push, on a fresh clone with no `.env` (script in `scripts/clean-copy.sh`) |
| `new-feature` | A new feature folder in `src/features/`, following the four rules, with its route, demo data, contract and tests |
| `pr-explanation` | The six-part explanation of a pull request, in simple English |

Claude uses a skill by itself when the task matches; you can also ask for one by name (`/clean-copy-check`).
Skills change through pull requests, like code.

## Working on it

- One branch per change (`feature/…`, `fix/…`, `docs/…`, `chore/…`), merged through a pull request.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
- Every new feature or fix comes with a test.
- Arabic text is written in Modern Standard Arabic (فصحى).
