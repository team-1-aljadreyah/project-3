// The demo backend for projects, their setup and sprints: the same calls as ./api.ts, with the rules the real server
// must keep (docs/backend.md). Only the demo build loads it (see ./api.ts).
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, projectFor, wait } from "@/mock/helpers";
import { aboutProject, notify } from "@/mock/notify";
import { codeOf } from "@/mock/site";
import type { User } from "@/shared/api/types";
import { canSeeProject } from "@/shared/lib/access";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";
import { today } from "@/shared/lib/utils";
import type { ProjectsApi } from "./api";
import { countTasks, isDone, plannedRatio } from "./counts";
import { canChangePm, canCreateProject, canManageProject, canRemoveTemplate, canUseTemplates, isBaseStatus, PROJECT_LIMITS as L } from "./rules";
import type { Project, ProjectEvent, ProjectInput, ProjectPatch, Sprint, SprintInput } from "./types";

const TONES = new Set(["new", "todo", "progress", "review", "testing", "done", "blocked"]);
const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function log(e: Omit<ProjectEvent, "id" | "at">) {
  const db = getDb();
  db.project_events.push({ ...e, id: ++db.seq.project_event, at: nowIso() });
}

/** The project, if this person may change its setup (403 if they may only see it). */
function manageable(user: User, id: number) {
  const project = projectFor(user, id);
  if (!canManageProject(user, project)) return fail(403, "FORBIDDEN", "لا يحق لك تعديل إعدادات هذا المشروع.", "You can't change this project's setup.");
  return project;
}

/** Tasks of the project that are not done, assigned to `userId`. */
const openTasksOf = (project: Project, userId: number) =>
  getDb().tasks.filter((t) => t.project_id === project.id && t.assignee_id === userId && !isDone(project, t)).length;

/** Checks the fields of a new project or a change. Returns the cleaned name. */
function checkFields(f: Partial<ProjectInput>, current?: Project) {
  const db = getDb();
  if (f.name !== undefined) {
    f.name = f.name.trim();
    if (!f.name) invalid("name", "اكتب اسم المشروع.", "Enter the project's name.");
    if (f.name.length > L.name) invalid("name", "الاسم أطول من المسموح.", "The name is too long.");
  }
  if (f.description !== undefined && f.description.length > L.description) invalid("description", "الوصف أطول من المسموح.", "The description is too long.");
  const start = f.start ?? current?.start;
  const end = f.end ?? current?.end;
  if (f.start !== undefined && !isDay(f.start)) invalid("start", "اختر تاريخ البدء.", "Choose the start date.");
  if (f.end !== undefined && !isDay(f.end)) invalid("end", "اختر التاريخ المتوقع للإنجاز.", "Choose the expected end date.");
  if (start && end && end < start) invalid("end", "تاريخ الإنجاز قبل تاريخ البدء.", "The end date is before the start date.");
  if (f.pm_id !== undefined) {
    const pm = db.users.find((u) => u.id === f.pm_id && u.active);
    if (!pm || pm.role !== "pm") invalid("pm_id", "اختر مدير مشروع.", "Choose a project manager.");
  }
  if (f.member_ids !== undefined) {
    const bad = f.member_ids.some((id) => {
      const u = db.users.find((x) => x.id === id && x.active);
      return !u || u.role === "admin";
    });
    if (bad) invalid("member_ids", "أحد الأعضاء غير موجود أو لا يمكن إضافته.", "A member doesn't exist or can't be added.");
  }
}

const withPm = (ids: number[], pmId: number) => [...new Set([pmId, ...ids])];

export const projectsMock: ProjectsApi = {
  async projects() {
    const user = currentUser();
    const day = today();
    const db = getDb();
    const list = db.projects
      .filter((p) => canSeeProject(user, p))
      .map((p) => {
        const c = countTasks(p, db.tasks.filter((t) => t.project_id === p.id), day);
        return { ...p, tasks_total: c.total, tasks_done: c.done, tasks_late: c.late, tasks_blocked: c.blocked };
      });
    return wait(list);
  },

  async project(id) {
    return wait(projectFor(currentUser(), id));
  },

  async sprints(projectId) {
    projectFor(currentUser(), projectId);
    const day = today();
    return wait(getDb().sprints.filter((s) => s.project_id === projectId).map((s) => ({ ...s, planned_ratio: plannedRatio(s.start, s.end, day) })));
  },

  async createProject(input) {
    const user = currentUser();
    if (!canCreateProject(user)) return fail(403, "FORBIDDEN", "لا يحق لك إنشاء المشاريع.", "You can't create projects.");
    // A project manager creates projects they manage; the CEO picks the manager.
    const fields = { ...input, pm_id: user.role === "pm" ? user.id : input.pm_id };
    if (!fields.start) invalid("start", "اختر تاريخ البدء.", "Choose the start date.");
    if (!fields.end) invalid("end", "اختر التاريخ المتوقع للإنجاز.", "Choose the expected end date.");
    checkFields(fields);
    const db = getDb();
    const id = ++db.seq.project;
    const project: Project = {
      id,
      code: codeOf("project", id),
      name: fields.name,
      name_en: fields.name_en?.trim() || undefined,
      description: fields.description.trim(),
      pm_id: fields.pm_id,
      member_ids: withPm(fields.member_ids, fields.pm_id),
      start: fields.start,
      end: fields.end,
      state: fields.start > today() ? "planned" : "active",
      priority: fields.priority,
      uses_sprints: fields.uses_sprints,
      statuses: structuredClone(DEFAULT_STATUSES),
      phases: [],
    };
    const template = fields.template_id === undefined ? undefined : db.templates.find((t) => t.id === fields.template_id);
    if (fields.template_id !== undefined && !template) invalid("template_id", "القالب غير موجود.", "The template doesn't exist.");
    if (template) {
      // The template's statuses and phases, and its tasks: not assigned, no dates, in the first status (the brief).
      project.statuses = structuredClone(template.statuses);
      project.phases = template.phases.map((name) => ({ id: ++db.seq.phase, name }));
      for (const t of template.tasks) {
        const taskId = ++db.seq.task;
        db.tasks.push({
          id: taskId, code: codeOf("task", 1000 + taskId), project_id: id, title: t.title, description: t.description, priority: t.priority,
          phase_id: project.phases.find((ph) => ph.name === t.phase)?.id, status: project.statuses[0].key,
          subtasks_done: 0, subtasks_total: 0, created_by: user.id, created_at: nowIso(), updated_at: nowIso(),
        });
        db.events.push({ id: ++db.seq.event, task_id: taskId, actor_id: user.id, kind: "created", at: nowIso() });
      }
    }
    db.projects.push(project);
    log({ project_id: id, actor_id: user.id, kind: "created", note: template ? template.name : undefined });
    audit(user.id, "project_created", { type: "project", id, label: project.name }, template ? [{ field: "template", to: template.name }] : undefined);
    notify(project.member_ids, "project_added", { actor_id: user.id, project_id: id, data: aboutProject(project) });
    commit();
    return wait(project);
  },

  async updateProject(id, patch) {
    const user = currentUser();
    const project = manageable(user, id);
    const p: ProjectPatch = { ...patch };
    if (p.pm_id !== undefined && p.pm_id !== project.pm_id && !canChangePm(user)) {
      return fail(403, "FORBIDDEN", "تغيير مدير المشروع من صلاحية المدير التنفيذي.", "Only the CEO can change the project manager.");
    }
    if (p.state !== undefined && !["planned", "active", "paused", "done"].includes(p.state)) invalid("state", "حالة غير معروفة.", "Unknown state.");
    checkFields(p, project);
    const note = p.note?.trim() || undefined;
    if (note && note.length > L.note) invalid("note", "السبب أطول من المسموح.", "The reason is too long.");

    // Members: someone who still has open tasks here can't leave until the tasks are given to someone else.
    const pmId = p.pm_id ?? project.pm_id;
    if (p.member_ids !== undefined) {
      // The current manager always stays a member (after a change of manager too, until a later edit removes them).
      const next = withPm(withPm(p.member_ids, pmId), project.pm_id);
      const leaving = project.member_ids.filter((m) => !next.includes(m));
      const busy = leaving.find((m) => openTasksOf(project, m) > 0);
      if (busy !== undefined) {
        const name = getDb().users.find((u) => u.id === busy)?.name ?? "";
        return fail(409, "BAD_STATE", `لدى ${name} مهام مفتوحة في هذا المشروع. أسندها إلى عضو آخر أولاً.`, `${name} still has open tasks here. Give them to another member first.`);
      }
      for (const m of next.filter((x) => !project.member_ids.includes(x))) {
        log({ project_id: id, actor_id: user.id, kind: "member_added", to: String(m) });
        notify([m], "project_added", { actor_id: user.id, project_id: id, data: aboutProject(project) });
      }
      for (const m of leaving) log({ project_id: id, actor_id: user.id, kind: "member_removed", from: String(m) });
      project.member_ids = next;
    }

    if (p.pm_id !== undefined && p.pm_id !== project.pm_id) {
      // The old manager stays a member, so their tasks and access stay until the CEO changes the members.
      log({ project_id: id, actor_id: user.id, kind: "pm", from: String(project.pm_id), to: String(p.pm_id), note });
      const pmName = (uid: number) => getDb().users.find((u) => u.id === uid)?.name;
      audit(user.id, "project_pm_changed", { type: "project", id, label: project.name }, [{ field: "pm", from: pmName(project.pm_id), to: pmName(p.pm_id) }]);
      // A new manager is an edge case in the brief: the whole team hears it.
      notify(withPm(project.member_ids, p.pm_id), "project_pm", { actor_id: user.id, project_id: id, data: { ...aboutProject(project), pm_id: String(p.pm_id), note } });
      project.member_ids = withPm(project.member_ids, p.pm_id);
      project.pm_id = p.pm_id;
    }

    const newStart = p.start ?? project.start;
    const newEnd = p.end ?? project.end;
    if (newStart !== project.start || newEnd !== project.end) {
      // A plan changed after work started is an edge case in the brief: it is logged with its reason.
      log({ project_id: id, actor_id: user.id, kind: "dates", from: `${project.start} → ${project.end}`, to: `${newStart} → ${newEnd}`, note });
      // So is a changed plan (another edge case), with the new end day and the reason.
      notify(project.member_ids, "project_plan", { actor_id: user.id, project_id: id, data: { ...aboutProject(project), due: newEnd, note } });
      project.start = newStart;
      project.end = newEnd;
    }
    if (p.state !== undefined && p.state !== project.state) {
      log({ project_id: id, actor_id: user.id, kind: "state", from: project.state, to: p.state, note });
      project.state = p.state;
    }

    const details: string[] = [];
    if (p.name !== undefined && p.name !== project.name) {
      project.name = p.name;
      details.push("name");
    }
    const nameEn = p.name_en === undefined ? project.name_en : p.name_en.trim() || undefined;
    if (nameEn !== project.name_en) {
      project.name_en = nameEn;
      details.push("name_en");
    }
    if (p.description !== undefined && p.description.trim() !== project.description) {
      project.description = p.description.trim();
      details.push("description");
    }
    if (p.priority !== undefined && p.priority !== project.priority) {
      project.priority = p.priority;
      details.push("priority");
    }
    if (p.uses_sprints !== undefined && p.uses_sprints !== project.uses_sprints) {
      project.uses_sprints = p.uses_sprints;
      details.push("uses_sprints");
    }
    if (details.length) log({ project_id: id, actor_id: user.id, kind: "details", to: details.join(","), note });

    commit();
    return wait(project);
  },

  async saveStatuses(id, statuses) {
    const user = currentUser();
    const project = manageable(user, id);
    const db = getDb();
    if (!Array.isArray(statuses) || statuses.length > L.statuses) invalid("statuses", `الحد الأعلى ${L.statuses} حالة.`, `At most ${L.statuses} statuses.`);

    // The base statuses stay, with their names and families (the brief: the same base statuses in every project).
    for (const base of project.statuses.filter((s) => isBaseStatus(s.key))) {
      const kept = statuses.find((s) => s.key === base.key);
      if (!kept || kept.tone !== base.tone) invalid("statuses", "لا يمكن حذف الحالات الأساسية أو تغيير نوعها.", "The base statuses can't be removed or changed.");
    }
    let n = 0;
    const next = statuses.map((s) => {
      if (isBaseStatus(s.key)) return project.statuses.find((b) => b.key === s.key)!;
      const name = s.name.trim();
      if (!name) invalid("statuses", "اكتب اسم كل حالة.", "Name every status.");
      if (name.length > L.statusName) invalid("statuses", "اسم الحالة أطول من المسموح.", "A status name is too long.");
      if (!TONES.has(s.tone)) invalid("statuses", "نوع حالة غير معروف.", "Unknown status family.");
      if (s.key && !project.statuses.some((x) => x.key === s.key)) invalid("statuses", "حالة غير معروفة في هذا المشروع.", "Unknown status for this project.");
      // A new status gets a key that never changes, even if it is renamed later.
      let key = s.key;
      while (!key || (!s.key && project.statuses.some((x) => x.key === key))) key = `custom_${Date.now().toString(36)}_${++n}`;
      return { key, name, name_en: s.name_en.trim() || name, tone: s.tone };
    });
    const names = next.map((s) => s.name);
    if (new Set(names).size !== names.length) invalid("statuses", "يوجد اسمان متطابقان لحالتين.", "Two statuses have the same name.");
    if (next[0].tone === "blocked" || next[0].tone === "done") invalid("statuses", "لا يمكن أن يبدأ اللوح بحالة متوقفة أو مكتملة.", "The board can't start with a blocked or done status.");

    // A status that tasks still use can't be removed.
    for (const old of project.statuses) {
      if (next.some((s) => s.key === old.key)) continue;
      const used = db.tasks.filter((t) => t.project_id === id && t.status === old.key).length;
      if (used) return fail(409, "BAD_STATE", `الحالة «${old.name}» فيها ${used} مهمة. انقلها أولاً.`, `"${old.name_en}" still has ${used} task(s). Move them first.`);
    }
    const before = project.statuses.map((s) => s.name).join("، ");
    project.statuses = next;
    log({ project_id: id, actor_id: user.id, kind: "statuses", from: before, to: next.map((s) => s.name).join("، ") });
    commit();
    return wait(project);
  },

  async savePhases(id, phases) {
    const user = currentUser();
    const project = manageable(user, id);
    const db = getDb();
    if (!Array.isArray(phases) || phases.length > L.phases) invalid("phases", `الحد الأعلى ${L.phases} مرحلة.`, `At most ${L.phases} phases.`);
    const next = phases.map((ph) => {
      const name = ph.name.trim();
      if (!name) invalid("phases", "اكتب اسم كل مرحلة.", "Name every phase.");
      if (name.length > L.phaseName) invalid("phases", "اسم المرحلة أطول من المسموح.", "A phase name is too long.");
      if (ph.id !== undefined && !project.phases.some((x) => x.id === ph.id)) invalid("phases", "مرحلة غير معروفة في هذا المشروع.", "Unknown phase for this project.");
      return { id: ph.id ?? ++db.seq.phase, name };
    });
    if (new Set(next.map((x) => x.name)).size !== next.length) invalid("phases", "يوجد اسمان متطابقان لمرحلتين.", "Two phases have the same name.");
    for (const old of project.phases) {
      if (next.some((x) => x.id === old.id)) continue;
      const used = db.tasks.filter((t) => t.project_id === id && t.phase_id === old.id).length;
      if (used) return fail(409, "BAD_STATE", `المرحلة «${old.name}» فيها ${used} مهمة. انقلها أولاً.`, `Phase "${old.name}" still has ${used} task(s). Move them first.`);
    }
    const before = project.phases.map((x) => x.name).join("، ");
    project.phases = next;
    log({ project_id: id, actor_id: user.id, kind: "phases", from: before || undefined, to: next.map((x) => x.name).join("، ") || undefined });
    commit();
    return wait(project);
  },

  async createSprint(projectId, input) {
    const user = currentUser();
    const project = manageable(user, projectId);
    if (!project.uses_sprints) return fail(409, "BAD_STATE", "هذا المشروع لا يعمل بالدورات.", "This project doesn't use sprints.");
    const db = getDb();
    const s: Sprint = { id: ++db.seq.sprint, project_id: projectId, ...checkSprint(input, projectId), planned_ratio: 0 };
    db.sprints.push(s);
    log({ project_id: projectId, actor_id: user.id, kind: "sprint_added", to: `${s.name}: ${s.start} → ${s.end}` });
    commit();
    return wait({ ...s, planned_ratio: plannedRatio(s.start, s.end, today()) });
  },

  async updateSprint(id, input) {
    const user = currentUser();
    const db = getDb();
    const s = db.sprints.find((x) => x.id === id);
    if (!s) return fail(404, "NOT_FOUND", "لم يُعثر على الدورة.", "Sprint not found.");
    manageable(user, s.project_id);
    if (s.closed_at) return fail(409, "BAD_STATE", "انتهت هذه الدورة ولا يمكن تغييرها.", "This sprint has ended and can't change.");
    const before = `${s.name}: ${s.start} → ${s.end}`;
    Object.assign(s, checkSprint(input, s.project_id, id));
    log({ project_id: s.project_id, actor_id: user.id, kind: "sprint_changed", from: before, to: `${s.name}: ${s.start} → ${s.end}` });
    commit();
    return wait({ ...s, planned_ratio: plannedRatio(s.start, s.end, today()) });
  },

  async deleteSprint(id) {
    const user = currentUser();
    const db = getDb();
    const s = db.sprints.find((x) => x.id === id);
    if (!s) return fail(404, "NOT_FOUND", "لم يُعثر على الدورة.", "Sprint not found.");
    manageable(user, s.project_id);
    if (s.closed_at) return fail(409, "BAD_STATE", "انتهت هذه الدورة ولا يمكن تغييرها.", "This sprint has ended and can't change.");
    const used = db.tasks.filter((t) => t.sprint_id === id).length;
    if (used) return fail(409, "BAD_STATE", `في الدورة ${used} مهمة. انقلها أولاً.`, `The sprint still has ${used} task(s). Move them first.`);
    db.sprints = db.sprints.filter((x) => x.id !== id);
    log({ project_id: s.project_id, actor_id: user.id, kind: "sprint_removed", from: `${s.name}: ${s.start} → ${s.end}` });
    commit();
    return wait(undefined);
  },

  async closeSprint(id, input) {
    const user = currentUser();
    const db = getDb();
    const s = db.sprints.find((x) => x.id === id);
    if (!s) return fail(404, "NOT_FOUND", "لم يُعثر على الدورة.", "Sprint not found.");
    const project = manageable(user, s.project_id);
    if (s.closed_at) return fail(409, "BAD_STATE", "انتهت هذه الدورة ولا يمكن تغييرها.", "This sprint has ended and can't change.");
    if (s.start > today()) return fail(409, "BAD_STATE", "لم تبدأ هذه الدورة بعد.", "This sprint hasn't started yet.");
    const target = input.move_to === null ? undefined : db.sprints.find((x) => x.id === input.move_to);
    if (input.move_to !== null && (!target || target.project_id !== s.project_id || target.id === id || target.closed_at)) {
      invalid("move_to", "اختر دورة مفتوحة أخرى من هذا المشروع، أو قائمة الانتظار.", "Choose another open sprint of this project, or the backlog.");
    }
    // The brief: unfinished tasks need handling. Done tasks stay in the sprint; the rest move on, each with a line in its history.
    const mine = db.tasks.filter((t) => t.sprint_id === id);
    const left = mine.filter((t) => !isDone(project, t));
    for (const t of left) {
      t.sprint_id = target?.id;
      db.events.push({ id: ++db.seq.event, task_id: t.id, actor_id: user.id, kind: "sprint", from: s.name, to: target?.name, at: nowIso() });
    }
    s.closed_at = nowIso();
    s.result = { planned: mine.length, done: mine.length - left.length, moved: left.length, moved_to: target?.id };
    log({
      project_id: s.project_id, actor_id: user.id, kind: "sprint_closed", from: s.name, to: target?.name,
      note: `${s.result.done}/${s.result.planned}`,
    });
    audit(user.id, "sprint_closed", { type: "sprint", id, label: s.name }, [{ field: "moved_to", to: target?.name ?? "backlog" }, { field: "done", to: `${s.result.done}/${s.result.planned}` }]);
    commit();
    return wait({ ...s, planned_ratio: 1 });
  },

  async templates() {
    if (!canUseTemplates(currentUser())) return fail(403, "FORBIDDEN", "القوالب لمن ينشئ المشاريع.", "Templates are for the people who create projects.");
    return wait([...getDb().templates].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async saveTemplate(projectId, input) {
    const user = currentUser();
    const project = manageable(user, projectId);
    if (!canUseTemplates(user)) return fail(403, "FORBIDDEN", "القوالب لمن ينشئ المشاريع.", "Templates are for the people who create projects.");
    const db = getDb();
    const name = input.name.trim();
    if (!name) invalid("name", "اكتب اسم القالب.", "Enter the template's name.");
    if (name.length > L.templateName) invalid("name", "الاسم أطول من المسموح.", "The name is too long.");
    if (db.templates.some((t) => t.name === name)) invalid("name", "يوجد قالب بهذا الاسم.", "A template with this name exists.");
    const tasks = db.tasks.filter((t) => t.project_id === projectId);
    if (tasks.length > L.templateTasks) invalid("name", `القالب يحفظ ${L.templateTasks} مهمة على الأكثر.`, `A template keeps at most ${L.templateTasks} tasks.`);
    const template = {
      id: ++db.seq.template, name, description: input.description?.trim() ?? "", from_project: project.name,
      statuses: structuredClone(project.statuses), phases: project.phases.map((ph) => ph.name), uses_sprints: project.uses_sprints,
      tasks: tasks.map((t) => ({ title: t.title, description: t.description, priority: t.priority, phase: project.phases.find((ph) => ph.id === t.phase_id)?.name })),
      created_by: user.id, created_at: nowIso(),
    };
    db.templates.push(template);
    commit();
    return wait(template);
  },

  async deleteTemplate(id) {
    const user = currentUser();
    const db = getDb();
    const template = db.templates.find((t) => t.id === id);
    if (!template || !canUseTemplates(user)) return fail(404, "NOT_FOUND", "لم يُعثر على القالب.", "Template not found.");
    if (!canRemoveTemplate(user, template)) return fail(403, "FORBIDDEN", "يحذف القالبَ من أنشأه أو المدير التنفيذي.", "Only who made the template, or the CEO, can remove it.");
    db.templates = db.templates.filter((t) => t.id !== id);
    audit(user.id, "template_deleted", { type: "template", id, label: template.name });
    commit();
    return wait(undefined);
  },

  async history(projectId) {
    projectFor(currentUser(), projectId);
    return wait(getDb().project_events.filter((e) => e.project_id === projectId));
  },
};

/** Checks a sprint: a name, real days, start not after end, no overlap with the project's other sprints. */
function checkSprint(input: SprintInput, projectId: number, selfId?: number) {
  const name = input.name.trim();
  if (!name) invalid("name", "اكتب اسم الدورة.", "Enter the sprint's name.");
  if (name.length > L.sprintName) invalid("name", "الاسم أطول من المسموح.", "The name is too long.");
  if (!isDay(input.start)) invalid("start", "اختر تاريخ البدء.", "Choose the start date.");
  if (!isDay(input.end)) invalid("end", "اختر تاريخ الانتهاء.", "Choose the end date.");
  if (input.end < input.start) invalid("end", "تاريخ الانتهاء قبل تاريخ البدء.", "The end date is before the start date.");
  const clash = getDb().sprints.find((s) => s.project_id === projectId && s.id !== selfId && s.start <= input.end && input.start <= s.end);
  if (clash) invalid("start", `تتداخل مع ${clash.name}.`, `Overlaps ${clash.name}.`);
  return { name, start: input.start, end: input.end };
}
