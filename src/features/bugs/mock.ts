// The demo backend for the bug tracker, with the rules the real server must keep (docs/backend.md, section 10).
// Only the demo build loads it (see ./api.ts).
import type { Project } from "@/features/projects";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, projectFor, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import type { User } from "@/shared/api/types";
import { canSeeProject } from "@/shared/lib/access";
import type { BugsApi } from "./api";
import { BUG_LIMITS as L, canManageBugs, canReportBug, movesFor, NEXT, SEVERITY_ORDER } from "./rules";
import type { Bug, BugEvent, BugPatch, BugStatus } from "./types";

const PRIORITIES = ["high", "medium", "low"];
const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function bugFor(user: User, id: number): { bug: Bug; project: Project } {
  const db = getDb();
  const bug = db.bugs.find((b) => b.id === id);
  const project = bug && db.projects.find((p) => p.id === bug.project_id);
  // Not found and not allowed answer the same, so nobody learns what exists.
  if (!bug || !project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المشكلة.", "Bug not found.");
  return { bug, project };
}

function log(e: Omit<BugEvent, "id" | "at">) {
  const db = getDb();
  db.bug_events.push({ ...e, id: ++db.seq.bug_event, at: nowIso() });
}

/** The project's PM and team leaders: they hear about new bugs. */
const managersOf = (project: Project) => getDb().users.filter((u) => u.active && canManageBugs(u, project)).map((u) => u.id);

const about = (bug: Bug, actorId: number) => ({ actor_id: actorId, project_id: bug.project_id, bug_id: bug.id, data: { bug_code: bug.code, bug_title: bug.title } });

/** Checks fields of a new bug or a change, against the bug's project. */
function checkFields(project: Project, f: Partial<BugPatch>) {
  const db = getDb();
  if (f.title !== undefined) {
    f.title = f.title.trim();
    if (!f.title) invalid("title", "اكتب عنوان المشكلة.", "Enter the bug's title.");
    if (f.title.length > L.title) invalid("title", "العنوان أطول من المسموح.", "The title is too long.");
  }
  if (f.description !== undefined && f.description.length > L.description) invalid("description", "الوصف أطول من المسموح.", "The description is too long.");
  if (f.severity !== undefined && !SEVERITY_ORDER.includes(f.severity)) invalid("severity", "اختر درجة الخطورة.", "Choose the severity.");
  if (f.priority !== undefined && !PRIORITIES.includes(f.priority)) invalid("priority", "اختر الأولوية.", "Choose the priority.");
  if (f.assignee_id != null && !project.member_ids.includes(f.assignee_id)) invalid("assignee_id", "المطور ليس من أعضاء المشروع.", "The developer is not a project member.");
  if (f.due != null && f.due !== "" && !isDay(f.due)) invalid("due", "اختر يوماً صحيحاً.", "Choose a valid day.");
  if (f.phase_id != null && !project.phases.some((p) => p.id === f.phase_id)) invalid("phase_id", "المرحلة ليست من هذا المشروع.", "The phase is not in this project.");
  if (f.task_id != null && !db.tasks.some((t) => t.id === f.task_id && t.project_id === project.id)) invalid("task_id", "المهمة ليست من هذا المشروع.", "The task is not in this project.");
}

export const bugsMock: BugsApi = {
  async bugs() {
    const user = currentUser();
    const db = getDb();
    const visible = new Set(db.projects.filter((p) => canSeeProject(user, p)).map((p) => p.id));
    return wait(db.bugs.filter((b) => visible.has(b.project_id)));
  },

  async bug(id) {
    return wait(bugFor(currentUser(), id).bug);
  },

  async report(projectId, input) {
    const user = currentUser();
    const project = projectFor(user, projectId);
    if (!canReportBug(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك تسجيل مشكلات في هذا المشروع.", "You can't report bugs in this project.");
    const fields = { ...input };
    if (!fields.severity) invalid("severity", "اختر درجة الخطورة.", "Choose the severity.");
    // Only the managers choose the developer and the day when reporting; for others these are left empty.
    if (!canManageBugs(user, project)) {
      fields.assignee_id = undefined;
      fields.due = undefined;
    }
    checkFields(project, fields);
    const db = getDb();
    const id = ++db.seq.bug;
    const bug: Bug = {
      id,
      code: `BUG-${id}`,
      project_id: project.id,
      phase_id: fields.phase_id || undefined,
      task_id: fields.task_id || undefined,
      title: fields.title,
      description: fields.description.trim(),
      severity: fields.severity,
      priority: fields.priority,
      status: fields.assignee_id ? "assigned" : "reported",
      reported_by: user.id,
      assignee_id: fields.assignee_id || undefined,
      due: fields.due || undefined,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.bugs.push(bug);
    log({ bug_id: id, actor_id: user.id, kind: "created" });
    // The brief: a new bug is announced; the developer hears it was given to them.
    notify(managersOf(project), "bug_reported", about(bug, user.id));
    notify([bug.assignee_id], "bug_assigned", about(bug, user.id));
    commit();
    return wait(bug);
  },

  async update(id, patch) {
    const user = currentUser();
    const { bug, project } = bugFor(user, id);
    if (!canManageBugs(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك تعديل هذه المشكلة.", "You can't edit this bug.");
    const p = { ...patch };
    checkFields(project, p);
    if (p.severity !== undefined && p.severity !== bug.severity) {
      log({ bug_id: id, actor_id: user.id, kind: "severity", from: bug.severity, to: p.severity });
      bug.severity = p.severity;
    }
    if (p.priority !== undefined && p.priority !== bug.priority) {
      log({ bug_id: id, actor_id: user.id, kind: "priority", from: bug.priority, to: p.priority });
      bug.priority = p.priority;
    }
    if (p.due !== undefined && (p.due || undefined) !== bug.due) {
      log({ bug_id: id, actor_id: user.id, kind: "due", from: bug.due, to: p.due || undefined });
      bug.due = p.due || undefined;
    }
    if (p.assignee_id !== undefined && (p.assignee_id ?? undefined) !== bug.assignee_id) {
      log({ bug_id: id, actor_id: user.id, kind: "assignee", from: bug.assignee_id?.toString(), to: p.assignee_id?.toString() });
      bug.assignee_id = p.assignee_id ?? undefined;
      notify([bug.assignee_id], "bug_assigned", about(bug, user.id));
      // Giving a new bug a developer moves it on to "assigned" (the brief's flow).
      if (bug.assignee_id && bug.status === "reported") {
        log({ bug_id: id, actor_id: user.id, kind: "status", from: "reported", to: "assigned" });
        bug.status = "assigned";
      }
    }
    const edited = (["title", "description"] as const).filter((f) => p[f] !== undefined && p[f] !== bug[f]);
    for (const f of edited) bug[f] = p[f]!;
    if (p.phase_id !== undefined) bug.phase_id = p.phase_id ?? undefined;
    if (p.task_id !== undefined) bug.task_id = p.task_id ?? undefined;
    if (edited.length) log({ bug_id: id, actor_id: user.id, kind: "edited", to: edited.join(",") });
    bug.updated_at = nowIso();
    commit();
    return wait(bug);
  },

  async move(id, status, note) {
    const user = currentUser();
    const { bug, project } = bugFor(user, id);
    if (!NEXT[bug.status].some((n) => n.to === status)) return invalid("status", "لا يمكن نقل المشكلة إلى هذه الحالة الآن.", "The bug can't move to this status now.");
    if (!movesFor(user, project, bug).includes(status)) return fail(403, "FORBIDDEN", "لا يحق لك نقل هذه المشكلة إلى هذه الحالة.", "You can't make this move.");
    if (status === "assigned" && !bug.assignee_id) return invalid("assignee_id", "اختر المطور أولاً.", "Choose the developer first.");
    const reason = note?.trim();
    if (status === "reopened" && !reason) return invalid("note", "اكتب لماذا لم تُحل المشكلة.", "Write why it isn't fixed.");
    if (reason && reason.length > L.note) return invalid("note", "السبب أطول من المسموح.", "The reason is too long.");
    const from: BugStatus = bug.status;
    bug.status = status;
    bug.closed_at = status === "closed" ? nowIso() : undefined;
    bug.updated_at = nowIso();
    log({ bug_id: id, actor_id: user.id, kind: "status", from, to: status, note: reason });
    notify([bug.reported_by, bug.assignee_id, project.pm_id], "bug_status", { ...about(bug, user.id), data: { ...about(bug, user.id).data, bug_status: status, note: reason } });
    commit();
    return wait(bug);
  },

  async history(id) {
    bugFor(currentUser(), id);
    return wait(getDb().bug_events.filter((e) => e.bug_id === id));
  },
};
