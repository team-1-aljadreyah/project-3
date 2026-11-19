// What the system counts for people and teams over a period, and how a review's total is made. Pure functions, tested
// in tests/unit/performance.test.ts. The demo backend uses them; the real server must count the same way
// (docs/backend.md, section 13).
import { isDone, keysOfTone, plannedRatio, type Project } from "@/features/projects";
import type { Task } from "@/features/tasks";
import type { Team, User } from "@/shared/api/types";
import type { BlockedTask, Criterion, Metric, Period, PersonPerf, TeamPerf } from "./types";

/** When a task was finished: its approval's day, else its last change (for a done task). undefined = not done. */
export function doneAt(project: Pick<Project, "statuses">, task: Task) {
  if (!isDone(project, task)) return undefined;
  return (task.approval?.state === "approved" ? task.approval.decided_at : undefined) ?? task.updated_at;
}

/** A person's tasks counted over a period, in the given projects. `today` caps "late" for a period not over yet. */
export function personPerf(userId: number, teamId: number | undefined, tasks: Task[], projects: Project[], period: Period, today: string): PersonPerf {
  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const end = period.to < today ? period.to : today;
  let assigned = 0;
  let done = 0;
  let late = 0;
  let blocked = 0;
  let withDue = 0;
  let onTime = 0;
  for (const t of tasks) {
    const p = projectOf.get(t.project_id);
    if (!p || t.assignee_id !== userId) continue;
    const finished = doneAt(p, t)?.slice(0, 10);
    // Open at some point in the period: made before it ended, and not finished before it started.
    if ((t.created_at ?? "").slice(0, 10) > period.to || (finished && finished < period.from)) continue;
    assigned++;
    if (!finished && keysOfTone(p, "blocked").has(t.status)) blocked++;
    if (finished && finished <= period.to) {
      done++;
      if (t.due) {
        withDue++;
        if (finished <= t.due) onTime++;
        else late++;
      }
    } else if (t.due && t.due < end) {
      late++;
    }
  }
  return { user_id: userId, team_id: teamId, assigned, done, late, blocked, completion: assigned ? done / assigned : 0, on_time: withDue ? onTime / withDue : null };
}

/** A person's blocked tasks now, with the reasons. */
export function blockedTasks(userId: number, tasks: Task[], projects: Project[]): BlockedTask[] {
  const projectOf = new Map(projects.map((p) => [p.id, p]));
  return tasks
    .filter((t) => t.assignee_id === userId && projectOf.has(t.project_id) && keysOfTone(projectOf.get(t.project_id)!, "blocked").has(t.status))
    .map((t) => ({ task_id: t.id, code: t.code, title: t.title, reason: t.blocked_reason, project_id: t.project_id }));
}

/** A team's numbers: its members' counts added up, and where its projects should be by the period's end. */
export function teamPerf(team: Team, users: User[], people: PersonPerf[], projects: Project[], tasks: Task[], period: Period): TeamPerf {
  const rows = people.filter((r) => r.team_id === team.id);
  const memberIds = new Set(users.filter((u) => u.team_id === team.id).map((u) => u.id));
  const teamProjects = projects.filter((p) => tasks.some((t) => t.project_id === p.id && t.assignee_id && memberIds.has(t.assignee_id)));
  const sum = (k: "assigned" | "done" | "late" | "blocked") => rows.reduce((s, r) => s + r[k], 0);
  const assigned = sum("assigned");
  const done = sum("done");
  return {
    team_id: team.id,
    name: team.name,
    name_en: team.name_en,
    members: users.filter((u) => u.active && u.team_id === team.id).length,
    assigned,
    done,
    left: assigned - done,
    late: sum("late"),
    blocked: sum("blocked"),
    completion: assigned ? done / assigned : 0,
    planned: teamProjects.length ? teamProjects.reduce((s, p) => s + plannedRatio(p.start, p.end, period.to), 0) / teamProjects.length : 0,
  };
}

/** A counted measure as a score 0–100. On time with no finished task that had a due day: the completion stands in. */
export function metricScore(metric: Metric, perf: PersonPerf) {
  if (metric === "completion") return Math.round(perf.completion * 100);
  if (metric === "on_time") return Math.round((perf.on_time ?? perf.completion) * 100);
  return perf.assigned ? Math.round((1 - perf.late / perf.assigned) * 100) : 100;
}

/**
 * Every criterion's score (counted ones from `perf`, the others from the reviewer's 1–5 stars × 20) and the weighted
 * total. A manual criterion with no stars yet counts 0, so a draft shows what is missing.
 */
export function scoreReview(criteria: Criterion[], perf: PersonPerf, stars: Record<string, number>) {
  const scores: Record<string, number> = {};
  for (const c of criteria) scores[c.id] = c.kind === "auto" && c.metric ? metricScore(c.metric, perf) : (stars[c.id] ?? 0) * 20;
  const total = Math.round(criteria.reduce((s, c) => s + (scores[c.id] * c.weight) / 100, 0));
  return { scores, total };
}

/** What is wrong with a set of criteria, or null: names, weights adding up to 100, and at least one manual criterion. */
export function criteriaProblem(items: Criterion[]): "empty" | "name" | "weight" | "sum" | "only_auto" | "metric" | null {
  if (!items.length) return "empty";
  if (items.some((c) => !c.name.trim() || !c.name_en.trim())) return "name";
  if (items.some((c) => !Number.isInteger(c.weight) || c.weight <= 0)) return "weight";
  if (items.reduce((s, c) => s + c.weight, 0) !== 100) return "sum";
  if (items.some((c) => c.kind === "auto" && !c.metric)) return "metric";
  // The brief: a review must not rest on task numbers alone.
  if (!items.some((c) => c.kind === "manual")) return "only_auto";
  return null;
}

/** Common periods for the period picker: the last 30 and 90 days, and this year. */
export function presetPeriods(today: string) {
  const back = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  return {
    d30: { from: back(29), to: today },
    d90: { from: back(89), to: today },
    year: { from: `${today.slice(0, 4)}-01-01`, to: today },
  };
}
