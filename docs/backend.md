# What the backend must provide

Everything the real backend has to do for the site to work as it works on the demo data.

**The reference already runs.** The site works today on a fake backend in the browser (`src/features/*/mock.ts`,
rules in `src/features/tasks/rules.ts` and `src/features/projects/counts.ts`, data in `src/mock/seed.ts`). It has the
same calls as the real one (`src/features/*/api.ts`: paths, bodies, answers; shapes in each feature's `types.ts` and
`src/shared/api/types.ts`). When something here is not
clear, the matching function there is the exact behaviour the pages expect. The unit tests
(`tests/unit/task-flow.test.ts`) list the rules one by one.

Switching the site to the backend: `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_URL=https://api…`, then rebuild.

---

## 1. The basics (every call)

| Topic | What the site expects |
|---|---|
| Base URL | `{NEXT_PUBLIC_API_URL}/api/v1` + the paths below. JSON in, JSON out. |
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
| `dependency_done` | the last unfinished task another task waited for is done (`task_id` = the waiting task; data: `note` = the finished task's code) | the waiting task's assignee |
| `chat_mention` | someone writes @ and your name in a chat (`chat_key`; data: `note` = the message's start) | the mentioned members (section 11) |

**Reminders** (`task_due_soon`, `task_overdue`) come from the calendar, not from an action: the real server should make
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

- **Who posts** (`POST /announcements {title, body, important}`): `ceo` and `admin` ("the management"; 403 for others).
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
reports** (the PM or a team leader in the project); from anyone else they are ignored. Starts `assigned` when it has a
developer, else `reported`. Notify `bug_reported` and, with a developer, `bug_assigned`.

**Changing** (`PATCH /bugs/:id`): the project's PM and team leaders only. Log `severity`, `priority`, `due`, `assignee`, and
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

**The chats** (the brief: project, team and private chats). A chat's key is safe in a web address: `p-3` (project 3),
`t-1` (team 1), `d-7` (private chat 7).

| Kind | Members | Exists |
|---|---|---|
| project | the project's PM and members, **read each time** (someone removed from the project stops seeing its chat) | always, one per project |
| team | the active people with that `team_id` | always, one per team |
| private | the two people | made by `POST /chats/direct` the first time; **one per pair** |

`Team`: `{id, name, name_en?, lead_id?}` (`src/shared/api/types.ts`). *Assumption, BRIEF question 6 is open:* a team is
fixed, not made per project. `GET /teams` will come with the admin part.

**Who:** only a chat's members read it, write in it, see its files and are counted in it. **Not a member, or no such chat
→ 404** (the same answer, so nobody learns which chats exist). No role sees other people's chats, not the CEO either
(*assumption*: the audit log of a later part decides if the admin may).

`Conversation`: `{key, kind, title, title_en?, member_ids, last_message?, unread}`. `title` is the project's or team's name
(empty for a private chat: the site names it after the other person). `unread` = messages from others after the last one
this person read.

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

## 13. Coming next (not used by the site yet)

Performance reviews, admin (users, roles, settings) and the audit log, GitHub. Each will add its section here in its own PR.
