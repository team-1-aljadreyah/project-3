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
- **Create a project:** `ceo` and `pm`. A `pm` always becomes the new project's manager (`pm_id` = themselves, whatever was sent). *(Assumption, to confirm with the client.)*
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
`assignee`, `due`, `priority`, `title`, `description`, `phase` (old and new phase ids), `comment`.

**Phases on tasks:** `phase_id` (on create and PATCH) must be one of the project's phases (422 on `phase_id`).
On PATCH, `null` takes the task out of its phase.

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
| `POST /projects` | `ceo`, `pm` | `Project` |
| `PATCH /projects/:id` | its PM, `ceo` | `Project` |
| `PUT /projects/:id/statuses` | its PM, `ceo` | `Project` |
| `PUT /projects/:id/phases` | its PM, `ceo` | `Project` |
| `POST /projects/:id/sprints` | its PM, `ceo` | `Sprint` |
| `PATCH /sprints/:id` | its project's PM, `ceo` | `Sprint` |
| `DELETE /sprints/:id` | its project's PM, `ceo` | nothing |
| `GET /projects/:id/history` | can see it | `ProjectEvent[]` |

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

**History** (`GET /projects/:id/history`): `[{id, project_id, actor_id, kind, from?, to?, note?, at}]`. Like the
task history, nobody can edit or hide it through the API.

## 7. Coming next (not used by the site yet)

Notifications (from the history events above), file attachments, project templates and task dependencies, chat,
announcements, bugs, reports, performance, GitHub. Each will add its section here in its own PR.
