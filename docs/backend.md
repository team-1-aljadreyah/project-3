# What the backend must provide

Everything the real backend has to do for the site to work as it works on the demo data.

**The reference already runs.** The site works today on a fake backend in the browser (`src/features/*/mock.ts`,
rules in `src/features/tasks/rules.ts` and `src/features/projects/counts.ts`, data in `src/mock/seed.ts`). It has the
same calls as the real one (`src/features/*/api.ts`: paths, bodies, answers; shapes in each feature's `types.ts` and
`src/shared/api/types.ts`). When something here is not
clear, the matching function there is the exact behaviour the pages expect. The unit tests
(`tests/unit/task-flow.test.ts`) list the rules one by one.

Switching the site to the backend: `VITE_USE_MOCK=false` and `VITE_API_URL=https://api…`, then rebuild.

---

## 1. The basics (every call)

| Topic | What the site expects |
|---|---|
| Base URL | `{VITE_API_URL}/api/v1` + the paths below. JSON in, JSON out. |
| Success | `{ "success": true, "data": … }` (the site reads `data`). |
| Failure | `{ "success": false, "message": "نص للمستخدم", "code": "VALIDATION", "errors": { "field": "نص" } }` with the right HTTP status. `errors` keys are the form's field names (`title`, `blocked_reason`, `note`…): each shows under its field. |
| Codes | `VALIDATION` 422 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `BAD_STATE` 409 (not allowed in this state) · `RATE_LIMITED` 429. |
| Language | Every request has `Accept-Language: ar` or `en`. `message` and `errors` come in that language (Arabic: Modern Standard Arabic). |
| Sign in | `POST /auth/login {identifier, password}` → `{ token, user }`. `identifier` is the email (a phone may come later). Every other call: `Authorization: Bearer <token>`. A `401` signs the person out. Wrong email and wrong password give **the same** message. Rate-limit it. |
| Dates | ISO 8601 with time zone; days are `YYYY-MM-DD`. The working day is Baghdad time (UTC+3). |
| Passwords | Hashed (argon2/bcrypt). Never sent back. |
| CORS | Allow the site's domains only. |
| Demo data | The demo accounts (`@demo.test`, password `123456`) exist only in the demo build. Never on the real database. |

## 2. Jobs and who sees what

`role`: `ceo`, `pm` (project manager), `monitor` (monitoring & evaluation), `lead` (team leader), `employee`, `admin`.

The server must filter, not only the pages:

- **Projects:** `ceo`, `monitor` and `admin` see all. Everyone else sees the projects they are in (`pm_id` or `member_ids`).
- A project or a task you may not see answers **404, the same as one that doesn't exist** (nobody learns what exists).
- **Manage tasks** (create, edit any field, move any task): the project's PM, and a `lead` who is a member.
- **Move a task:** the managers above, or the task's assignee if they are a member.
- **Approve completion:** the managers above, and the `ceo`. *(Not confirmed by the client yet: BRIEF question 5.)*
- **Comment:** everyone who can see the project, except `admin`.

## 3. Task statuses

- Each project has its own `statuses: [{key, name, name_en, tone}]`, in board order. New projects start with
  the seven defaults (`src/shared/lib/statuses.ts` `DEFAULT_STATUSES`): `new`, `todo`, `in_progress`, `in_review`, `testing`, `completed`, `blocked`.
- `tone` is the family: `new`, `todo`, `progress`, `review`, `testing`, `done`, `blocked`. The rules work by
  family, so a project's own status (for example «بانتظار موافقة الإدارة», tone `review`) follows them too.
- A task's `status` is one of its project's keys.

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
`assignee`, `due`, `priority`, `title`, `description`, `comment`.

Every change updates the task's `updated_at`.

## 5. Endpoints

| Method and path | Who | Answer |
|---|---|---|
| `POST /auth/login` | anyone | `Session` |
| `GET /me` | signed in | `User` |
| `GET /users` | signed in | `User[]` |
| `GET /projects` | signed in (filtered) | `ProjectSummary[]`, with `tasks_total`, `tasks_done`, `tasks_late`, `tasks_blocked` |
| `GET /projects/:id` | can see it | `Project` |
| `GET /projects/:id/tasks` | can see it | `Task[]` |
| `GET /projects/:id/sprints` | can see it | `Sprint[]`, with `planned_ratio` for today |
| `POST /projects/:id/tasks` | managers | `Task` |
| `GET /tasks/:id` | can see its project | `Task` |
| `PATCH /tasks/:id` | managers | `Task` |
| `POST /tasks/:id/status` | managers, assignee | `{task, outcome}` |
| `POST /tasks/:id/approval` | managers, CEO | `Task` |
| `GET /tasks/:id/comments` | can see its project | `TaskComment[]` |
| `POST /tasks/:id/comments` | see section 2 | `TaskComment` |
| `GET /tasks/:id/history` | can see its project | `TaskEvent[]` |

**Counts:** a task is *late* when it has a `due` day before today and is not in a `done` status
(`src/features/projects/counts.ts` `lateDays`). `planned_ratio` = days gone / sprint length, between 0 and 1 (`plannedRatio`).

## 6. Coming next (not used by the site yet)

Notifications (from the history events above), file attachments, project setup (members, phases, templates,
custom statuses), chat, announcements, bugs, reports, performance, GitHub. Each will add its section here in its own PR.
