# Projects Platform (front end) ttttttt

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
| `npm run build:static` | Builds the site as plain files into `out/`, for Cloudflare Pages ([docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)) |
| `npm run serve:static` | Serves `out/` on port 3100 the way Cloudflare Pages does (its `_redirects` rules), to try it here |
| `npm run lint` | ESLint |
| `npm run typecheck` | Next.js route types, then TypeScript (no output files) |
| `npm test` | Unit tests (Vitest) for the rules and helpers |
| `npm run test:e2e` | Browser tests (Playwright) on phone and desktop sizes. Run `npm run build` first, with `NEXT_PUBLIC_USE_MOCK=true` |
| `node scripts/make-icons.mjs` | Makes the app icons (`public/icons/`) from the logo again, after it changes |
| `npm run check:no-demo` | After a real build (`NEXT_PUBLIC_USE_MOCK=false`): fails if a demo account or password is in `.next/` or `out/` |

Jenkins runs `npm ci`, lint, typecheck, unit tests, the real build and the Cloudflare build with the no-demo check,
the demo build and the browser tests on every push. `E2E_STATIC=true npm run test:e2e` runs the browser tests on the
plain-files build instead (after `NEXT_PUBLIC_USE_MOCK=true npm run build:static`).

## Configuration

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | The backend's address, without `/api/v1` (it is added) |
| `NEXT_PUBLIC_USE_MOCK` | `true`: demo data in the browser. `false`: the real API |

`NEXT_PUBLIC_*` values are built into the files and anyone can read them. Never put a secret in them.
They are read when the site is **built**: change them, then build again (or restart `npm run dev`).

**Hosting:** the whole site runs in the browser, so it can be plain files: **Cloudflare Pages** with
`npm run build:static` (steps in [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)). The pages with an id
(`/projects/1`) are built once and `public/_redirects` serves them for every id; they read the id from the address
(`src/shared/lib/route-param.ts`). A Node.js 24 server (`npm run build && npm run start`) works too.

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
│   ├── admin/        users and roles, teams, structure, import, sessions and security, system health, settings, the audit log
│   ├── advanced/     the CEO's advanced settings: working time, rights, notifications, features, banner, history
│   ├── announcements/ company announcements, who has and hasn't seen them
│   ├── attachments/  file attachments (tasks, projects) and the project files page
│   ├── auth/         sign in, the sign-in check for signed-in pages, the list of people
│   ├── chat/         project, team, private and group chats: replies, @mentions, files, voice messages, unread counts
│   ├── performance/  per person and team over a period, review criteria (CEO), reviews and their trend
│   ├── profile/      my profile and my picture: pick, crop, the small square the browser sends
│   ├── ratings/      quick ratings of teams and people (a score and a reason, any time), the teams list and team pages
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
│   ├── pwa/          the installable app: the service worker's app side, install offers, sounds, system notifications
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

Between features: `bugs` uses `tasks`, `attachments`, `projects` and `auth`; `tasks` uses `attachments`, `projects` and `auth`; `chat` uses `attachments` and `auth`; `reports` uses `bugs`, `projects`, `announcements`, `ratings` and `auth`; `performance` uses `ratings`, `projects` and `auth`; `ratings` uses `projects` and `auth`; `admin` uses `auth` and `profile` (`profile` uses no feature); `advanced` uses `admin`, `bugs`, `reports` and `notifications` (nothing uses it but `app/`); `projects`, `tasks` and `bugs` use `github` (it uses no feature); `attachments` uses `projects` and `auth`; `projects`,
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
- **The dashboard** (`/dashboard`) opens with a section made for each job (`src/features/reports/components`): the CEO
  gets a night banner with the page's name, today's numbers and the way to the reports (`CeoHero`); the department manager gets a task calendar (the days around
  today) and a board of every task in their projects (`PmPlan`); the team leader gets a slide where a glass sphere
  clears to show the team's tasks as smaller spheres, with the four shares beside it (`LeadSphere`); monitoring and
  evaluation gets a banner with who is signed in, summary cards, and every project against its plan with a filter and a
  search (`MonitorSummary`). In that banner a small character drawn in code (a monitoring officer with a ponytail,
  glasses and a tablet, `MonitorCharacter`) breathes, blinks and swipes her tablet, and waves when the mouse goes over
  her; she stands behind the profile card, so she never covers it.
  The monitoring officer and the CEO also get "Upcoming birthdays" (the next 30 days, day and month only), and a
  reminder in the bell a week before and on the day (`src/shared/lib/birthday.ts`, docs/backend.md section 20).
- **Monitoring** (`src/features/monitoring`): the monitoring officer writes reports about teams and people, feedback
  on anyone and problems at `/monitoring` (or builds a report from the numbers at `/monitoring/report`), and sends any
  of them to the CEO. Every other job sends the CEO requests at `/requests` (nobody starts a chat with the CEO). The CEO
  answers in `/inbox`: "To handle", and "Done", the archive kept to read again.
- **Quick ratings** (`src/features/ratings`): the monitoring officer (and the CEO; a PM in their own projects) rates any team
  or person at any time, for any reason: five labelled steps (ضعيف … ممتاز), a kind of reason («سبب آخر» always there),
  the reason in her words, visible or private. They show on `/teams`, each team's page `/teams/:id`, the performance page
  and each person's page, apart from the periodic reviews (docs/backend.md section 21).
- **Quick search** (`src/features/search`, Ctrl+K or the top bar): pages, projects, tasks, bugs, announcements and
  people, only what the person may see (docs/backend.md section 18).
- **Links everywhere:** numbers, rows and names open their pages (a person's name only when the viewer may open their
  performance: `personHref` in `src/shared/lib/access.ts`). Tabs and filters live in the address (`useQueryParam`,
  e.g. `/reports?tab=people&team=1`, `/bugs?show=late`, `/inbox?show=done`), so a link opens a page already set.
- **The audit log** (`/audit`, the admin and the CEO, `src/features/admin`): a search box and filters (action, kind,
  person, IP, days) kept in the address, each line with its IP and device, failed sign-ins marked in red. Pressing a line
  opens a side panel (the whole screen on a phone; `?entry=<id>` in the address, Back or Escape closes it): who, what,
  when to the second, from where (IP, browser and system, session), what changed before → after, the same person's other
  actions that day and the subject's history, and "Copy details"; ↑/↓ step through the list.
- **Advanced settings** (`/advanced`, the CEO only, `src/features/advanced`): every company rule in one page, like
  Project 2's: a side tree with a quick find (`?s=<part>` in the address; a short list on the phone), one draft for all
  parts with «Changed» and the default beside each setting, a save bar, and the history, file and reset. «Jobs and
  roles» lets the CEO make new jobs that start like an existing one and take away actions and menu pages; the admin
  gives them to accounts (`User.custom_role`), and `roleName()` in `src/shared/lib/site.ts` shows their name everywhere. What every
  page obeys (features switched off, the banner, read-only mode) reaches the frame through `src/shared/lib/site.ts`;
  docs/backend.md section 17 says what is enforced now and what is saved for later.
- **The account menu** (`src/shared/shell/account-menu.tsx`): the avatar at the end of the top bar opens a card with the
  person's picture (its camera changes it), name, job and email, two small switches for day/night and the language,
  "My profile", "My performance" (not for the CEO and the admin), and signing out. It opens with a short fade and grow.
- **Profile pictures** (`src/features/profile`): every job sets, changes and removes their own picture from "My profile":
  pick a JPEG, PNG or WebP (or drop it on the window), drag and zoom it in a round crop, and the browser sends a small
  256×256 WebP. It shows wherever the person's avatar shows (`Avatar`, `src/shared/ui/avatar.tsx`; their first letter
  when there is none). The admin and the CEO can remove a picture that is not appropriate (docs/backend.md section 19).
- **The welcome splash** (`src/shared/shell/welcome-splash.tsx`): each time the app opens (a new tab or browser start), a
  short greeting with the person's first name, job and the day (and «عيد ميلاد سعيد» on their birthday) lifts away
  into their page. It never blocks a click.
- **"Reduce motion"** (the device setting) turns all of it off: the page is simply there. No animation library is used.

- **The installable app** (`src/shared/pwa`, `public/sw.js`, `src/app/manifest.ts`): the site installs on phones,
  tablets and computers and opens without a connection (pages seen before, else an offline page); the account menu offers
  «ثبّت التطبيق» when the browser can (a how-to on iPhone and iPad). While it is open, a new notification or chat message
  from someone else rings and shows a system notification; the bell reminds of chats not read yet, and `/notifications`
  sets the alerts of each device ([docs/deploy-cloudflare.md](docs/deploy-cloudflare.md); push while it is closed:
  docs/backend.md section 22).

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
