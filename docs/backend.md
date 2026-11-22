# What the backend must provide

Everything the real backend has to do for the site to work as it works on the demo data.

**The reference already runs.** The site works today on a fake backend in the browser (`src/features/*/mock.ts`,
rules in `src/features/tasks/rules.ts` and `src/features/projects/counts.ts`, data in `src/mock/seed.ts`). It has the
same calls as the real one (`src/features/*/api.ts`: paths, bodies, answers; shapes in each feature's `types.ts` and
`src/shared/api/types.ts`). When something here is not
clear, the matching function there is the exact behaviour the pages expect. The unit tests
(`tests/unit/task-flow.test.ts`) list the rules one by one.

Switching the site to the backend: `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_URL=https://api…`, then rebuild.

## 0. Start here

**What the front end is:** a Next.js site built as plain files and hosted on **Cloudflare Pages**
(`docs/deploy-cloudflare.md`). It runs entirely in the browser and talks to the backend only through the calls
below, with a Bearer token. So the API must allow the site's addresses (CORS): `https://follow.ama8.uk` and the
Cloudflare Pages preview address.

**The real server today** (compared with its OpenAPI, https://followapi.ama8.uk/docs, on 21 November 2026): the base
`https://followapi.ama8.uk/api/v1`, Sanctum Bearer tokens, `Accept-Language`, the `{ success, data }` answer and the
error shape (`{ success: false, message, code, errors: { field: "message" } }`) all match the front end, and **73 of
the front end's 106 calls** are there (the 5 request and sharing calls and the 9 rating calls of 22 November are new). Still to build on the server (each is in its section below; the demo backend in
`src/features/<feature>/mock.ts` is the reference):

| Feature | Calls | Section |
|---|---|---|
| Group chats | `POST /chats/groups`, `PATCH /chats/:key`, `POST /chats/:key/leave` | 11 |
| Monitoring notes, requests, the CEO's inbox | `GET`/`POST /monitoring/notes` (with `share_ids`), `POST /monitoring/notes/:id/send`, `GET /ceo/inbox`, `POST /ceo/inbox/:id/answer` (with `reopen`), `GET /monitoring/report-facts` | 16 |
| Requests pass through monitoring; notes to anyone | `POST /monitoring/requests/:id/forward`, `POST /monitoring/requests/:id/answer`, `POST /monitoring/notes/:id/share`, `GET /monitoring/received`, `POST /monitoring/notes/:id/seen` | 16 |
| The CEO's advanced settings and new roles | `GET`/`PUT /ceo/advanced`, `GET /ceo/advanced/history`, `GET /site/live` | 17, 17.1 |
| Audit details | `GET /audit/:id`; `GET /audit` with `q`, `kind`, `ip`; `ip`, `user_agent`, `session_id`, `request_id` on every line | 14 |
| Quick search | `GET /search?q=` | 18 |
| Profile pictures | `PUT /me/avatar`, `DELETE /me/avatar`, `DELETE /users/:id/avatar` | 19 |
| Birthdays | `birth_date` on the users calls (who sees the year), a daily job for `birthday_soon` and `birthday_today` | 20 |
| Quick ratings of teams and people, the team pages | `GET /teams/ratings/summary`, `GET /teams/:id`, `GET`/`POST /teams/:id/ratings`, `GET /people/ratings/summary`, `GET`/`POST /people/:id/ratings`, `PATCH`/`DELETE /ratings/:id` | 21 |

Also on existing calls: `User` gets `avatar_url` (19), `custom_role` (17.1), and `birth_date` and `birthday` (20); `Notification` gets `team_id` and the kinds `team_rated`, `person_rated` (7, 21); the audit log gets `rating_changed`, `rating_deleted` (14); the custom roles' actions get `give_ratings` (17.1); error codes `FEATURE_OFF` (403) and
`READ_ONLY` (423) (17); `POST /projects` is allowed to the `monitor` too, who sends `pm_id` (2); `POST /chats/direct`
with the CEO as the other person is 403 for every job **except the `monitor`** (16); requests (`kind: "request"`) come from
every job except the CEO and **reach the monitoring officer first** (16, since 22 November 2026); the `pm` job is now
called «مدير القسم» / "Department manager" on every screen (the code `pm` is unchanged). The front end now calls `POST /auth/logout` when someone signs out (the server already
has it). `null` for an empty `name_en`, `phone` or `team_id` is fine: the front end treats it as empty.

**See every screen working before you build:** `npm ci`, then `NEXT_PUBLIC_USE_MOCK=true npm run dev`, open
http://localhost:3000 and sign in with any one-tap demo account (password `123456`). Each screen there is exactly
what your answers must make possible. The demo backend of a feature is `src/features/<feature>/mock.ts`: when this
document and the code disagree, the code is what the pages expect (and tell us, so we fix this document).

**Build it in this order** (each step makes a part of the site usable on the real server):

| Step | What | Sections | Then the site can… |
|---|---|---|---|
| 1 | Sign-in, `/me`, `/users`, the answer and error format, CORS | 1, 2 | sign people in |
| 2 | Projects, tasks, statuses, comments, history, the task rules | 3, 4, 5 | run the boards (the heart of the product) |
| 3 | Project setup: members, statuses, phases, sprints, templates | 6 | set projects up |
| 4 | Notifications, made by the server on each action | 7 | tell people what happened |
| 5 | Files, announcements, bugs, chat | 8 to 11 | do the rest of the daily work |
| 6 | Dashboard and reports, performance | 12, 13 | give the management its numbers |
| 7 | Administration, the audit log, sign-in locking | 14 | run the platform |
| 8 | GitHub, monitoring notes and the CEO's inbox | 15, 16 | the extras |
| 9 | The CEO's advanced settings and what they switch | 17 | let the CEO run the rules without a developer |
| 10 | Profile pictures | 19 | let everyone put a face to their name |
| 11 | Birthdays: the field, who sees the year, the daily reminders | 20 | remind monitoring of everyone's birthday |
| 12 | Quick ratings of teams and people, the team pages | 21 | let monitoring rate any team or person, for any reason |

**Rules that apply to everything:**
- **The server is the judge.** The menu hides what a job can't use, but the server must refuse it (**403**), and must
  answer **404** for anything a person may not see (as if it didn't exist).
- **The CEO rule** (§2): the `ceo` may see and do everything any other job can, today and in every call added later.
- Every list comes already filtered for the person. Every form's errors come per field, in Arabic and English.
- Notifications are made **by the server** as part of the action (§7). The front end never creates them.

### Every call, in one table

| § | Method | Path | Who (the `ceo` always may too) | What |
|---|---|---|---|---|
| 1 | `POST` | `/auth/login` | anyone | Sign in → `{ token, user }` |
| 1 | `POST` | `/auth/logout` | signed in | Sign out: cancel this token (the front end calls it, then forgets the token) |
| 1 | `GET` | `/me` | signed in | The signed-in person |
| 2 | `GET` | `/users` | signed in | Everyone's public profile (names, roles, teams, `avatar_url`, `birthday` "MM-DD") for pickers and avatars; the year (`birth_date`) only your own, or for the admin and the CEO (20) |
| 19 | `PUT` | `/me/avatar` | signed in (only yourself) | Set or replace my picture (`multipart/form-data`, field `file`) → the updated `User` |
| 19 | `DELETE` | `/me/avatar` | signed in (only yourself) | Remove my picture → the updated `User` |
| 19 | `DELETE` | `/users/:id/avatar` | admin, ceo | Remove someone's picture that is not appropriate → that `User` |
| 5 | `GET` | `/projects` | see §2 | Projects this person may see, with counts |
| 5 | `GET` | `/projects/:id` | see §2 | One project with its statuses, phases, members |
| 6 | `POST` | `/projects` | ceo, pm, monitor | Create a project (a pm becomes its manager; the ceo and the monitor pick one) |
| 6 | `PATCH` | `/projects/:id` | its pm, ceo | Details, members, dates (changing `pm_id`: ceo only) |
| 6 | `PUT` | `/projects/:id/statuses` | its pm, ceo | The project's statuses, in board order |
| 6 | `PUT` | `/projects/:id/phases` | its pm, ceo | The project's phases |
| 6 | `GET` | `/projects/:projectId/sprints` | see §2 | Sprints |
| 6 | `POST` | `/projects/:projectId/sprints` | its pm, ceo | Add a sprint |
| 6 | `PATCH` | `/sprints/:id` | its pm, ceo | Change a sprint |
| 6 | `DELETE` | `/sprints/:id` | its pm, ceo | Remove an empty sprint |
| 6 | `POST` | `/sprints/:id/close` | its pm, ceo | End a sprint, move what is left |
| 6 | `GET` | `/projects/:projectId/history` | see §2 | The project's setup history |
| 6 | `GET` | `/templates` | ceo, pm | Project templates |
| 6 | `POST` | `/projects/:projectId/template` | its pm, ceo | Save a project as a template |
| 6 | `DELETE` | `/templates/:id` | its maker, ceo | Remove a template |
| 5 | `GET` | `/projects/:projectId/tasks` | see §2 | The board's tasks |
| 5 | `GET` | `/me/tasks` | signed in | My tasks in every project |
| 5 | `GET` | `/tasks/:id` | see §2 | One task |
| 5 | `POST` | `/projects/:projectId/tasks` | managers (§2) | Create a task |
| 5 | `PATCH` | `/tasks/:id` | managers (§2) | Change a task |
| 5 | `PUT` | `/tasks/:id/dependencies` | managers (§2) | The tasks it waits for (no loops) |
| 4 | `POST` | `/tasks/:id/status` | managers, assignee | Move a task (may become an approval request) |
| 4 | `POST` | `/tasks/:id/approval` | approvers (§2) | Approve or send back a completion |
| 5 | `GET` | `/tasks/:taskId/comments` | see §2 | Comments |
| 5 | `POST` | `/tasks/:taskId/comments` | takes part (§2) | Add a comment |
| 5 | `GET` | `/tasks/:taskId/history` | see §2 | The task's history |
| 8 | `GET` | `/{tasks\|bugs\|projects\|messages}/:id/attachments` | sees the owner | Files |
| 8 | `POST` | `/{tasks\|bugs\|projects\|messages}/:id/attachments` | takes part | Upload one file (multipart) |
| 8 | `DELETE` | `/attachments/:id` | uploader, its pm, ceo | Remove a file |
| 7 | `GET` | `/notifications` | signed in | My notifications |
| 7 | `POST` | `/notifications/:id/read` | its owner | Mark one read |
| 7 | `POST` | `/notifications/read-all` | signed in | Mark all read |
| 7 | `GET` | `/notifications/preferences` | signed in | My notification choices |
| 7 | `PUT` | `/notifications/preferences` | signed in | Save them (required kinds stay on) |
| 9 | `GET` | `/announcements` | signed in | Announcements, important first |
| 9 | `GET` | `/announcements/:id` | signed in | One announcement |
| 9 | `POST` | `/announcements` | ceo, admin, monitor | Post one (everyone is told) |
| 9 | `DELETE` | `/announcements/:id` | its author, ceo, admin | Remove one |
| 9 | `POST` | `/announcements/:id/seen` | signed in | I have seen it |
| 9 | `GET` | `/announcements/:id/reads` | its author, ceo, admin | Who has and hasn't seen it |
| 10 | `GET` | `/bugs` | see §2 | Bugs of the projects I see |
| 10 | `GET` | `/bugs/:id` | see §2 | One bug |
| 10 | `POST` | `/projects/:projectId/bugs` | takes part | Report a bug |
| 10 | `PATCH` | `/bugs/:id` | managers (§2) | Assign, severity, priority, day |
| 10 | `POST` | `/bugs/:id/status` | see §10 | Move a bug |
| 10 | `GET` | `/bugs/:id/history` | see §2 | The bug's history |
| 11 | `GET` | `/chats` | signed in | My chats (project, team, private; group chats: §11) |
| 11 | `GET` | `/chats/:key/messages` | its members | Messages |
| 11 | `POST` | `/chats/:key/messages` | its members | Send (with @mentions) |
| 11 | `POST` | `/chats/:key/read` | its members | Read up to here |
| 11 | `POST` | `/chats/direct` | signed in | Open a private chat with someone (only the CEO and the monitor start one with the CEO: 403) |
| 11 | `POST` | `/chats/groups` | monitor, pm, lead, ceo | Make a group chat `{name, member_ids}` |
| 11 | `PATCH` | `/chats/:key` | the group's maker, ceo | Rename a group, change its members |
| 11 | `POST` | `/chats/:key/leave` | its members | Leave a group |
| 12 | `GET` | `/reports/overview` | ceo, pm, monitor, lead | Every number of the dashboard and the reports |
| 13 | `GET` | `/performance` | ceo, pm, monitor, lead | People and teams' numbers for a period |
| 13 | `GET` | `/performance/people/:userId` | see §13 | One person's numbers and reviews |
| 13 | `GET` | `/performance/criteria` | signed in | The review criteria |
| 13 | `PUT` | `/performance/criteria` | ceo | Change them |
| 13 | `POST` | `/performance/criteria/approve` | ceo | Approve them |
| 13 | `POST` | `/reviews` | see §13 | Write a review (draft) |
| 13 | `PATCH` | `/reviews/:id` | its reviewer, ceo | Change a draft |
| 13 | `POST` | `/reviews/:id/finalize` | its reviewer, ceo | Make it final (the person is told) |
| 14 | `GET` | `/admin/users` | admin, ceo | Accounts with their sign-in state |
| 14 | `POST` | `/admin/users` | admin, ceo | Add an account (an optional `birth_date`, §20) |
| 14 | `PATCH` | `/admin/users/:id` | admin, ceo | Change, stop, restart, unlock; give or clear a custom role (`custom_role`, §17.1); set or clear `birth_date` (§20) |
| 14 | `GET` | `/teams` | signed in | Teams |
| 14 | `POST` | `/admin/teams` | admin, ceo | Add a team |
| 14 | `PATCH` | `/admin/teams/:id` | admin, ceo | Change a team |
| 14 | `GET` | `/admin/settings` | admin, ceo | Platform settings |
| 14 | `PUT` | `/admin/settings` | admin, ceo | Save them |
| 14 | `GET` | `/admin/health` | admin, ceo | Data checks |
| 14 | `GET` | `/audit` | admin, ceo | The audit log (filters: action, person, kind, IP, search, days), each line with IP and device |
| 14 | `GET` | `/audit/:id` | admin, ceo | One line with the same person's other lines that day and the subject's history (404 when none) |
| 15 | `GET` | `/projects/:projectId/github` | its pm, ceo | GitHub settings |
| 15 | `PUT` | `/projects/:projectId/github` | its pm, ceo | Save them |
| 15 | `GET` | `/{tasks\|bugs}/:id/github` | see §2 | Linked pull requests and commits |
| 16 | `GET` | `/monitoring/notes` | monitor, ceo | Her notes and everyone's requests (the CEO sees all) |
| 16 | `POST` | `/monitoring/notes` | monitor, ceo; every job but the ceo (requests only) | Write a report, feedback or a problem; a request to the CEO |
| 16 | `POST` | `/monitoring/notes/:id/send` | its writer, ceo | Send it to the CEO |
| 16 | `POST` | `/monitoring/notes/:id/share` | its writer, ceo | Send a report, feedback or problem to more people |
| 16 | `GET` | `/monitoring/received` | signed in | The notes sent to me |
| 16 | `POST` | `/monitoring/notes/:id/seen` | a person it was sent to | I opened it (the writer sees it) |
| 16 | `POST` | `/monitoring/requests/:id/forward` | monitor, ceo | Send a waiting request on to the CEO (optional note) |
| 16 | `POST` | `/monitoring/requests/:id/answer` | monitor, ceo | Answer a waiting request herself (it never reaches the CEO) |
| 16 | `GET` | `/monitoring/report-facts` | monitor, ceo | The report builder: counted numbers about a team, person or project over a period |
| 16 | `GET` | `/ceo/inbox` | ceo | What monitoring sent |
| 16 | `POST` | `/ceo/inbox/:id/answer` | ceo | Answer, mark seen or done, or reopen |
| 18 | `GET` | `/search?q=` | everyone | Quick search (Ctrl+K): projects, tasks, bugs, announcements, people |
| 17 | `GET` | `/ceo/advanced` | ceo | The advanced settings in force (defaults merged in) |
| 17 | `PUT` | `/ceo/advanced` | ceo | Save them (only what differs from the defaults; import, reset) |
| 17 | `GET` | `/ceo/advanced/history` | ceo | Every save, from → to, newest first |
| 17 | `GET` | `/site/live` | signed in | What this person must obey: features on/off, the banner for their job, read-only mode, the custom roles, their own job (`me`) |
| 17.1 | `PUT` | `/ceo/advanced` (`rules.roles`) | ceo | Make, change, copy or remove the CEO's custom roles (a role in use can't be removed: 409) |
| 21 | `GET` | `/teams/ratings/summary` | signed in | The teams this person may see, each with its members count, its ratings in numbers (or null) and `can_rate` |
| 21 | `GET` | `/teams/:id` | ceo, monitor, pm, admin; lead and employee: their own team | One team, its active members (the leader first), `can_see_ratings` and the members' task numbers (`tasks`, or null) |
| 21 | `GET` | `/teams/:id/ratings` | see §21 | The team's quick ratings this person may read, newest first, and `can_rate` |
| 21 | `POST` | `/teams/:id/ratings` | monitor, ceo; pm: teams in their projects | Rate a team (the leader is told `team_rated` unless private) |
| 21 | `GET` | `/people/ratings/summary` | signed in | The people whose ratings this person may read, each with the numbers and `can_rate` |
| 21 | `GET` | `/people/:id/ratings` | see §21 | A person's quick ratings this person may read, and `can_rate` |
| 21 | `POST` | `/people/:id/ratings` | monitor, ceo; pm: people in their projects (never yourself) | Rate a person (they are told `person_rated` unless private) |
| 21 | `PATCH` | `/ratings/:id` | its writer (24 h), ceo | Change a rating |
| 21 | `DELETE` | `/ratings/:id` | its writer (24 h), ceo | Remove a rating (always written in the audit log) |

### Who may do what (summary)

| | ceo | pm | monitor | lead | employee | admin |
|---|---|---|---|---|---|---|
| See projects | all | the ones they run or are in | all | the ones they're in | the ones they're in | all |
| Manage a project's tasks | ✓ | their projects | | projects they're in | | |
| Approve a completion | ✓ | their projects | | projects they're in | | |
| Comment, add files, report bugs | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Create projects and templates | ✓ | ✓ | | | | |
| Change a project's manager | ✓ | | | | | |
| Dashboard, reports, performance | ✓ | ✓ | ✓ | ✓ | their own page | |
| Review criteria | ✓ | | | | | |
| Post announcements | ✓ | | ✓ | | | ✓ |
| Accounts, teams, settings, audit log | ✓ | | | | | ✓ |
| Set or remove my own picture | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Remove someone else's picture | ✓ | | | | | ✓ |
| Monitoring notes | ✓ | | ✓ | | | |
| The CEO's inbox | ✓ | | | | | |
| Quick ratings: give (§21) | ✓ | teams and people in their projects | any team, anyone | | | |
| Quick ratings: read | ✓ | the ones they may give | ✓ | their team's, their own | their team's, their own | |

---

---

## 1. The basics (every call)

| Topic | What the site expects |
|---|---|
| Base URL | `{NEXT_PUBLIC_API_URL}/api/v1` + the paths below. JSON in, JSON out. |
| Success | `{ "success": true, "data": … }` (the site reads `data`). |
| Failure | `{ "success": false, "message": "نص للمستخدم", "code": "VALIDATION", "errors": { "field": "نص" } }` with the right HTTP status. `errors` keys are the form's field names (`title`, `blocked_reason`, `note`…): each shows under its field. |
| Codes | `VALIDATION` 422 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `BAD_STATE` 409 (not allowed in this state) · `RATE_LIMITED` 429 · `FEATURE_OFF` 403 (the CEO switched the feature off) · `READ_ONLY` 423 (read-only mode, section 17). |
| Language | Every request has `Accept-Language: ar` or `en`. `message` and `errors` come in that language (Arabic: Modern Standard Arabic). |
| Sign in | `POST /auth/login {identifier, password}` → `{ token, user }`. `identifier` is the email (a phone may come later). Every other call: `Authorization: Bearer <token>`. A `401` signs the person out. Wrong email and wrong password give **the same** message. Rate-limit it. |
| Dates | ISO 8601 with time zone; days are `YYYY-MM-DD`. The working day is Baghdad time (UTC+3). |
| Passwords | Hashed (argon2/bcrypt). Never sent back. |
| CORS | Allow the site's domains only. |
| Demo data | The demo accounts (`@demo.test`, password `123456`) exist only in the demo build. Never on the real database. |

## 2. Jobs and who sees what

`role`: `ceo`, `pm` (department manager), `monitor` (monitoring & evaluation), `lead` (team leader), `employee`, `admin`.

The server must filter, not only the pages:

- **The CEO rule** (the client, 21 November 2026): the `ceo` may see and do **everything any other job can**, including the system admin's work (accounts, teams, settings), and every rule added later must allow the `ceo` too. The only exception: other people's private one-to-one chats and group chats the `ceo` is not in. The `ceo` is a member of every project chat and team chat.

- **Projects:** `ceo`, `monitor` and `admin` see all. Everyone else sees the projects they are in (`pm_id` or `member_ids`).
- A project or a task you may not see answers **404, the same as one that doesn't exist** (nobody learns what exists).
- **Manage tasks** (create, edit any field, move any task): the project's PM, a `lead` who is a member, and the `ceo`.
- **Who a task can be given to** (`assignee_id`): anyone active, except the `admin`. Someone who is not in the project
  is added to its members by the server when the task is saved: a `member_added` line in the project's history and a
  `project_added` notification to them (the client, 21 November 2026). 422 on `assignee_id` for a stopped account or the admin.
- **Move a task:** the managers above, or the task's assignee if they are a member.
- **Approve completion:** the managers above, and the `ceo`. *(Not confirmed by the client yet: BRIEF question 5.)*
- **Comment:** everyone who can see the project, except `admin`.
- **Create a project:** `ceo`, `pm` and `monitor` (the client, 21 November 2026: the monitoring officer creates projects too). A `pm` always becomes the new project's manager (`pm_id` = themselves, whatever was sent); the `ceo` and the `monitor` must send `pm_id`, an active `pm` (422 on `pm_id` otherwise). The monitor sees every project already; she doesn't manage the one she creates (its `pm_id` does).
- **Change a project's setup** (details, members, statuses, phases, sprints): the project's PM and the `ceo`. **Change the PM:** `ceo` only. *(Assumptions, to confirm with the client.)*

## 3. Task statuses

- Each project has its own `statuses: [{key, name, name_en, tone}]`, in board order. New projects start with
  the seven defaults (`src/shared/lib/statuses.ts` `DEFAULT_STATUSES`): `new`, `todo`, `in_progress`, `in_review`, `testing`, `completed`, `blocked`.
- `tone` is the family: `new`, `todo`, `progress`, `review`, `testing`, `done`, `blocked`. The rules work by
  family, so a project's own status (for example «بانتظار موافقة الإدارة», tone `review`) follows them too.
- A task's `status` is one of its project's keys.
- The seven base statuses stay in every project (the brief), with their names and families. A project's own
  statuses can be added, renamed, moved and removed (see section 6).

## 4. The task rules (the brief)

**Moving** (`POST /tasks/:id/status {status, blocked_reason?}` → `{task, outcome}`):

1. Not allowed to move it → 403.
2. A status the project doesn't have → 422 on `status`.
3. The same status → `outcome: "moved"`, nothing changes.
4. A `blocked`-family status without `blocked_reason` (spaces don't count) → 422 on `blocked_reason`.
   With one: save it on the task (≤ 300 letters) and log `blocked` with the reason as `note`.
5. Leaving a blocked status clears `blocked_reason` and logs `unblocked`.
6. A `done`-family status by someone who **may not approve**: the status does **not** change. Save
   `approval = {state: "pending", from: <current status>, to: <the done status>, requested_by, requested_at}`,
   log `approval_requested`, and answer `outcome: "approval_requested"`.
7. A `done`-family status by someone who **may** approve: move it, save `approval.state = "approved"` with
   `decided_by`/`decided_at`, and log `approved`.
8. Moving a task with a pending request to any other non-done status cancels the request.

**Approving** (`POST /tasks/:id/approval {approve, note?}` → the task):

- Only someone who may approve (403 otherwise). No pending request → 409 `BAD_STATE`.
- `approve: true` → the task moves to `approval.to`, `state: "approved"`, log `approved`.
- `approve: false` needs `note` (422 on `note`). The task goes **back to `approval.from`** (the brief: back to
  review or testing), `state: "rejected"` with the note, log `rejected` with the note.

**Creating** (`POST /projects/:id/tasks`) and **editing** (`PATCH /tasks/:id`): managers only (403).

- `title`: required, trimmed, ≤ 160 letters (422 on `title`). `description` ≤ 5000.
- `assignee_id`: a member of the project (422 on `assignee_id`). On PATCH, `null` takes the task off the person.
- `due` not before `start` (422 on `due`). `sprint_id` of the same project (422 on `sprint_id`), and only when the project `uses_sprints`.
- A new task starts in the project's first status, or a given one that is **not** blocked or done (422 on `status`).
- `code` is made by the server (`TSK-…`), unique.
- Edits log one event per changed field: `title`, `description` (without the texts), `assignee` (ids),
  `priority`, `due` (old and new days, with `due_note` as `note`, the reason for the change). An unchanged field logs nothing.

**Comments** (`POST /tasks/:id/comments {body}`): trimmed, not empty, ≤ 2000 letters (422 on `body`); log `comment`.

**History** (`GET /tasks/:id/history`): every event `{id, task_id, actor_id, kind, from?, to?, note?, at}`.
**It can't be edited or deleted by anyone through the API**, and normal users can't hide it (the brief).
`kind`: `created`, `status`, `blocked`, `unblocked`, `approval_requested`, `approved`, `rejected`,
`assignee`, `due`, `priority`, `title`, `description`, `phase` (old and new phase ids), `sprint` (old and new sprint **names**; none = the backlog), `comment`, `attachment_added` (`to`: the file name),
`attachment_removed` (`from`: the file name), `dependency_added` (`to`: a task code), `dependency_removed` (`from`: a task code).

**Dependencies** (the brief: "a task waits for another one"). `Task.depends_on`: the ids of the tasks it waits for.

- Set with `PUT /tasks/:id/dependencies {depends_on: number[]}` (replaces the list): managers only (403). Every id
  is a task of **the same project**, not itself, at most **10**, and **no loop** (A waits for B that waits, through any
  chain, for A): 422 on `depends_on`. Log `dependency_added` (`to`: the code) / `dependency_removed` (`from`).
- **A task can't be done while any task it waits for isn't done** (status not in the `done` family): moving it to a
  done status, asking for that approval, or approving it → **409 `BAD_STATE`**, naming the codes.
- When a task is done, every task that waited for it **and now waits for nothing** tells its assignee:
  `dependency_done` (section 7). *(Assumption: a dependency doesn't stop starting a task, only finishing it.)*

**Phases on tasks:** `phase_id` (on create and PATCH) must be one of the project's phases (422 on `phase_id`).
On PATCH, `null` takes the task out of its phase.

Every change updates the task's `updated_at`.

## 5. Endpoints

| Method and path | Who | Answer |
|---|---|---|
| `POST /auth/login` | anyone | `Session` |
| `GET /me` | signed in | `User` |
| `GET /users` | signed in | `User[]` |
| `PUT /me/avatar`, `DELETE /me/avatar`, `DELETE /users/:id/avatar` | yourself; removing someone's: `admin`, `ceo` | `User` (section 19) |
| `GET /projects` | signed in (filtered) | `ProjectSummary[]`, with `tasks_total`, `tasks_done`, `tasks_late`, `tasks_blocked` |
| `GET /projects/:id` | can see it | `Project` |
| `GET /projects/:id/tasks` | can see it | `Task[]` |
| `GET /projects/:id/sprints` | can see it | `Sprint[]`, with `planned_ratio` for today |
| `POST /projects/:id/tasks` | managers | `Task` |
| `GET /tasks/:id` | can see its project | `Task` |
| `PATCH /tasks/:id` | managers | `Task` |
| `POST /tasks/:id/status` | managers, assignee | `{task, outcome}` |
| `POST /tasks/:id/approval` | managers, CEO | `Task` |
| `PUT /tasks/:id/dependencies` `{depends_on}` | managers | `Task` (section 4) |
| `GET /tasks/:id/comments` | can see its project | `TaskComment[]` |
| `POST /tasks/:id/comments` | see section 2 | `TaskComment` |
| `GET /tasks/:id/history` | can see its project | `TaskEvent[]` |
| `POST /projects` | `ceo`, `pm` | `Project` |
| `PATCH /projects/:id` | its PM, `ceo` | `Project` |
| `PUT /projects/:id/statuses` | its PM, `ceo` | `Project` |
| `PUT /projects/:id/phases` | its PM, `ceo` | `Project` |
| `POST /projects/:id/sprints` | its PM, `ceo` | `Sprint` |
| `PATCH /sprints/:id` | its project's PM, `ceo` | `Sprint` |
| `DELETE /sprints/:id` | its project's PM, `ceo` | nothing |
| `POST /sprints/:id/close` `{move_to}` | its project's PM, `ceo` | `Sprint` (section 6) |
| `GET /templates` | `ceo`, `pm` | `ProjectTemplate[]` |
| `GET /performance` `?from&to` | `ceo`, `pm`, `monitor`, `lead` | `{people, teams}` (section 13) |
| `GET /performance/people/:id` `?from&to` | see section 13 | `PersonDetail` |
| `GET /performance/criteria`, `PUT …`, `POST …/approve` | read: signed in; change: `ceo` | `Criteria` |
| `POST /reviews`, `PATCH /reviews/:id`, `POST /reviews/:id/finalize` | the direct manager (section 13) | `Review` |
| `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id` | `admin` | `AdminUser[]` / `User` (section 14) |
| `GET /teams`, `POST /admin/teams`, `PATCH /admin/teams/:id` | read: signed in; change: `admin` | `Team` |
| `GET /admin/settings`, `PUT /admin/settings`, `GET /admin/health` | `admin` | `Settings` / `DataHealth` |
| `GET /audit` `?action&actor_id&from&to` | `ceo`, `admin` | `AuditEntry[]` |
| `GET /projects/:id/github`, `PUT /projects/:id/github` | read: can see it; change: its PM, `ceo` | `GithubSettings` (section 15) |
| `GET /tasks/:id/github`, `GET /bugs/:id/github` | can see its project | `GithubLinks` |
| `GET /reports/overview` | `ceo`, `pm`, `monitor`, `lead` | `Overview` (section 12) |
| `POST /projects/:id/template` `{name, description?}` | its PM, `ceo` | `ProjectTemplate` |
| `DELETE /templates/:id` | its maker, `ceo` | nothing |
| `GET /projects/:id/history` | can see it | `ProjectEvent[]` |
| `GET /me/tasks` | signed in | `Task[]`: the tasks assigned to me, in projects I can see |
| `GET /notifications` | signed in | `Notification[]`, mine only, newest first (the latest 100) |
| `POST /notifications/:id/read` | its owner | nothing (someone else's → 404) |
| `POST /notifications/read-all` | signed in | nothing |
| `GET /notifications/preferences` | signed in | `{ [kind]: boolean }` |
| `PUT /notifications/preferences` | signed in | the saved preferences |
| `GET /tasks/:id/attachments`, `GET /projects/:id/attachments` | can see the project | `Attachment[]` |
| `POST /tasks/:id/attachments`, `POST /projects/:id/attachments` | takes part in the project (see section 8) | `Attachment` |
| `DELETE /attachments/:id` | the uploader, the project's PM, `ceo` | nothing |
| `GET /announcements` | signed in | `Announcement[]`, important first, then newest |
| `GET /announcements/:id` | signed in | `Announcement` |
| `POST /announcements` | `ceo`, `admin` | `Announcement` |
| `DELETE /announcements/:id` | its author, `ceo`, `admin` | nothing |
| `POST /announcements/:id/seen` | signed in | nothing |
| `GET /announcements/:id/reads` | its author, `ceo`, `admin` | `{ seen: [{user_id, at}], not_seen: number[] }` |
| `GET /bugs` | signed in (filtered by project) | `Bug[]` |
| `GET /bugs/:id` | can see its project | `Bug` |
| `POST /projects/:id/bugs` | takes part in the project | `Bug` |
| `PATCH /bugs/:id` | the project's PM and team leaders | `Bug` |
| `POST /bugs/:id/status` | see section 10 | `Bug` |
| `GET /bugs/:id/history` | can see its project | `BugEvent[]` |
| `GET /bugs/:id/attachments`, `POST /bugs/:id/attachments` | as for tasks (section 8) | |
| `GET /chats` | signed in | `Conversation[]`, my chats only, the newest message first |
| `GET /chats/:key/messages` | the chat's members | `Message[]`, oldest first |
| `POST /chats/:key/messages` | the chat's members | `Message` (section 11) |
| `POST /chats/:key/read` | the chat's members | nothing |
| `POST /chats/direct` `{user_id}` | signed in | `Conversation`: the existing private chat with that person, or a new one |
| `GET /messages/:id/attachments`, `POST /messages/:id/attachments` | members see; only its writer adds (section 11) | |

**Counts:** a task is *late* when it has a `due` day before today and is not in a `done` status
(`src/features/projects/counts.ts` `lateDays`). `planned_ratio` = days gone / sprint length, between 0 and 1 (`plannedRatio`).

## 6. Project setup

`Project` now also has `phases: [{id, name}]`, in order (`[]` = the project doesn't use phases; the brief says
they are optional). Shapes: `src/features/projects/types.ts`. Rules: `src/features/projects/rules.ts`.
The demo backend (`src/features/projects/mock.ts`) is the exact reference.

**Creating** (`POST /projects {name, name_en?, description, pm_id, member_ids, start, end, priority, uses_sprints}`):

- `name` required, trimmed, ≤ 120 (422 on `name`). `description` ≤ 5000. `start` and `end` required days, `end` not
  before `start` (422 on `end`).
- `pm_id`: an active user with role `pm` (422 on `pm_id`). `member_ids`: active users, never an `admin`
  (422 on `member_ids`). The PM is always added to `member_ids`.
- The server makes `code` (`PRJ-…`), starts the project with the seven base statuses and `phases: []`, and sets
  `state` to `planned` (start in the future) or `active`. Log `created`.

**Changing** (`PATCH /projects/:id`, any of the fields above plus `state` and `note`):

- Same checks as creating. `note` (≤ 300) is the reason; it goes into the history events below.
- `pm_id` changed by someone who isn't the `ceo` → 403. The old PM **stays a member** (their tasks keep working).
- **Members:** removing someone who still has open (not done) tasks in the project → **409 `BAD_STATE`**, with their
  name in the message: the tasks must go to another member first. The PM can't be removed while they are the PM.
- **History events** (the brief's edge cases: a changed team or PM, a plan changed after work started):
  `member_added` (`to`: user id), `member_removed` (`from`), `pm` (`from`/`to`), `dates`
  (`from`/`to` as `"start → end"`, with the `note`), `state` (`from`/`to`), `details` (`to`: the changed
  field names, comma-separated).

**Statuses** (`PUT /projects/:id/statuses {statuses: [{key?, name, name_en, tone}]}`, the whole list in board order):

- Every base status the project has must still be there, with the same `tone` (422 on `statuses`). Base names
  can't change.
- A new status has no `key`: the server makes one that never changes (the site never sends its own).
- Names: not empty, ≤ 40, unique in the project. `name_en` empty → the Arabic name. At most 15 statuses.
  The first status can't be in the `blocked` or `done` family (new tasks start there). All: 422 on `statuses`.
- Removing a status that tasks are in → **409**, with the count. Log `statuses` (`from`/`to`: the names).

**Phases** (`PUT /projects/:id/phases {phases: [{id?, name}]}`, the whole list in order):

- A new phase has no `id`. Names not empty, ≤ 80, unique; at most 20 (422 on `phases`).
- Removing a phase that tasks are in → **409**, with the count. Log `phases`.

**Sprints** (`POST /projects/:id/sprints`, `PATCH /sprints/:id`, both `{name, start, end}`; `DELETE /sprints/:id`):

- Only for a project with `uses_sprints` (409 otherwise). `name` ≤ 60 (422 on `name`); days required, `end` not
  before `start` (422 on `end`).
- Sprints of one project **can't overlap** (422 on `start`, naming the other sprint).
- Deleting a sprint that has tasks → **409**. Log `sprint_added` / `sprint_changed` / `sprint_removed`.
- An **ended** sprint (`closed_at` set) can't be changed or deleted (409) and takes no tasks (422 on `sprint_id`); a
  task in it stays there (moving it out → 422 on `sprint_id`).

**The board** (the brief: "each project picks the board that fits it"): a project with `uses_sprints` gets the **Scrum
board** (one sprint's planned, done and left tasks; the backlog = its tasks with no sprint; all its tasks), the others
the Kanban board. *(Assumption: the sprint switch is the board choice; no separate setting.)*

`Sprint`: `{id, project_id, name, start, end, planned_ratio, closed_at?, result?}`, `result` =
`{planned, done, moved, moved_to?}`, kept when it ends.

**Ending a sprint** (`POST /sprints/:id/close {move_to}`; the brief: unfinished tasks at the end of a sprint need handling):

- Who: the project's PM and the `ceo` (403). Already ended → 409. Not started yet (`start` after today) → 409. It may
  end early or after its `end` day: the team decides. *(Assumption.)*
- `move_to`: another **open** sprint of the same project, or `null` for the backlog (422 on `move_to` otherwise).
- Tasks in the sprint whose status is in the `done` family **stay**; every other task moves to `move_to` (or loses its
  `sprint_id`), each with a task history line `sprint` (`from`, `to` = the sprints' **names**; no `to` = backlog).
- Set `closed_at` and `result` (`planned` = tasks in it when it ended, `done`, `moved`, `moved_to`). Log
  `sprint_closed` (`from` = its name, `to` = where the tasks went, `note` = `"done/planned"`). Answer: the `Sprint`.

**Backlog → sprint:** `PATCH /tasks/:id {sprint_id}` (managers); `sprint_id: null` takes it out (back to the backlog).
Every change logs a task history line `sprint` as above.

**Templates** (the brief: "templates for recurring projects, so they can be created easily"):

- `ProjectTemplate`: `{id, name, description, statuses, phases: string[], uses_sprints, tasks: [{title, description,
  priority, phase?}], from_project?, created_by, created_at}`. **No people, dates, comments or files** are kept.
- `GET /templates`: `ceo` and `pm` (the people who create projects; 403 for others).
- `POST /projects/:id/template {name, description?}`: the project's managers who may create projects. `name` required,
  ≤ 80, unique (422 on `name`); at most 200 tasks. Copies the statuses, phase names, `uses_sprints` and every task.
- `DELETE /templates/:id`: its maker or the `ceo` (403). Projects made from it don't change.
- `POST /projects` with `template_id`: the new project gets the template's statuses and phases (new ids) and one task
  per template task: in the **first status**, **no assignee, no dates, no sprint** (in the backlog), with its phase;
  each logs `created`. Unknown `template_id` → 422. The project history line `created` has the template's name as `note`.
  *(Assumption: dependencies between tasks are not kept in templates yet.)*

**History** (`GET /projects/:id/history`): `[{id, project_id, actor_id, kind, from?, to?, note?, at}]`. Like the
task history, nobody can edit or hide it through the API.

## 7. Notifications

Shapes: `src/features/notifications/types.ts`; the kinds and which are required: `src/shared/api/notification-kinds.ts`.
The demo server makes them in `src/mock/notify.ts`: that file is the exact reference for **who gets what**.

`Notification`: `{id, user_id, kind, actor_id?, project_id?, task_id?, announcement_id?, bug_id?, chat_key?, data, at, read}`. `data` is a **copy taken when it was
made** (`task_code`, `task_title`, `project_name`, `project_name_en`, `status`, `status_en`, `due`, `decision`, `note`, `pm_id`),
so the text stays right after the task changes. The site writes the sentence from `kind` + `data` in the reader's language.

**General rules:** nobody is told about their own action (`actor_id` never gets it); one notification per person per event;
a kind the person turned off isn't sent (unless it is required). Each person reads only their own.

| `kind` | When | Who gets it |
|---|---|---|
| `task_assigned` | a task is created with an assignee, or its assignee changes | the new assignee |
| `task_status` | a task moves (data: `status`, `status_en`, and the blocked reason as `note`) | the assignee and the project's PM |
| `task_comment` | a comment is added | the assignee, the PM, and everyone who commented on that task before |
| `task_due_changed` | the due day changes (data: `due`, the reason as `note`) | the assignee |
| `task_due_soon` | the due day is tomorrow or today, and the task isn't done | the assignee, **once per task and due day** |
| `task_overdue` | the due day has passed, and the task isn't done | the assignee, once per task and due day |
| `approval_requested` | someone asks to mark a task done | the project's PM and its team leaders (`lead` members). *Assumption: not the CEO.* |
| `approval_decided` | the request is approved (also by moving the task to done) or sent back (data: `decision`, `note`) | the person who asked |
| `project_added` | a project is created with you in it, or you are added | the new member |
| `project_pm` | the PM changes (data: `pm_id`, `note`) | every member, the new PM included |
| `project_plan` | the project's dates change (data: `due` = the new end, `note`) | every member |
| `announcement` | a new announcement is posted (`announcement_id`; data: `title`) | every active person except the author |
| `bug_reported` | a bug is reported (`bug_id`; data: `bug_code`, `bug_title`) | the project's PM and team leaders |
| `bug_assigned` | a bug is given to a developer | the developer |
| `bug_status` | a bug moves (data: `bug_status`, the send-back reason as `note`) | its reporter, its developer, the project's PM |
| `bug_late` | the expected fix day has passed and the bug isn't closed (a daily reminder, like `task_overdue`) | the developer and the PM, once per bug and day |
| `github_pr_merged` | a pull request that mentions your task is merged (data: `note` = "repo #n") | the task's assignee |
| `team_joined` | you are put in a team or made its leader (data: `note` = the team's name) | that person |
| `account_locked` | an account locks after wrong passwords (data: `note` = the person's name) | every active admin |
| `review_final` | a performance review of you is made final (data: `note` = the period) | the reviewed person |
| `dependency_done` | the last unfinished task another task waited for is done (`task_id` = the waiting task; data: `note` = the finished task's code) | the waiting task's assignee |
| `chat_mention` | someone writes @ and your name in a chat (`chat_key`; data: `note` = the message's start) | the mentioned members (section 11) |
| `birthday_soon` | a colleague's birthday is exactly 7 days away (data: `person_id`, `person_name`, `person_name_en`, `due`) | every active `monitor` and the `ceo`, once per person and year (section 20) |
| `birthday_today` | a colleague's birthday is today (the same data) | the same, once per person and year (section 20) |
| `team_rated` | a team gets a quick rating that isn't private, or one is made visible (`team_id`; data: `team_name`, `team_name_en`, `score`, `note` = the reason's start) | the team's leader (section 21) |
| `person_rated` | a person gets a quick rating that isn't private, or one is made visible (data: `score`, `note` = the reason's start) | that person (section 21) |

**Reminders** (`task_due_soon`, `task_overdue`, and the birthdays of section 20) come from the calendar, not from an action: the real server should make
them **once a day** (a scheduled job). The demo makes them when someone opens their notifications.

**Preferences** (`PUT /notifications/preferences`, `{ [kind]: boolean }`; a missing kind means on): **required kinds can't be
turned off** (`false` → 422 on `prefs`), and unknown kinds → 422. *Assumption, to confirm with the client:* the required ones
are `task_assigned`, `task_overdue`, `approval_requested`, `approval_decided`, `project_added`, `announcement` (the brief says
employees receive a notification for each new announcement), `bug_assigned`.

Live updates: the bell should update without a reload. Today the site refreshes when this browser saves something; with the
real server, a WebSocket message `notification` (planned, as in Project 2) will tell the site to load the list again.

## 8. File attachments

Shapes: `src/features/attachments/types.ts`. Rules (types and sizes): `src/features/attachments/rules.ts`. The demo backend
(`src/features/attachments/mock.ts`) is the reference. Files belong to a **task**, a **project**, a **bug** (section 10) or a
chat **message** (section 11, its own rules for who may add and remove).

`Attachment`: `{id, owner_type: "task" | "project" | "bug" | "message", owner_id, name, size, mime, url, uploaded_by, at}`. `url` is where the site
downloads it from (a short-lived signed link is fine). The site shows a preview for `image/png|jpeg|gif|webp` only.

**Uploading** (`POST /tasks/:id/attachments` or `POST /projects/:id/attachments`, `multipart/form-data` with one field `file`):

- Who: everyone who **takes part** in the project: its members, `ceo`, `monitor`; **not** `admin` (403). A task's project
  is the one checked. A project or task you can't see → 404.
- **Types** (by extension, and the server must also check the real content): `png jpg jpeg gif webp pdf doc docx xls xlsx ppt
  pptx txt csv zip`. **Never SVG or HTML** (they can run code in a browser). Other types → 422 on `file`.
- **Size:** up to **10 MB** per file; an empty file → 422 on `file`. At most **30 files** per task or project (422).
  *(Assumptions, BRIEF question 13: the client hasn't said sizes, types or where files are stored.)*
- Keep the original `name` (≤ 200 letters) for showing it; store the file under a server-made name. Serve downloads with
  `Content-Disposition: attachment` so the browser downloads instead of opening them.
- Log `attachment_added` in the task's or project's history (`to`: the name).

**Removing** (`DELETE /attachments/:id`): the person who uploaded it, the project's PM, or the `ceo` (403 otherwise). Log
`attachment_removed` (`from`: the name). The history keeps the name even after the file is gone.

## 9. Announcements

Shapes: `src/features/announcements/types.ts`. Rules: `src/features/announcements/rules.ts`. The demo backend
(`src/features/announcements/mock.ts`) is the reference.

`Announcement`: `{id, title, body, important, author_id, created_at, seen, seen_count, audience_count}`. `seen` is for the
person asking; `seen_count` / `audience_count` count active people only.

- **Who posts** (`POST /announcements {title, body, important}`): `ceo`, `admin` and `monitor` (403 for others). The monitoring officer posts too (the client, 21 November 2026).
  `title` required, trimmed, ≤ 160 (422 on `title`); `body` ≤ 5000. *(Assumption, to confirm with the client.)*
- **Audience:** every active person in the company. The author counts as having seen it. Everyone else gets the
  `announcement` notification (section 7), which can't be turned off.
- **Seen:** `POST /announcements/:id/seen` when someone opens it. Only the first time counts (keep its time).
- **Who has seen it** (`GET /announcements/:id/reads`): the author, `ceo`, `admin` (403 for others). `seen` in the order
  people opened it, `not_seen` = active people who haven't.
- **Order:** important ones first, then newest first.
- **No editing** (*assumption*): what people saw stays what it was. To fix a mistake: `DELETE /announcements/:id` (author,
  `ceo`, `admin`) and post again. The audit log (a later part) must record the removal.

## 10. Bug tracker

Shapes: `src/features/bugs/types.ts`. Rules (who may do what, which status follows which): `src/features/bugs/rules.ts`.
The demo backend (`src/features/bugs/mock.ts`) is the reference.

`Bug`: `{id, code, project_id, phase_id?, task_id?, title, description, severity, priority, status, reported_by, assignee_id?,
due?, created_at, updated_at, closed_at?}`. `code` is made by the server (`BUG-…`). `severity`: `critical`, `high`, `medium`,
`low` (how bad); `priority`: `high`, `medium`, `low` (how soon). `due` is the expected fix day.

**Reporting** (`POST /projects/:id/bugs {title, description, severity, priority, phase_id?, task_id?, assignee_id?, due?}`):
everyone who takes part in the project (403 for `admin`). `title` required ≤ 160; `severity` required; the phase and the task
must be of this project, the developer a member (422 on the field). `assignee_id` and `due` are kept **only when a manager
reports** (the PM or a team leader in the project, or the `monitor`); from anyone else they are ignored. Starts `assigned` when it has a
developer, else `reported`. Notify `bug_reported` and, with a developer, `bug_assigned`.

**Changing** (`PATCH /bugs/:id`): the project's PM and team leaders, and the `monitor` on every project (her «إجراءات سريعة» / Quick actions page, the client 22 November 2026: every open bug on one line, assign, severity, priority, day and the next move, all with these same calls). "Managers" below includes her. Log `severity`, `priority`, `due`, `assignee`, and
`edited` for the title or description. Giving a `reported` bug a developer also moves it to `assigned` (logged).

**The flow** (`POST /bugs/:id/status {status, note?}`), from the brief:

| From | To | Who |
|---|---|---|
| `reported` | `assigned` (needs a developer, 422 on `assignee_id`) | managers |
| `assigned` | `fixing` | the developer, managers |
| `fixing` | `testing` | the developer, managers |
| `testing` | `closed`, or `reopened` | the reporter, managers |
| `reopened` | `fixing` | the developer, managers |
| `closed` | `reopened` | the reporter, managers |

Any other move → 422 on `status`; a move this person may not make → 403. `reopened` **needs `note`** (why it isn't fixed,
≤ 300; 422 on `note`). `closed` sets `closed_at`; leaving `closed` clears it. Log `status` (`from`, `to`, `note`); notify
`bug_status`. *(Who may do what is an assumption, to confirm with the client.)*

**Late:** `due` before today and not `closed`. The site counts and filters these; the server sends `bug_late` once a day.

**Reports** (the brief: open, closed, late; by project and team): the site builds them from `GET /bugs`. **By team** waits for
the client's answer on what a team is (BRIEF question 6); today the site shows **by project** and **by developer**.

## 11. Chat

Shapes: `src/features/chat/types.ts`. Rules (keys, limits, mentions): `src/features/chat/rules.ts`. The demo backend
(`src/features/chat/mock.ts`, and who belongs to which chat in `src/mock/chat.ts`) is the reference.

**The chats** (the brief: project, team and private chats; the client added group chats). A chat's key is safe in a web
address: `p-3` (project 3), `t-1` (team 1), `d-7` (private chat 7), `g-2` (group 2).

| Kind | Members | Exists |
|---|---|---|
| project | the project's PM and members, **read each time** (someone removed from the project stops seeing its chat), plus every active `ceo` and `monitor` | always, one per project |
| team | the active people with that `team_id`, plus every active `ceo` and `monitor` | always, one per team |
| private | the two people | made by `POST /chats/direct` the first time; **one per pair** |
| group | the people picked by its maker (stored: `groups: {id, name, created_by, member_ids, created_at}`) | made by `POST /chats/groups` |

The monitoring and evaluation officer (`monitor`) is in every project and team chat, like the `ceo`, so she can follow all
the work's conversations (the client). Private chats and groups stay closed to anyone who isn't in them.

`Team`: `{id, name, name_en?, lead_id?}` (`src/shared/api/types.ts`). *Assumption, BRIEF question 6 is open:* a team is
fixed, not made per project. `GET /teams` will come with the admin part.

**Who:** only a chat's members read it, write in it, see its files and are counted in it. **Not a member, or no such chat
→ 404** (the same answer, so nobody learns which chats exist). No role sees other people's chats, not the CEO either
(*assumption*: the audit log of a later part decides if the admin may).

`Conversation`: `{key, kind, title, title_en?, member_ids, created_by?, last_message?, unread}`. `kind` is `project`,
`team`, `direct` or `group`. `title` is the project's, team's or group's name (empty for a private chat: the site names it
after the other person). `created_by` (groups only) is the person who manages the group. `unread` = messages from others
after the last one this person read.

`Message`: `{id, chat, author_id, body, reply_to?, mentions, created_at, files}`. `files` are its attachments (section 8,
owner type `message`).

**Sending** (`POST /chats/:key/messages {body, reply_to?, mentions?}`):

- `body` trimmed, ≤ **4000** (422 on `body`). An empty `body` is allowed only because the site uploads the files right
  after (`POST /messages/:id/attachments`); the real server may prefer one `multipart` call with the files.
- `reply_to` must be a message **of the same chat** (422 on `reply_to`).
- `mentions`: user ids. The server keeps only **members of the chat**, never the writer (nobody outside learns what was
  said). Each one gets `chat_mention` (section 7) with `chat_key` and `data.note` = the first 120 letters.
- The writer has read their own message (move their read mark).

**Read marks** (`POST /chats/:key/read`): saves the newest message's id for this person. Send it when a chat is opened and
when a new message arrives in the open chat. Keep one mark per person per chat (`chat_reads: {chat, user_id, last_id}`).

**Files in a chat:** `POST /messages/:id/attachments` only by **the message's writer**; members see them; only the writer
removes them (no PM override). The same types and sizes as section 8; **no history entry** (a chat isn't a task).

**Group chats** (the client asked that the monitoring officer can "use chat and make group chats"):

| Call | Body | Answer | Who |
|---|---|---|---|
| `POST /chats/groups` | `{name, member_ids}` | the new `Conversation` | `monitor`, `pm`, `lead` and the `ceo` (`canCreateGroupChat`); others → **403** |
| `PATCH /chats/:key` | `{name?, member_ids?}` | the changed `Conversation` | a member who manages the group (`created_by`), or the `ceo` if she is a member (`canManageGroupChat`); other members → **403** |
| `POST /chats/:key/leave` | none | nothing | any member |

- `name`: trimmed, required, ≤ **60** letters (422 on `name`).
- `member_ids`: the other people. The maker (on create) or the manager (on change) is **always added**, whatever was
  sent; repeats are dropped. Each must be an **active** person who is **not the system admin**, and there must be **at
  least 2** besides the maker/manager (422 on `member_ids`). On `PATCH`, `member_ids` is the **whole new list**: people
  left out are removed and stop seeing the group at once.
- Not a member, no such group, or a key that isn't a group (`p-1` on `PATCH` or `/leave`) → **404**, like the other chats.
  The `ceo` does not see groups she is not in (*assumption*, like private chats).
- **Leaving:** the person is taken out and their read mark removed. If the manager leaves, the next member in the list
  manages the group, so it never has nobody to change it. A group whose last member left is not shown to anyone.
- Messages, mentions, read marks and files work in a group exactly as in the other chats.
- *Not built yet:* a notification when someone is added to a group (no notification kind for it yet), deleting a group,
  and a group picture.

**Live:** the site reloads the open chat when data changes in this browser. With the real server, a WebSocket message
`chat_message {chat}` (planned, like `notification`) will tell the site to load that chat and the list again.

**Not built yet** (*the brief doesn't ask*): editing and deleting messages, reactions, typing dots, search in chats.

## 12. Dashboard and reports

Shapes: `src/features/reports/types.ts`. **The counting is `src/features/reports/compute.ts`** (pure functions, tested):
the server must give the same numbers. The demo backend is `src/features/reports/mock.ts`.

`GET /reports/overview` → `Overview`: `{today, projects: ProjectRow[], people: PersonRow[], teams: TeamRow[],
sprints: SprintRow[], bugs: {open, late, closed, critical_open}}`.

- **Who:** `ceo`, `pm`, `monitor`, `lead` (403 for `employee` and `admin`). **Everything is counted over the projects
  this person may see** (section 2): a PM or team leader sees their projects' numbers, the CEO and M&E all.
- `ProjectRow`: the project's fields + `total, done, late, blocked, ratio` (done / total), `planned_ratio` (days gone /
  project length, 0–1), `overdue` (not done and past `end`), `behind` (active and `ratio + 0.15 < planned_ratio`).
  *(Assumption: "late project" = overdue or more than 15 points behind the plan; to confirm with the client.)*
- `PersonRow`: per assignee in those projects: `open, done, late, blocked, in_review`, `team_id`.
- `TeamRow`: per team with tasks: `members` (active people with the `team_id`), `open, done, late, ratio`.
- `SprintRow`: per sprint of those projects: `planned, done, left` (an ended sprint: its kept `result`), `closed`.
  **Velocity** = the average `done` of the last 3 ended sprints (the site works it out).
- `bugs`: open (not `closed`), late (past `due`, not closed), closed, critical and open.

The dashboard also shows the 3 latest announcements (`GET /announcements`). The reports page downloads each table as
CSV in the browser (no server call). Cells that start with `= + - @` are written as text (no spreadsheet formulas).

## 13. Performance

Shapes: `src/features/performance/types.ts`. **Counting and scoring: `src/features/performance/metrics.ts`**; who may do
what: `src/features/performance/rules.ts` (both pure and tested). The demo backend is `src/features/performance/mock.ts`.

**Counted for a person over a period** `{from, to}` (query `?from=YYYY-MM-DD&to=YYYY-MM-DD`; 422 on `period` if wrong),
over the projects **the asking person** may see:

- `assigned`: their tasks open at some point in the period (`created_at` ≤ `to`, and not finished before `from`).
- `done`: finished inside the period. *Finished* = the approval's `decided_at`, else the task's last change.
- `late`: finished after its `due`, or still open with `due` before the period's end (or today).
- `completion` = done / assigned; `on_time` = finished on or before `due` / finished with a `due` (null if none);
  `blocked` = blocked now, with the reasons on the person's page.
- **Teams:** the members' numbers added up, `left` = assigned − done, `planned` = the average time-gone of the team's
  projects at the period's end (plan vs actual).

**Criteria** (`GET /performance/criteria`; `PUT /performance/criteria {items}`; `POST /performance/criteria/approve`):
`{items: [{id, name, name_en, kind: "auto"|"manual", metric?: "completion"|"on_time"|"not_late", weight}], approved_by?,
approved_at?, updated_at}`. Only the `ceo` changes or approves (403). Weights are whole numbers adding up to **100**;
every name in both languages; an `auto` one needs its `metric`; **at least one `manual` criterion** (the brief: not on
the number of tasks alone): 422 on `items`. **Any change clears the approval.** *(Assumption: the CEO is "the management".)*

**Scores:** `completion` → completion × 100; `on_time` → on_time × 100 (completion when null); `not_late` →
(1 − late / assigned) × 100. A `manual` criterion: the reviewer's 1–5 stars × 20. **Total** = Σ score × weight / 100, rounded.

**Reviews** (`POST /reviews`, `PATCH /reviews/:id` with `{user_id, period, stars: {criterionId: 1..5}, note}`;
`POST /reviews/:id/finalize`):

- **Who reviews whom** *(assumption)*: the `ceo` anyone; a `pm` the members of their projects; a `lead` the employees
  of their team; never themselves, the CEO or the admin (403). Only a finished period (`to` ≤ today, 422 on `period`).
- The server counts the numbers itself, stores them (`perf`), the criteria as they are (`criteria`), `scores` and
  `total`. Starts as `draft`; only its reviewer changes it (404 for others).
- **Final:** only its reviewer; the criteria must be **approved** (409) and every manual criterion scored (422 on
  `stars`). A final review never changes (409). Notify `review_final` to the person.
- **Who sees:** a draft its reviewer and the `ceo`; a final one also the person, `monitor`, and whoever may review them.

`GET /performance?from&to` → `{people: PersonPerf[], teams: TeamPerf[]}`: `ceo`, `pm`, `monitor`, `lead` (403 others);
people = everyone they may open (the CEO and M&E: everyone but the CEO and admin; a PM: their projects' people; a lead:
their team). `GET /performance/people/:id?from&to` → `{perf, blocked, reviews, can_review}`: themselves, the CEO, M&E,
or who may review them (404 otherwise).

## 14. Administration and the audit log

Shapes: `src/features/admin/types.ts`; rules: `src/features/admin/rules.ts`; the demo backend: `src/features/admin/mock.ts`,
the sign-in lock in `src/features/auth/mock.ts`, the audit helper in `src/mock/audit.ts`.

**Users** (`GET /admin/users` → `AdminUser[]` with `failed_logins`, `locked_until?`, `last_login_at?`;
`POST /admin/users`; `PATCH /admin/users/:id`): the `admin` only (403).

- `name` required ≤ 120; `email` valid, stored lower case, **unique** (422 on `email`); `role` one of the six; `title` ≤ 80;
  `team_id` an existing team or null (422); `birth_date` optional, a real past day, age 16–80 (422; section 20).
- **No account is deleted:** `active: false` stops it (it can't sign in: 403), `true` restarts it. The history stays.
- **Guards (409):** an admin can't change their own role or stop themselves; at least one active admin always stays; a
  `pm` who manages projects that aren't `done` can't lose the role or be stopped (the message names the projects:
  change their PM first).
- `unlock: true` ends a sign-in lock. A changed team notifies the person `team_joined`.

**Sign-in lock** (the brief: "a user who can't sign in for a while"): every wrong password logs `login_failed` (no
password is ever stored). After `lock_after` wrong passwords in a row the account locks for `lock_minutes`: log
`login_locked`, notify every active admin `account_locked`. While locked, sign-in answers **429 `RATE_LIMITED`** (even
with the right password). A good sign-in resets the count and sets `last_login_at`.

**Teams** (`GET /teams`; `POST /admin/teams`, `PATCH /admin/teams/:id` `{name, name_en?, lead_id?}`): admin only. Name
required ≤ 80 and unique; `lead_id` an active user with role `lead` (422). The leader joins the team (`team_id`) and is
told `team_joined`. Members are set on each user. *(Assumption: a team is fixed, BRIEF question 6.)*

**Settings** (`GET/PUT /admin/settings`): `{due_soon_days 1–7, lock_after 3–10, lock_minutes 5–120}` (422 on the field).
`due_soon_days` decides when `task_due_soon` starts. **Data health** (`GET /admin/health`): counts of users (active,
stopped, locked), projects, tasks, files and their size, audit lines. Backups: DevOps (BRIEF question 14).

**Audit log** (`GET /audit?action&actor_id&kind&ip&q&from&to`, newest first): `ceo` and `admin` (403 others). Each line
`{id, actor_id?, action, target: {type, id?, label}, changes?: [{field, from?, to?}], at, ip?, user_agent?, session_id?, request_id?}`
(`AuditEntry` in `src/features/admin/types.ts`). **There is no call that changes or removes a line** (the brief: normal
users can't hide it); keep it in its own table, append only: the database user the API runs as may `INSERT` and `SELECT`
on it, never `UPDATE` or `DELETE`, and the new columns are written once with the line, never filled in later.

- **Filters:** `kind` is the part of the platform (`account`, `team`, `settings`, `signin`, `project`, `announcement`,
  `review`: `ACTION_KIND` in `src/features/admin/audit-words.ts`). `ip` is exact (`192.0.2.14`), or a prefix when it ends
  with `.`, `:` or `*` (`192.0.2.`); without such an ending it matches whole parts only (`192.0.2` matches `192.0.2.14`,
  `192.0.2.1` does not): `ipMatches` in `src/features/admin/audit-detail.ts`. `q` searches the person's name (both
  languages) and email, the action in words, the subject's label, what changed (field, old, new) and the IP, ignoring
  case and Arabic letter forms.
- **Where it came from (written by the server on every line, from the request itself, never from the body):**
  - `ip`: the real client address. Behind Cloudflare that is the **`CF-Connecting-IP`** header; trust it (and
    `X-Forwarded-For`) **only when the request comes from Cloudflare's or our own proxy's addresses**, else use the
    socket's address (anyone can send those headers). IPv6 as written (`2001:db8::1`).
  - `user_agent`: the `User-Agent` header, **cut to 300 characters**. The site reads the browser and system from it
    (`parseUserAgent`); keep the raw text, don't parse it on the server.
  - `session_id`: the id of the sign-in session (the token's session) the action was made in; none for a failed
    sign-in. `request_id`: the request's id as in the server's own logs (so a line can be found there). A good
    sign-in writes no line (it sets `last_login_at`); it starts the session whose id the person's next lines carry.
- **`GET /audit/:id`** → the line plus `{ related_by_actor: AuditEntry[], related_by_target: AuditEntry[] }`, each newest
  first, at most 20, without the line itself: `related_by_actor` = the same `actor_id`'s other lines on the same day
  (the company's time zone, Asia/Baghdad; the demo uses the browser's), empty when the line has no person;
  `related_by_target` = the other lines with the same `target.type` and `target.id` (the same `label` when there is no
  id), and for an account also its failed sign-ins and locks (`login` and `user` targets with the same id). Same
  permissions as the list (403), **404** when there is no such line. The page shows the line from the list at once and
  takes the context from this call (`AuditDrawer`, `src/features/admin/components/audit-drawer.tsx`).
- **Privacy:** IP addresses, devices and sessions are personal data. Only the `admin` and the `ceo` see them (the
  audit calls above); no other call returns them, and they never go into notifications or exports for other jobs.
  **Open question (client, section 22):** how long to keep them. If they must go after a while (for example 12
  months) while the line stays, keep `ip`, `user_agent` and `session_id` in a side table by line id that a scheduled
  job empties, so the line itself is never changed.

Written for:
`user_created`, `user_changed` (with every changed field), `user_stopped`, `user_restarted`, `user_unlocked`,
`team_created`, `team_changed`, `settings_changed`, `login_failed`, `login_locked`, `project_created`,
`project_pm_changed`, `sprint_closed`, `template_deleted`, `announcement_deleted`, `criteria_changed`,
`criteria_approved`, `review_finalized`, `picture_removed` (someone else's picture, section 19), `rating_deleted` (every removed quick
rating), `rating_changed` (the CEO changing someone else's; section 21). (Task, project and bug histories stay where they are, sections 4, 6, 10.)

## 15. GitHub

Shapes: `src/features/github/types.ts`; rules: `src/features/github/rules.ts`; the demo backend: `src/features/github/mock.ts`.

**The connection is the server's job:** a GitHub App installed on the company's GitHub organization sends webhooks
(pull requests, pushes) to the backend. **The browser never talks to GitHub and never holds a GitHub key.**

- `GET /projects/:id/github` → `{project_id, enabled, repos}` (can see the project). `PUT /projects/:id/github
  {enabled, repos}`: the project's PM and the `ceo` (403). `repos`: "owner/name" (422 on `repos`), at most 5, no
  duplicates; `enabled: true` needs at least one.
- **Linking:** a pull request (title or branch) or a commit (message) that mentions a task's or bug's **code as a whole
  word** (`TSK-104`, not `TSK-1040`) in one of the project's repositories is linked to it. Other repositories are ignored.
- `GET /tasks/:id/github`, `GET /bugs/:id/github` → `{enabled, repos, items: [{id, kind: "pr"|"commit", repo, ref,
  title, state?: "open"|"merged"|"closed", author, at, url}]}`, newest first; `{enabled: false, repos: [], items: []}`
  when off. **`url` must be an `https://github.com/` address** (the site shows nothing else as a link).
- When a linked pull request is **merged**, notify the task's assignee `github_pr_merged` (data: `note` = "repo #n").
  *(Assumption, BRIEF question 10: one way. The platform shows GitHub; it doesn't move a task by itself.)*

## 16. Monitoring notes and the CEO's inbox

The monitoring and evaluation officer writes **reports** (about a team, a person, a project, or general), **feedback**
on any person (praise or something to improve), and **problems**. She keeps them, and sends any of them to the CEO
whenever she wants. The CEO reads them in her inbox, answers, and marks them done.

```text
MonitorNote {
  id, kind: "report" | "feedback" | "problem", title (≤160), body (≤5000),
  about: { type: "team" | "person" | "project" | "general", id?, label?, label_en? },   // label = a copy of the name
  tone?: "praise" | "improve",              // feedback only
  subject? (≤120),                          // problems: what it is about, in her own words
  people?: [{ id, label, label_en? }],      // problems: the people involved (≤30, anyone active; names copied)
  author_id, created_at,
  sent_at?, ceo_state?: "new" | "seen" | "done", ceo_reply? (≤2000), replied_at?,
  triage?: "pending" | "forwarded" | "answered",   // requests only: what the monitoring officer did with it
  forward_note? (≤2000), monitor_reply? (≤2000), triaged_by?, triaged_at?,
  shared_with?: [{ id, label, label_en?, at, seen_at? }],   // reports, feedback, problems sent to people other than the CEO
  facts?: ReportFacts                       // reports from the report builder: the numbers counted when it was saved
}

ReportFacts {
  about, period: { from, to },              // "YYYY-MM-DD", both included
  assigned, done, left, late, blocked,      // counted exactly like the performance page (section 13)
  completion,                               // done / assigned, 0–1
  on_time: number | null,                   // of the tasks finished in the period that had a due day: share by that day
  planned: number | null,                   // average time gone (plannedRatio at period.to) of the projects involved
  bugs_reported, bugs_closed,               // created_at / closed_at inside the period
  bugs_open,                                // not "closed" now
  rows: [{ type: "person" | "project", id, label, label_en?, assigned, done, late, blocked, completion }],
  counted_at
}
```

| Call | Who | Notes |
|---|---|---|
| `GET /monitoring/notes` | `monitor`, `ceo` | The writer sees hers, and the `monitor` also every request (`kind: "request"`, for the Incoming requests tab); the CEO sees all. Newest first (by `sent_at`, else `created_at`). |
| `POST /monitoring/notes` | `monitor`, `ceo` | Body: `{ kind, title, body, about: { type, id? }, tone?, subject?, people_ids?, send? }`. A problem may be `about: general` with a free `subject` and any `people_ids`. The server copies the name into `about.label`. Feedback must be about a person, not yourself. `send: true` sends it at once to the CEO. `share_ids: number[]` (optional, ≤30, active people; the writer and the CEO are skipped) sends it to those people too (see below). A report from the builder also sends `period: { from, to }`: the server counts the numbers **again** itself (never trusts numbers from the browser) and keeps them in `facts`; `period` on another kind, or with `about: general`, is **422**. |
| `GET /monitoring/report-facts?type=&id=&from=&to=` | `monitor`, `ceo` | The report builder. `type` is `team`, `person` or `project`. A team: its members' tasks in every project, one row per member (members with no task included). A person: their tasks, one row per project they have tasks in. A project: its tasks, one row per person with tasks in it. Bugs: a project's bugs; for a team or a person, the bugs assigned to them. Bad period or unknown `id`: **422** (`period`, `about`). Others: **403**. |
| `POST /monitoring/notes/:id/send` | its writer, `ceo` | Sets `sent_at` = now and `ceo_state` = "new" (sending again brings it back to "new"). Notifies every active CEO: kind `note_sent`, `data.title`. |
| `POST /monitoring/notes/:id/share` | its writer, `ceo` | Body: `{ user_ids: number[] }` (at least one: **422** `share_ids`). Not for requests (**403**). Adds each new person to `shared_with` (the writer, the CEO and people already there are skipped) and notifies them: kind `note_sent`, `data.title`, `data.queue: "received"`. |
| `GET /monitoring/received` | signed in | The notes whose `shared_with` holds me, newest first (the "Received from monitoring" tab of the Requests page). |
| `POST /monitoring/notes/:id/seen` | a person in `shared_with` | Sets my `seen_at` once (the writer sees who opened it). Not sent to me: **404**. |
| `POST /monitoring/requests/:id/forward` | `monitor`, `ceo` | Body: `{ note? }` (≤2000, for the CEO's eyes). Only a `triage: "pending"` request (else **409 `BAD_STATE`**). Sets `triage: "forwarded"`, `triaged_by`, `triaged_at`, `forward_note`, then sends it to the CEO like `/send` (`sent_at`, `ceo_state: "new"`, `note_sent` to the CEOs). |
| `POST /monitoring/requests/:id/answer` | `monitor`, `ceo` | Body: `{ reply }` (required, ≤2000: **422** `reply`). Only a pending request (**409**). Sets `triage: "answered"`, `monitor_reply`, `triaged_by`, `triaged_at`; it is **not** sent to the CEO. Notifies the writer: kind `note_answered`, `data.title`, `data.note` = the reply, `data.note_kind: "request"`. |
| `GET /ceo/inbox` | `ceo` | Every sent note, newest first. Others: **403**. |
| `POST /ceo/inbox/:id/answer` | `ceo` | Body: `{ state: "seen" | "done", reply?, reopen? }`. Opening a note sends "seen". A reply notifies the writer: kind `note_answered`, `data.title`, `data.note` = the reply. "done" stays done when only opened again; `reopen: true` (with "seen") takes a done note back to "seen". Done notes are never deleted: the inbox shows them under "Done" (the CEO's archive), so `GET /ceo/inbox` keeps returning them. |

- A note you may not see answers **404** (like one that doesn't exist). Validation errors are **422** with per-field
  messages (`title`, `body`, `about`, `kind`, `reply`) in Arabic and English, like every other form.
- `note_sent` and `note_answered` are **required** notifications (nobody can turn them off). `note_answered` carries
  `data.note_kind` ("request" opens the Requests page). `note_sent` carries `data.queue`: `"monitor"` (a request waiting
  for the monitoring officer: opens `/monitoring?show=requests`), `"received"` (a note sent to me: opens
  `/requests?tab=received`), or nothing (the CEO's inbox).

**Requests (every job but the CEO, since 21 November 2026):** anyone except the CEO sends a note with
`kind: "request"`, a `subject` (required, anything) and `about: { type: "general" }`. The CEO: **403** for
`kind: "request"` (the one agreed exception to the CEO rule: requests go to the CEO).

**Requests pass through the monitoring officer (the client, 22 November 2026):** a new request is **not** sent to the
CEO. It gets `triage: "pending"` (no `sent_at`) and every active `monitor` is notified (`note_sent`,
`data.queue: "monitor"`). She then either **forwards** it to the CEO (`/forward`, with an optional note) or **answers**
it herself (`/answer`). Once forwarded, the CEO's answer (`/ceo/inbox/:id/answer`) goes **straight to the writer**, not
back to her. Two cases go straight to the CEO (as before: `sent_at` set at once, no `triage`): a request written by the
`monitor` herself, and any request when there is no active `monitor`.

**Reports to anyone (22 November 2026):** the monitoring officer chooses who gets a report, feedback or problem: the
CEO (`send`), and/or any people (`share_ids` on create, or `/share` later). They find it on their Requests page under
"Received from monitoring"; opening it calls `/seen`. Every report and list can be printed or saved as a PDF from the
browser (no server call).

**Private chats with the CEO (22 November 2026):** `POST /chats/direct` with the CEO as the other person answers **403**
for every job **except the `monitor`**: only the monitoring officer speaks directly with the CEO (and writes freely there). In a private chat the CEO started, the other person may send only
after the CEO has written there (403 before).

## 17. The CEO's advanced settings

Shapes: `src/features/advanced/types.ts` (`AdvancedRules`, `SettingsChange`) and `src/shared/lib/site.ts` (`SiteLive`,
`Banner`, `FeatureKey`); defaults, limits and checks: `src/features/advanced/rules.ts` (`DEFAULT_RULES`, `rulesOf`,
`checkRules`, `changedRules`, `diffRules`, `liveFor`); the demo backend: `src/features/advanced/mock.ts`; what the
settings switch in the other demo backends: `src/mock/site.ts`, `src/mock/notify.ts` and `commit()` in `src/mock/db.ts`.

**Who:** the `ceo` only (`GET/PUT /ceo/advanced`, `GET /ceo/advanced/history`): **403** for everyone else.
`GET /site/live` is for everyone signed in.

**Calls**

| Call | Body | Answer |
|---|---|---|
| `GET /ceo/advanced` | | `{ rules: AdvancedRules, updated_at?, updated_by?: {id, name} }`, the defaults merged in |
| `PUT /ceo/advanced` | `{ rules: Partial<AdvancedRules>, how?: "import" \| "reset" }` | the same as GET |
| `GET /ceo/advanced/history` | | `SettingsChange[]` newest first: `{id, at, by: {id, name, name_en?}, how?, changes: [{key, from, to}]}` |
| `GET /site/live` | | `{ features: {[key]: boolean}, banner: Banner \| null, read_only: {on, message, message_en?} }` |

**How a save works (the server must keep all of it):**

1. `rules` holds only what differs from the defaults (the page sends `changedRules`). **Anything missing is its
   default**, so the body is the whole state: `how: "reset"` sends `{}`. Merge one level down (`rulesOf`): a setting
   added later needs no data change.
2. Check the merged rules with the same checks as `checkRules`; any problem → **422** `VALIDATION` with `errors` keyed
   by the setting (`"work.days"`, `"names.task"`, `"banner.text"`…), in the request's language. Nothing is saved.
3. Compare with the rules in force **after merging the defaults on both sides** (`diffRules`, one level down: `work.days`,
   `permissions.change_due`, `banner`). Ticks compare as sets (order doesn't count). **No change → no history line and
   no audit line.** (Project 2 wrote "— → 21" lines on the first save because it compared against missing values.)
4. Store only the differences. The first three security numbers are **the administration's settings**
   (`/admin/settings`, section 14): write them there, not twice. Keep the history (the demo keeps 300) and write one
   audit line `settings_changed` (target `settings`, "الإعدادات المتقدمة") with each change.

**The data, defaults and limits**

| Key | Default | Limits / meaning |
|---|---|---|
| `work.days` | `[0,1,2,3,4]` (Sun–Thu; 0 = Sunday) | whole 0–6, no repeats, at least one |
| `work.from`, `work.to` | `"08:00"`, `"16:00"` | `HH:MM`, from before to (`work.hours`) |
| `work.holidays` | `[]` | ≤ 60, each `{date: YYYY-MM-DD, name ≤ 60, name_en? ≤ 60}`, one per day |
| `due_days.{high,medium,low}` | 3, 7, 14 | working days, whole 1–90 |
| `fix_days.{critical,high,medium,low}` | 1, 3, 7, 14 | working days, whole 1–60; a worse severity never more than a lighter one |
| `tasks.approver` | `"either"` | `"pm"`, `"lead"` or `"either"` (the CEO always may) |
| `tasks.employee_reopen` | `true` | an employee may move their finished task back |
| `tasks.due_reason` | `false` | a reason (`due_note`) is required to change a due date |
| `tasks.wip_limit` | 0 | tasks in progress per person, 0 = none, whole 0–50 |
| `permissions.<action>` | today's rules (below) | jobs from `pm, monitor, lead, employee, admin`; never `ceo` (always allowed) |
| `notify.<kind>` | every job | jobs that get the kind; **required kinds (section 7) must list every job** |
| `features.<key>` | all `true` | `chat`, `group_chats`, `bugs`, `reviews`, `announcements`, `requests`, `github`, `welcome` |
| `security.lock_after`, `lock_minutes`, `due_soon_days` | 5, 15, 1 | the administration's settings, same limits (3–10, 5–120, 1–7) |
| `security.password_min` | 8 | 6–32, new and changed passwords only |
| `names.{task,project,bug}` | `TSK`, `PRJ`, `BUG` | 2–5 capital letters A–Z, all different; new records only |
| `banner` | `null` | `{text 1–300, text_en? ≤ 300, roles: Role[] (none = everyone), tone: "info"\|"warning", until?: ISO}` |
| `read_only` | `{on: false, message: ""}` | `message` required when on, ≤ 300; `message_en?` ≤ 300 |
| `roles` | `[]` | the CEO's own jobs, at most 20 (section 17.1) |

The actions and their defaults (today's rules in the features' `rules.ts`): `create_project` pm · `close_project` pm ·
`delete_task` pm, lead (no delete in the platform yet) · `reassign_task`, `change_due`, `approve_done` pm, lead ·
`post_announcement` monitor, admin · `create_group_chat` pm, monitor, lead · `see_scores` pm, monitor, lead ·
`write_reviews` pm, lead · `see_reports` pm, monitor, lead · `export_csv` pm, monitor, lead, admin · `report_bugs` pm,
monitor, lead, employee · `bug_severity` pm, lead.

**What the server must enforce now (version 1, the demo does it):**

- **Features off:** for everyone but the `ceo`, the feature's calls answer **403 `FEATURE_OFF`** ("أوقفت الإدارة هذه
  الميزة الآن."): `chat` → `GET /chats`, sending, `POST /chats/direct`, new groups; `group_chats` → new groups;
  `bugs` → `GET /bugs`, reporting; `reviews` → writing and finalizing reviews; `announcements` → posting; `requests` →
  an employee's request (`POST /monitoring/notes` with `kind: "request"`); `github` → `PUT /projects/:id/github`, and
  `GET /{tasks|bugs}/:id/github` answers `{enabled: false, repos: [], items: []}`. `welcome` is the page's only. The
  menu hides the feature's page (`/site/live`); the data stays and comes back when switched on.
- **Read-only mode:** every change by anyone but the `ceo` answers **423 `READ_ONLY`** with the CEO's message, and
  changes nothing. Still allowed: signing in, reading and marking notifications, notification preferences, marking a
  chat or an announcement as read.
- **Banner:** `/site/live` sends it only to the jobs in `roles` (none = everyone) and only until `until`.
- **Notification table:** a kind is sent to a person only if their job is in `notify.<kind>` (then their own
  preference decides, section 7). Required kinds always go.
- **Code prefixes:** new tasks, projects and bugs get `<prefix>-<number>`. Old codes never change.
- **Security:** the same values as `/admin/settings` (the lock and the due-soon reminder already use them).

**Saved now, enforced later** (kept and shown; the server should enforce them when the matching screens come):
working days and hours, holidays, due days per priority, fix targets per severity (the home page already counts bugs
past their target in working days), who approves a task, an employee reopening a task, the reason for a due date
change, the in-progress limit, the whole «who may do what» table, and the shortest password.

### 17.1 Jobs the CEO makes (custom roles)

The CEO makes new jobs in the advanced settings («الوظائف والأدوار / Jobs and roles»). They travel in the same
calls: `rules.roles` in `GET/PUT /ceo/advanced` (so they are in the history, the settings file and the reset), and
`roles` in `GET /site/live` (everyone signed in gets them: names, colours, what each may do and see; nothing secret).

```text
CustomRole {
  key: "role-…" (2–40 of a–z 0–9 -, unique; what User.custom_role holds),
  name (1–40), name_en (1–40): unique among the roles, and never the name of one of the six jobs,
  description? (≤ 200), color: "todo" | "progress" | "review" | "testing" | "done" | "new",
  base: "pm" | "monitor" | "lead" | "employee"   (never "ceo" or "admin"; can't change after it is made),
  actions: ActionKey[]   (the actions of «who may do what» it may do; only ones its base job does today),
  pages: string[]        (the menu items it sees; only ones its base job sees: NAV keys in src/shared/lib/access.ts)
}
User { …, role: <the base job>, custom_role?: <the role's key> }
```

- At most **20** roles. Every check is in `checkRoles` (`src/features/advanced/rules.ts`); a problem → **422** keyed
  `roles.<key>.<field>` (`name`, `name_en`, `description`, `color`, `base`, `actions`, `pages`) or `roles` (too many).
- A save that changes an existing role's `base` → **422** on `roles.<key>.base`.
- A save that removes a role still given to an **active** account → **409 `BAD_STATE`** naming the role and how many
  people have it ("move them first"). An import or a reset may remove it: then clear `custom_role` from its people
  (they keep their base job). Stopped accounts with a removed role are cleared too.
- History: one line per role made, changed or removed, key `roles.<key>`, from the role (or null) to the role (or null).
- `GET /site/live` also answers `me: {role, custom_role?}`, the person's job as the server has it now, so a page open
  since before an admin changed it catches up.

**Giving a role** (`POST /admin/users`, `PATCH /admin/users/:id`, the admin and the `ceo`): body `custom_role: <key> |
null`. The role must exist (**422** on `role`); the account's `role` becomes the role's `base` whatever was sent; `null`
clears it. Nobody changes their own (409, like the role). A changed `role` that no longer fits the custom role's base
clears it. Audit: a `custom_role` change line with the role's name.

**What the server must enforce now.** A request from someone with a custom role is checked against the base job's
rules first (everything above, unchanged), **and then against the role**: these actions answer **403 `FORBIDDEN`**
("دورك «…» لا يسمح بهذا العمل.") when the role's tick is off:

| Action | Calls |
|---|---|
| `create_project` | `POST /projects` |
| `reassign_task` | `PATCH /tasks/:id` changing `assignee_id` |
| `change_due` | `PATCH /tasks/:id` changing `due` |
| `post_announcement` | `POST /announcements` |
| `create_group_chat` | creating a group chat |
| `write_reviews` | `POST /reviews`, `PATCH /reviews/:id`, `POST /reviews/:id/finalize`; and `can_review: false` in `GET /performance/people/:id` |
| `report_bugs` | `POST /projects/:projectId/bugs` |
| `give_ratings` | `POST /teams/:id/ratings`, `POST /people/:id/ratings`; and `can_rate: false` in the ratings calls (section 21) |

The pages hide the matching buttons. **The CEO is never limited** (the CEO rule), and people without a custom role are
unaffected. The menu hides the pages the role doesn't see (now). **Later:** refusing those pages' calls for the role
(today a direct link still opens what the base job may open), and the other seven actions.

## 18. Quick search (Ctrl+K)

The top bar has a search (also Ctrl+K / ⌘K, or "/"). It finds pages on its own (from the menu) and asks the server for
the rest. `GET /search?q=` (signed in; `q` 2–80 characters, else **422** on `q`) answers:

```text
{ q, hits: [{ kind: "project" | "task" | "bug" | "announcement" | "person", id, title, title_en?, code?,
              context?, context_en?,      // the project of a task or bug; a person's job title
              role?, team_id? }] }        // people only: the page decides if the name opens their performance
```

- **Only what the person may see** (the same rules as the lists): the projects they may see; tasks and bugs in those
  projects; announcements; active people. At most **8 of each kind**, best matches first.
- Match on: project name (Arabic and English) and code; task title and code; bug title and code; announcement title and
  text; person name (both languages), email and job title. Case and Arabic letter forms (أ إ آ ا, ة ه, ى ي) should not
  matter, like the front end's `matches()` in `src/shared/lib/utils.ts`.
- It is called while typing (after a 160 ms pause): keep it fast (an index on titles and codes, or Postgres full-text).

## 19. Profile pictures

Rules and limits: `src/features/profile/rules.ts`; the calls: `src/features/profile/api.ts`; the demo backend (the reference):
`src/features/profile/mock.ts`; the tests: `tests/unit/profile.test.ts`. Every job may set, change and remove **their own**
picture (the client, 21 November 2026: "make it able for every role to change their pics").

`User` gets **`avatar_url?: string`**: the address of the picture, or nothing (the site then draws the person's first
letter on a colour). It is part of `User` everywhere: `/auth/login`, `/me`, `/users`, `/admin/users`.

**Setting it** (`PUT /me/avatar`, `multipart/form-data` with one field **`file`**) → the updated `User`:

- Always the signed-in person: there is no call to set someone else's picture.
- The browser already sends a small square: **256×256, WebP** (JPEG where the browser can't write WebP), usually 10–60 KB.
  The person picks a JPEG, PNG or WebP of up to 5 MB, crops it and the browser makes the small copy.
- **The server checks again** (the browser can be skipped): the **real content** must be PNG, JPEG or WebP (read the first
  bytes, never trust the name or `Content-Type`); **never SVG or HTML** (they can run code in a browser). At most
  **200 KB**; empty → 422. Errors: **422 on `file`**, in the request's language.
- **Decode and draw it again** on the server (any image library): that drops what the file carries besides the picture
  (place, camera, date: EXIF and other metadata) and anything hidden in it. Store it at most 256×256 (or make 256 from a
  larger one), as WebP or JPEG.
- **Where:** in object storage (S3-compatible, or the server's files folder) under a server-made name such as
  `avatars/<user_id>/<random>.webp`, with a row in a files table (owner, size, type, created_at), never inside the users
  table. `avatar_url` is where the site loads it from: a public CDN address, or a long-lived signed link. **A new name for
  each new picture** (so caches never show the old one), served with `Cache-Control: public, max-age=31536000, immutable`
  and `Content-Type` set by the server, `X-Content-Type-Options: nosniff`. The old file is deleted when replaced.
- Read-only mode (section 17) still allows it: a person's own picture is their own bookkeeping, like their notification
  choices. *(Assumption.)*

**Removing my picture** (`DELETE /me/avatar`) → the updated `User` without `avatar_url`; delete the file.

**Removing someone's picture** (`DELETE /users/:id/avatar`): the `admin` and the `ceo` (THE CEO RULE), for a picture that
is not appropriate (the admin's user window has "Remove picture"). Anyone else → **403**, unknown user → 404. Removing
yourself this way is allowed too. Log **`picture_removed`** in the audit log (`target: {type: "user", id, label: name}`)
when it is someone else's. The person can set a new one. *(Not decided with the client: whether the person is told.)*

## 20. Birthdays

The client (22 November 2026): "all the accounts should have a birth date, and when that day comes the monitor should be
notified; also notified a week before". The date maths: `src/shared/lib/birthday.ts`; the privacy rule: `canSeeBirthDate`
in `src/shared/lib/access.ts`, applied by `birthdayView`; the demo reminders: `remindBirthdays` in `src/mock/notify.ts`;
the tests: `tests/unit/birthdays.test.ts` and `tests/e2e/birthdays.spec.ts`.

**The field.** `User` gets **`birth_date?: "YYYY-MM-DD"`** (the full date) and **`birthday?: "MM-DD"`** (the day and
month only). The admin and the CEO set it with `POST /admin/users` and `PATCH /admin/users/:id` (`birth_date`; `null`
clears it). Nobody else can change it, not even the person (as with the name and the job).

- **Optional, but asked for** *(our choice, to confirm with the client)*: the accounts already on the server have none,
  and a required field would block every change to them until someone knows the date. The admin's form suggests it,
  and the admin's list marks the active accounts without one, with a filter to find them. No date: no reminders.
- **Checks (422 on `birth_date`, in the request's language):** a real day written `YYYY-MM-DD` (not 2026-02-30), not
  after today, and an age **from 16 to 80** on today (the company's time zone). The check: `birthDateProblem`; the
  messages: `BIRTH_DATE_ERRORS` in `src/features/admin/rules.ts`.
- The audit log's `user_changed` line names the field (`birth_date`) but **writes neither the old nor the new date**.

**Privacy (birthdays are personal).** Only the person themself, the `admin` and the `ceo` see the year (and so the age):

| Call | `birth_date` (with the year) | `birthday` ("MM-DD") |
|---|---|---|
| `/auth/login`, `/me` (yourself) | yes | yes |
| `/admin/users` (admin, ceo) | yes, everyone's | yes |
| `/users` asked by the admin or the ceo | yes, everyone's | yes |
| `/users` asked by anyone else | **only their own** | yes, everyone's who has a date |

No other call returns either field, and no notification or export carries a year of birth (the reminders carry only the
day of that year's birthday).

**The reminders.** Two kinds, **not required** (each person may turn them off; the CEO's notification table, section 17,
may stop them for a whole job):

| `kind` | When | Data |
|---|---|---|
| `birthday_soon` | exactly **7 days before** the birthday | `person_id`, `person_name`, `person_name_en`, `due` = the day of the birthday that year |
| `birthday_today` | **on the day** | the same |

- **Who gets them:** every **active** `monitor` (the client) and the `ceo` (the CEO rule; *our choice*: she can untick her
  job for these kinds in the notification table). Never the person whose birthday it is, and only about **active**
  accounts. No `actor_id`.
- **A daily job** each morning (for example 07:00) **in the company's time zone, Asia/Baghdad**: for every active person
  with a birth date, take their next birthday on or after today; 0 days away → `birthday_today`, exactly 7 days away →
  `birthday_soon`. The week before works across the year end: a 3 January birthday is reminded on 27 December.
- **29 February:** in a year without one, the birthday is **28 February** (both reminders count from that day).
- **No duplicates:** at most one notification per receiver, person, kind and `due`, so once a year each. A unique key on
  (`user_id`, `kind`, `data.person_id`, `data.due`) makes running the job twice safe; after a missed morning, run it
  for the missed day (with that day as "today"). The demo makes them when someone opens their notifications
  (`GET /notifications`), with the same rule.
- The site writes the sentence from `kind` and `data`, counted from today: «عيد ميلاد سارة علي بعد أسبوع (29 تشرين
  الثاني)», «اليوم عيد ميلاد سارة علي». A click opens the person's performance page when the reader may open it, else
  the birthdays card on the dashboard.

**Where people see them** (no new call): the "Upcoming birthdays" card on the monitoring officer's and the CEO's
dashboard (the next 30 days, from `GET /users`: day and month only), and «عيد ميلاد سعيد» in the person's own welcome
splash on the day.

## 21. Quick ratings of teams and people, and the team pages

The client (22 November 2026): "add a rating system for teams, and make sure the monitor can rate for whatever reason",
then, on the performance page, "here it should be able to give a rating as a monitor". A **quick rating** is a score
with a reason, given at any time and for any reason, about a **team** or a **person**. It is not the periodic
performance review of section 13 (the pages call them «تقييمات سريعة» and «التقييم الدوري»): reviews keep working as
they are.

Shapes: `src/features/ratings/types.ts`; rules, checks and the numbers: `src/features/ratings/rules.ts` (pure, tested in
`tests/unit/ratings.test.ts`); the demo backend (the reference): `src/features/ratings/mock.ts`.

```text
Rating {
  id, subject_type: "team" | "person", subject_id,        // the team's id or the person's user id
  rater_id, score: 1..5,                                   // 1 ضعيف Poor · 2 مقبول Fair · 3 جيد Good · 4 جيد جداً Very good · 5 ممتاز Excellent
  reason_type: "quality" | "deadlines" | "teamwork" | "attitude" | "incident" | "other",
  reason (1–1000, trimmed),                                // in the rater's own words, required
  project_id?, project_name?, project_name_en?,            // optional; the names are copied when it is written
  period?: { from, to },                                   // optional, "YYYY-MM-DD", from ≤ to
  private: boolean,                                        // only the CEO and the rater see it
  created_at, edited_at?, edited_by?                       // edited_by: set when someone other than the rater changed it (the CEO)
}
RatingInput { score, reason_type, reason, project_id?: number | null, period?: { from, to } | null, private?: boolean }
RatingSummary { count, average (1 decimal) | null, recent: {count, average}, before: {count, average},   // last 90 days / older
                by_type: { [reason_type]: n }, by_score: [n1..n5], last?: { score, reason_type, created_at } }
```

One table holds both kinds (`subject_type`, `subject_id`), so a person's and a team's ratings follow the same rules.

**Who (assumptions, to confirm with the client):**

| | ceo | monitor | pm | lead | employee | admin |
|---|---|---|---|---|---|---|
| Rate a team | any | any | the teams with a member in a project they run | | | |
| Rate a person | anyone | anyone | the people in the projects they run | | | |
| Read a team's ratings | all | all | the teams they may rate | their own team's | their own team's | |
| Read a person's ratings | all | all | the people they may rate | their own | their own | |
| See a team page `/teams/:id` | all | all | all | their own team | their own team | all (members only) |

- **Nobody rates themselves**, and the CEO and the system admin are never rated (403).
- **Private** ratings are read only by the CEO and their writer: not by the team, its leader, the person, other raters
  or PMs. Nobody is told about a private rating.
- **Changing and removing:** the writer may change (`PATCH`) or remove (`DELETE`) a rating for **24 hours** after
  `created_at`; after that it stays as history: **409 `BAD_STATE`** for the writer. The CEO may change or remove any
  rating at any time (the CEO rule). Someone else who may read it: **403**. **Every removal** is written in the audit
  log (`rating_deleted`, target the team (`team`) or the person (`user`), changes: the score, kind, reason and who wrote
  it), and so is the CEO changing someone else's (`rating_changed`, before → after; the rating gets `edited_by`).
- **Custom roles** (section 17.1): the action `give_ratings` («التقييمات السريعة للفرق والأشخاص», default: pm,
  monitor). A role without it gets **403** on both `POST` calls, and `can_rate: false`.
- Read-only mode (section 17) refuses the three changing calls (423) like any other change.

**Calls:**

| Call | Answer, rules |
|---|---|
| `GET /teams/ratings/summary` | `[{ team, member_count, ratings: RatingSummary \| null, can_rate }]`: the teams this person may see (see the table); `ratings` is null when they may not read the team's ratings, and counts only the ratings they may read (private ones only for the CEO and their writer). Declare it before `/teams/:id` (or keep `:id` numeric). |
| `GET /teams/:id` | `{ team, members: User[], can_see_ratings, tasks: {open, late, blocked, done} \| null }`. Members are the active users with this `team_id`, the leader first. `tasks`: the members' tasks now, over the projects this person may see (done = a status of tone `done`; late = not done and `due` before today; blocked = tone `blocked`), only for the jobs that see the reports (ceo, pm, monitor, lead); null for others. A team they may not see: **404**. |
| `GET /teams/:id/ratings` | `{ items: Rating[], can_rate }`, newest first, only the ones they may read. **404** for a team they may not see; **403** when they may see the team but not its ratings (the admin; a PM for a team outside their projects). |
| `POST /teams/:id/ratings` | Body `RatingInput` → the new `Rating`. **403** for who may not rate it; **422** per field (`score`, `reason_type`, `reason`, `period`, `project_id`: a project this person may see). Unless private: notify the team's leader `team_rated`. |
| `GET /people/ratings/summary` | `[{ user_id, ratings: RatingSummary, can_rate }]`: every active person (not the CEO or the admin) whose ratings this person may read. The performance page shows them in its «التقييم» column. |
| `GET /people/:id/ratings` | `{ items, can_rate }` like a team's. Unknown user **404**; not allowed **403**. |
| `POST /people/:id/ratings` | Like a team's. Unless private: notify the person `person_rated` (it opens `/performance/:id#ratings`). |
| `PATCH /ratings/:id` | Body `RatingInput` → the changed `Rating` (`edited_at`). A private rating made visible notifies then. **404** if they may not read it, **403** / **409** as above. |
| `DELETE /ratings/:id` | Removes it (an audit line). **404** / **403** / **409** as above. |

**Notifications** (section 7): `team_rated` and `person_rated` are **not required** (people may turn them off), and the
CEO's table of who gets what lists them like the others.

**Where it shows:** `/teams` (the list: leader, people, average and trend, the last rating, "Rate"; a menu item for the
ceo, pm and monitor), `/teams/:id` (people, the task numbers, the ratings: average, trend, by kind of reason, the list),
the performance page (the team cards and an «التقييم» column per person, each with "Rate"), the person's performance
page (a «تقييمات سريعة» section apart from the periodic reviews), and the monitoring officer's dashboard ("Rate a
team"). Every team name on the dashboard, the performance page, the reports and the admin's teams opens `/teams/:id`.

## 22. Still open with the client

Each assumption is written in its section above. The main ones to confirm: who approves completion (section 4), the
required notifications (7), file sizes and types (8), what a team is (11, 12, 14), "late project" and velocity (12),
the review criteria and who reviews whom (13), the sign-in lock and backups (14), how long the audit log keeps IP
addresses and devices (14), GitHub one-way or two-way (15), whether a birth date must be required and whether the CEO gets the birthday
reminders too (20), who gives and reads quick ratings and the 24-hour window to change one (21).
