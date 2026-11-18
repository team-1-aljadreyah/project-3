---
name: new-feature
description: Creates a new feature in Project 3 the way the codebase is organized, in src/features/<name> with its own api.ts (real server + demo switch), mock.ts, types.ts, index.ts, pages and components, plus its route, menu item, demo data, backend contract and tests. Use it whenever someone wants to start a new part of the product (chat, announcements, bugs, notifications, reports, users, dashboard, attachments...), add a new page or screen, or asks "where should this code go", even if they don't say "feature".
---

# New feature folder

Project 3 is organized by **feature**: everything about one part of the product (its pages, components, API
calls, demo backend, types and rules) lives in one folder, `src/features/<name>/`. A new person can open one
folder and see the whole feature, and a feature can change without touching the others.

Read `README.md` ("How it is built") once if you haven't. The templates to copy are in
`references/templates.md`.

## The four rules (why they exist)

1. **`src/app/` only routes.** Pages live in their feature; `app/` only says which address shows which page.
   Then the list of addresses stays short and readable.
2. **A feature is a closed box.** Other code imports it **only from its `index.ts`**. The feature can rename or
   move its inside files without breaking anyone. (Tests may import inside files directly.)
3. **`src/shared/` never imports a feature.** The direction is always `app → features → shared`. Shared code
   (the design system, the top bar, the HTTP client) must work for every feature, so it can't depend on one.
4. **Each feature owns its `api.ts`, `mock.ts` and `types.ts`.** Its calls, its demo backend and its data shapes
   stay together.

**No loops between features.** Today: `tasks → projects → auth → shared`. A new feature may import features
lower in that chain, but nothing lower may import it back. If two features seem to need each other, move the
shared piece down (into the lower feature, or into `shared/` if it is truly general) and explain why.

## Before you write code

- **Check the brief.** The client's brief comes first. If the feature or a detail is not in the brief, ask the
  person before building it.
- **Name it** in English, lowercase, plural where natural: `announcements`, `bugs`, `chat`, `notifications`.
- **No new library** without asking first, saying what it saves and what it costs.
- **Find what is already in `shared/`** (`shared/ui` has Button, Field, Dialog, Toast, Pill, Avatar, Skeleton,
  Empty, ErrorBox, ProgressBar, Stat) and use it instead of writing a new one.

## Steps

Copy each file's template from `references/templates.md` and fill it in.

1. **`types.ts`**: the data shapes, exactly as the server will send them (snake_case fields, ISO dates).
   People, jobs, priorities and status colours are already in `@/shared/api/types`; import those.
2. **`api.ts`**: the `XxxApi` interface (every call), `xxxHttp` (the real calls, through `http` from
   `@/shared/api`), and the switch:
   `import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.xxxMock)) : xxxHttp`.
   **Write the switch out in full exactly like this.** Through a variable or a helper, the build can't tell the
   demo branch never runs, and the demo data ends up in the real site (the no-demo check will fail).
3. **`mock.ts`**: the demo backend, with the **same rules the real server must keep** (who may see and change
   what, required fields, limits). It is the living reference for the backend developer, so refuse what the
   server would refuse, with the same status codes (`fail(403, "FORBIDDEN", ar, en)`, `invalid(field, ar, en)`)
   and Arabic in فصحى. Use `currentUser()`, `wait()`, `getDb()` and `commit()` from `src/mock`.
4. **Demo data** in `src/mock/seed.ts`: add the new lists to `MockDb` and to `seed()`, with invented people and
   text only (never real customer data), and **bump `DB_VERSION`** in `src/mock/db.ts` so browsers drop their
   old saved demo data.
5. **Rules** (who may do what, counts, status changes) go in `rules.ts` as pure functions, used by both the pages
   (to hide what someone can't do) and `mock.ts` (to refuse it). Hiding a button is not security; the server
   must refuse too.
6. **Pages** in `pages/`, **parts** in `components/`, **hooks** in `hooks/`. Every page:
   - sets its tab title with `usePageTitle(tr("…", "…"))`;
   - loads with `useLoad(() => xxxApi.something(), [deps])` and shows **all four states**: loading
     (`LoadingBlock` + `Skeleton`), error (`ErrorBox` with retry), empty (`Empty`), and the data;
   - writes every text as `tr("عربي فصيح", "English")`;
   - makes a whole row or card one link (click anywhere), not only the underlined name;
   - works on a phone, in dark mode and in English (left to right).
7. **`index.ts`**: export only what others need (the API, the pages, a few types or rules).
8. **Route** in `src/app/routes.tsx`, inside the signed-in layout, loaded lazily:
   `{ path: "/announcements", lazy: () => import("@/features/announcements").then((m) => ({ Component: m.AnnouncementsPage })) }`.
9. **Menu**: in `src/shared/lib/access.ts` set the item's `ready: true` (or add it) with the jobs that see it.
10. **Backend contract**: add every new call to `docs/backend.md` (path, body, answer, who may call it, errors)
    **in the same pull request**. If a call changes later, the contract changes in the same PR too.
11. **Tests**: every feature comes with tests.
    - `tests/unit/<name>.test.ts` (Vitest): the rules and the demo backend's refusals, called as different people.
    - `tests/e2e/<name>.spec.ts` (Playwright): sign in with `signInAs(page, /name/)`, open the page, do the main
      flow, check what each job sees and doesn't.
12. **Check** with the `clean-copy-check` skill before pushing, then explain the change with the
    `pr-explanation` skill.

## Done means

- `npm run lint`, `npm run typecheck`, `npm test`, both builds, `npm run check:no-demo` and `npm run test:e2e`
  pass (the clean-copy check runs them all);
- the page shows loading, empty, error and data states, on a phone and a computer, light and dark, AR and EN;
- `docs/backend.md` lists the new calls;
- nothing outside the feature imports its inside files, and `shared/` imports no feature.
