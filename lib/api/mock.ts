// The fake backend: the same calls as http.ts, on the demo data, with the same rules the real server must keep
// (who sees which project, who may change a task, a reason for "blocked", approval for "done", a history that
// can't be changed). It is the living reference for the backend.
import { getToken } from "../auth";
import { currentLocale } from "../boot";
import { canApprove, canComment, canManageTasks, isMember, LIMITS, planMove, statusOf } from "../task-rules";
import { countTasks, plannedRatio } from "../tasks";
import { today } from "../utils";
import { ApiError, type ErrorCode } from "./errors";
import type { Api } from "./http";
import { commit, getDb } from "./mock/db";
import { DEMO_PASSWORD } from "./mock/seed";
import type { Project, Task, TaskEvent, TaskPatch, User } from "./types";

const data = getDb;

/** A short wait, so loading states show in the demo like on a real network. */
const wait = <T>(value: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), ms));

const msg = (ar: string, en: string) => (currentLocale() === "ar" ? ar : en);

const fail = (status: number, code: ErrorCode, ar: string, en: string, errors?: Record<string, string>): never => {
  throw new ApiError(status, msg(ar, en), errors, code);
};

/** A form error: 422 with the message under the field. */
const invalid = (field: string, ar: string, en: string): never => fail(422, "VALIDATION", ar, en, { [field]: msg(ar, en) });

const nowIso = () => new Date().toISOString();

function currentUser(): User {
  const token = getToken();
  const id = token?.startsWith("demo-") ? Number(token.slice(5)) : NaN;
  const user = data().users.find((u) => u.id === id && u.active);
  if (!user) return fail(401, "UNAUTHENTICATED", "انتهت الجلسة، سجّل الدخول من جديد.", "Your session ended. Please sign in again.");
  return user;
}

/** The brief: the CEO, M&E and the admin see every project; a PM the ones they run; others the ones they're in. */
export function canSeeProject(user: User, project: Project) {
  if (user.role === "ceo" || user.role === "monitor" || user.role === "admin") return true;
  return isMember(user, project);
}

function projectFor(user: User, id: number) {
  const project = data().projects.find((p) => p.id === id);
  // Not found and not allowed answer the same, so nobody learns which projects exist.
  if (!project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المشروع.", "Project not found.");
  return project;
}

function taskFor(user: User, id: number): { task: Task; project: Project } {
  const task = data().tasks.find((t) => t.id === id);
  const project = task && data().projects.find((p) => p.id === task.project_id);
  if (!task || !project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المهمة.", "Task not found.");
  return { task, project };
}

function log(e: Omit<TaskEvent, "id" | "at">) {
  const db = data();
  db.events.push({ ...e, id: ++db.seq.event, at: nowIso() });
}

/** Checks a task's fields (new task or a change). Returns the cleaned title/description. */
function checkFields(project: Project, f: Partial<TaskPatch> & { title?: string }) {
  if (f.title !== undefined) {
    const title = f.title.trim();
    if (!title) invalid("title", "اكتب عنوان المهمة.", "Enter the task's title.");
    if (title.length > LIMITS.title) invalid("title", `العنوان أطول من ${LIMITS.title} حرفاً.`, `The title is longer than ${LIMITS.title} letters.`);
    f.title = title;
  }
  if (f.description !== undefined && f.description.length > LIMITS.description) {
    invalid("description", "الوصف أطول من المسموح.", "The description is too long.");
  }
  if (f.assignee_id !== undefined && f.assignee_id !== null && !project.member_ids.includes(f.assignee_id)) {
    invalid("assignee_id", "المسؤول عن المهمة ليس من أعضاء المشروع.", "The assignee is not a member of the project.");
  }
  if (f.due && f.start && f.due < f.start) invalid("due", "موعد التسليم قبل تاريخ البدء.", "The due date is before the start date.");
  if (f.sprint_id !== undefined && f.sprint_id !== null && !data().sprints.some((s) => s.id === f.sprint_id && s.project_id === project.id)) {
    invalid("sprint_id", "الدورة ليست من هذا المشروع.", "The sprint is not in this project.");
  }
}

const touch = (task: Task) => {
  task.updated_at = nowIso();
};

export const mockApi: Api = {
  async login(identifier, password) {
    const id = identifier.trim().toLowerCase();
    const user = data().users.find((u) => u.email === id || u.phone === id);
    if (!user || password !== DEMO_PASSWORD) return fail(422, "VALIDATION", "البريد أو كلمة المرور غير صحيحة.", "Wrong email or password.");
    if (!user.active) return fail(403, "FORBIDDEN", "تم إيقاف هذا الحساب.", "This account is stopped.");
    return wait({ token: `demo-${user.id}`, user });
  },

  async me() {
    return wait(currentUser());
  },

  async users() {
    currentUser();
    return wait(data().users);
  },

  async projects() {
    const user = currentUser();
    const day = today();
    const list = data()
      .projects.filter((p) => canSeeProject(user, p))
      .map((p) => {
        const c = countTasks(p, data().tasks.filter((t) => t.project_id === p.id), day);
        return { ...p, tasks_total: c.total, tasks_done: c.done, tasks_late: c.late, tasks_blocked: c.blocked };
      });
    return wait(list);
  },

  async project(id) {
    return wait(projectFor(currentUser(), id));
  },

  async tasks(projectId) {
    projectFor(currentUser(), projectId);
    return wait(data().tasks.filter((t) => t.project_id === projectId));
  },

  async sprints(projectId) {
    projectFor(currentUser(), projectId);
    const day = today();
    return wait(data().sprints.filter((s) => s.project_id === projectId).map((s) => ({ ...s, planned_ratio: plannedRatio(s.start, s.end, day) })));
  },

  async task(id) {
    return wait(taskFor(currentUser(), id).task);
  },

  async createTask(projectId, input) {
    const user = currentUser();
    const project = projectFor(user, projectId);
    if (!canManageTasks(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك إضافة مهام في هذا المشروع.", "You can't add tasks to this project.");
    const fields = { ...input };
    checkFields(project, fields);
    const status = input.status ?? project.statuses[0].key;
    const target = statusOf(project, status);
    if (!target) return invalid("status", "حالة غير معروفة في هذا المشروع.", "Unknown status for this project.");
    if (target.tone === "blocked" || target.tone === "done") return invalid("status", "ابدأ المهمة بحالة أخرى.", "Start the task in another status.");
    const db = data();
    const id = ++db.seq.task;
    const task: Task = {
      id,
      code: `TSK-${String(1000 + id)}`,
      project_id: project.id,
      title: fields.title!,
      description: fields.description?.trim() ?? "",
      assignee_id: fields.assignee_id,
      priority: fields.priority,
      due: fields.due || undefined,
      start: fields.start || undefined,
      sprint_id: project.uses_sprints ? fields.sprint_id : undefined,
      status,
      subtasks_done: 0,
      subtasks_total: 0,
      created_by: user.id,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.tasks.push(task);
    log({ task_id: id, actor_id: user.id, kind: "created" });
    commit();
    return wait(task);
  },

  async updateTask(id, patch) {
    const user = currentUser();
    const { task, project } = taskFor(user, id);
    if (!canManageTasks(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك تعديل هذه المهمة.", "You can't edit this task.");
    const p = { ...patch };
    checkFields(project, { ...p, start: p.start ?? task.start, due: p.due ?? task.due });
    const changes: [keyof TaskPatch & keyof Task, TaskEvent["kind"]][] = [
      ["title", "title"],
      ["description", "description"],
      ["assignee_id", "assignee"],
      ["priority", "priority"],
      ["due", "due"],
    ];
    for (const [field, kind] of changes) {
      if (p[field] === undefined) continue;
      const before = task[field];
      const raw = field === "title" ? String(p.title).trim() : p[field];
      // null (unassigned) and "" (no due day) are stored as "nothing".
      const after = raw === null || raw === "" ? undefined : raw;
      if (before === after) continue;
      log({
        task_id: id,
        actor_id: user.id,
        kind,
        // Long texts are not copied into the history, only that they changed.
        from: kind === "description" ? undefined : before === undefined ? undefined : String(before),
        to: kind === "description" ? undefined : after === undefined ? undefined : String(after),
        note: kind === "due" ? p.due_note?.trim() || undefined : undefined,
      });
      (task as unknown as Record<string, unknown>)[field] = after;
    }
    if (p.start !== undefined) task.start = p.start || undefined;
    if (p.sprint_id !== undefined && project.uses_sprints) task.sprint_id = p.sprint_id;
    touch(task);
    commit();
    return wait(task);
  },

  async moveTask(id, move) {
    const user = currentUser();
    const { task, project } = taskFor(user, id);
    const reason = move.blocked_reason?.trim();
    if (reason && reason.length > LIMITS.reason) return invalid("blocked_reason", "السبب أطول من المسموح.", "The reason is too long.");
    const plan = planMove(user, project, task, move.status, reason);
    if (plan === "forbidden") return fail(403, "FORBIDDEN", "لا يحق لك تغيير حالة هذه المهمة.", "You can't change this task's status.");
    if (plan === "unknown") return invalid("status", "حالة غير معروفة في هذا المشروع.", "Unknown status for this project.");
    if (plan === "needs_reason") return invalid("blocked_reason", "اكتب سبب توقف المهمة.", "Write why the task is blocked.");
    if (plan === "same") return wait({ task, outcome: "moved" as const });

    if (plan === "request_approval") {
      task.approval = { state: "pending", from: task.status, to: move.status, requested_by: user.id, requested_at: nowIso() };
      log({ task_id: id, actor_id: user.id, kind: "approval_requested", from: task.status, to: move.status });
      touch(task);
      commit();
      return wait({ task, outcome: "approval_requested" as const });
    }

    const from = task.status;
    const target = statusOf(project, move.status)!;
    const leavingBlocked = statusOf(project, from)?.tone === "blocked";
    task.status = move.status;
    if (target.tone === "blocked") {
      task.blocked_reason = reason;
      log({ task_id: id, actor_id: user.id, kind: "blocked", from, to: move.status, note: reason });
    } else {
      task.blocked_reason = undefined;
      log({ task_id: id, actor_id: user.id, kind: leavingBlocked ? "unblocked" : "status", from, to: move.status });
    }
    if (target.tone === "done") {
      // Someone who may approve moved it to done: that is the approval (a pending request is answered too).
      task.approval = {
        state: "approved",
        from: task.approval?.state === "pending" ? task.approval.from : from,
        to: move.status,
        requested_by: task.approval?.state === "pending" ? task.approval.requested_by : user.id,
        requested_at: task.approval?.state === "pending" ? task.approval.requested_at : nowIso(),
        decided_by: user.id,
        decided_at: nowIso(),
      };
      log({ task_id: id, actor_id: user.id, kind: "approved", from, to: move.status });
    } else if (task.approval?.state === "pending") {
      // Moved elsewhere while waiting: the request is no longer current.
      task.approval = undefined;
    }
    touch(task);
    commit();
    return wait({ task, outcome: "moved" as const });
  },

  async decideCompletion(id, decision) {
    const user = currentUser();
    const { task, project } = taskFor(user, id);
    if (!canApprove(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك اعتماد إكمال المهام.", "You can't approve tasks.");
    const a = task.approval;
    if (a?.state !== "pending") return fail(409, "BAD_STATE", "لا يوجد طلب اعتماد لهذه المهمة.", "This task has no approval request.");
    const note = decision.note?.trim();
    if (!decision.approve && !note) return invalid("note", "اكتب سبب الإرجاع ليعرف المسؤول ما المطلوب.", "Write why, so the assignee knows what to fix.");
    if (note && note.length > LIMITS.reason) return invalid("note", "الملاحظة أطول من المسموح.", "The note is too long.");
    a.decided_by = user.id;
    a.decided_at = nowIso();
    a.note = note || undefined;
    if (decision.approve) {
      a.state = "approved";
      log({ task_id: id, actor_id: user.id, kind: "approved", from: task.status, to: a.to, note: a.note });
      task.status = a.to;
      task.blocked_reason = undefined;
    } else {
      // Sent back: the task returns to where it was asked from (the brief: back to review or testing).
      a.state = "rejected";
      log({ task_id: id, actor_id: user.id, kind: "rejected", from: a.to, to: a.from, note });
      task.status = a.from;
    }
    touch(task);
    commit();
    return wait(task);
  },

  async comments(taskId) {
    taskFor(currentUser(), taskId);
    return wait(data().comments.filter((c) => c.task_id === taskId));
  },

  async addComment(taskId, body) {
    const user = currentUser();
    const { task, project } = taskFor(user, taskId);
    if (!canComment(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك التعليق على هذه المهمة.", "You can't comment on this task.");
    const text = body.trim();
    if (!text) return invalid("body", "اكتب التعليق أولاً.", "Write the comment first.");
    if (text.length > LIMITS.comment) return invalid("body", `التعليق أطول من ${LIMITS.comment} حرف.`, `The comment is longer than ${LIMITS.comment} letters.`);
    const db = data();
    const comment = { id: ++db.seq.comment, task_id: taskId, author_id: user.id, body: text, created_at: nowIso() };
    db.comments.push(comment);
    log({ task_id: taskId, actor_id: user.id, kind: "comment" });
    touch(task);
    commit();
    return wait(comment);
  },

  async history(taskId) {
    taskFor(currentUser(), taskId);
    return wait(data().events.filter((e) => e.task_id === taskId));
  },
};
