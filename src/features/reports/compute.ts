// Counting the dashboard and the reports from projects, tasks, people, teams, bugs and sprints. Pure functions (no
// network, no React), tested in tests/unit/reports.test.ts. The demo backend uses them; the real server must give the
// same numbers (docs/backend.md, section 12).
import { bugLateDays, isOpen, type Bug } from "@/features/bugs";
import { countTasks, isDone, keysOfTone, lateDays, plannedRatio, sprintNumbers, type Project, type Sprint } from "@/features/projects";
import type { Task } from "@/features/tasks";
import type { StatusTone, Team, User } from "@/shared/api/types";
import { today as dayFrom, matches } from "@/shared/lib/utils";
import type { BugCounts, Overview, PersonRow, ProjectRow, SprintRow, TeamRow } from "./types";

/** How far behind the plan a project may be before it counts as "behind" (points of progress). */
export const BEHIND_BY = 0.15;

export function projectRow(project: Project, tasks: Task[], today: string): ProjectRow {
  const mine = tasks.filter((t) => t.project_id === project.id);
  const c = countTasks(project, mine, today);
  const planned = plannedRatio(project.start, project.end, today);
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    name_en: project.name_en,
    state: project.state,
    pm_id: project.pm_id,
    start: project.start,
    end: project.end,
    total: c.total,
    done: c.done,
    late: c.late,
    blocked: c.blocked,
    ratio: c.ratio,
    planned_ratio: planned,
    overdue: project.state !== "done" && project.end < today,
    behind: project.state === "active" && c.ratio + BEHIND_BY < planned,
  };
}

export function overview(input: { projects: Project[]; tasks: Task[]; users: User[]; teams: Team[]; bugs: Bug[]; sprints: Sprint[]; today: string }): Overview {
  const { projects, users, teams, today } = input;
  const ids = new Set(projects.map((p) => p.id));
  const tasks = input.tasks.filter((t) => ids.has(t.project_id));
  const projectOf = new Map(projects.map((p) => [p.id, p]));

  // People: everyone with a task in these projects, with their tasks counted by state.
  const byPerson = new Map<number, PersonRow>();
  for (const t of tasks) {
    if (!t.assignee_id) continue;
    const p = projectOf.get(t.project_id)!;
    const row = byPerson.get(t.assignee_id) ?? {
      user_id: t.assignee_id,
      team_id: users.find((u) => u.id === t.assignee_id)?.team_id,
      open: 0,
      done: 0,
      late: 0,
      blocked: 0,
      in_review: 0,
    };
    if (isDone(p, t)) row.done++;
    else row.open++;
    if (lateDays(p, t, today) > 0) row.late++;
    if (keysOfTone(p, "blocked").has(t.status)) row.blocked++;
    if (keysOfTone(p, "review").has(t.status)) row.in_review++;
    byPerson.set(t.assignee_id, row);
  }
  const people = [...byPerson.values()].sort((a, b) => b.late - a.late || b.open - a.open);

  const teamRows: TeamRow[] = teams
    .map((team) => {
      const rows = people.filter((r) => r.team_id === team.id);
      const done = rows.reduce((s, r) => s + r.done, 0);
      const open = rows.reduce((s, r) => s + r.open, 0);
      return {
        team_id: team.id,
        name: team.name,
        name_en: team.name_en,
        members: users.filter((u) => u.active && u.team_id === team.id).length,
        open,
        done,
        late: rows.reduce((s, r) => s + r.late, 0),
        ratio: done + open ? done / (done + open) : 0,
      };
    })
    .filter((t) => t.open + t.done > 0);

  const sprints: SprintRow[] = input.sprints
    .filter((s) => ids.has(s.project_id))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const n = sprintNumbers(projectOf.get(s.project_id)!, s, tasks);
      return { project_id: s.project_id, sprint_id: s.id, name: s.name, start: s.start, end: s.end, closed: !!s.closed_at, planned: n.planned, done: n.done, left: n.left };
    });

  const bugs = input.bugs.filter((b) => ids.has(b.project_id));
  const bugCounts: BugCounts = {
    open: bugs.filter(isOpen).length,
    late: bugs.filter((b) => bugLateDays(b, today) > 0).length,
    closed: bugs.filter((b) => !isOpen(b)).length,
    critical_open: bugs.filter((b) => isOpen(b) && b.severity === "critical").length,
  };

  return { today, projects: projects.map((p) => projectRow(p, tasks, today)), people, teams: teamRows, sprints, bugs: bugCounts };
}

/** Velocity: tasks done per ended sprint, on average over the last `last` ended sprints (0 when none ended yet). */
export function velocity(rows: SprintRow[], last = 3) {
  const ended = rows.filter((r) => r.closed).slice(-last);
  return ended.length ? ended.reduce((s, r) => s + r.done, 0) / ended.length : 0;
}

/** Everything added up for the dashboard's top numbers. */
export function totals(o: Overview) {
  const by = (state: ProjectRow["state"]) => o.projects.filter((p) => p.state === state).length;
  const total = o.projects.reduce((s, p) => s + p.total, 0);
  const done = o.projects.reduce((s, p) => s + p.done, 0);
  return {
    projects: { active: by("active"), done: by("done"), paused: by("paused"), planned: by("planned"), all: o.projects.length },
    tasks: { total, done, left: total - done, late: o.projects.reduce((s, p) => s + p.late, 0), blocked: o.projects.reduce((s, p) => s + p.blocked, 0) },
    ratio: total ? done / total : 0,
    attention: o.projects.filter((p) => p.overdue || p.behind),
  };
}

// ── The department manager's plan: the task calendar and the board over all their projects ──

/** One task as the plan shows it: its project, its status family, how late it is and how far along. */
export interface PlanTask {
  task: Task;
  project: Pick<Project, "id" | "name" | "name_en" | "statuses">;
  tone: StatusTone;
  /** Days past its due day (0 = not late). */
  late: number;
  /** Sub-tasks done out of all of them (0–1). A task with none counts by its status: done = 1, anything else = 0. */
  progress: number;
}

export function planTasks(groups: { project: Project; tasks: Task[] }[], today: string): PlanTask[] {
  return groups.flatMap(({ project, tasks }) =>
    tasks.map((task) => {
      const tone = project.statuses.find((s) => s.key === task.status)?.tone ?? "new";
      const progress = task.subtasks_total ? task.subtasks_done / task.subtasks_total : tone === "done" ? 1 : 0;
      return { task, project, tone, late: lateDays(project, task, today), progress };
    }),
  );
}

export interface CalendarDay {
  date: string;
  isToday: boolean;
  /** Friday or Saturday (the weekend here): drawn hatched. */
  dayOff: boolean;
  /** The tasks due this day that are not done yet. */
  tasks: PlanTask[];
}

/** The calendar strip: from `before` days ago to `after` days ahead. */
export function calendarDays(items: PlanTask[], today: string, before = 3, after = 4): CalendarDay[] {
  const from = new Date(today + "T00:00:00");
  return Array.from({ length: before + after + 1 }, (_, i) => {
    const date = dayFrom(i - before, from);
    const weekday = new Date(date + "T00:00:00").getDay();
    return { date, isToday: date === today, dayOff: weekday === 5 || weekday === 6, tasks: items.filter((t) => t.task.due === date && t.tone !== "done") };
  });
}

export interface CalendarPill {
  item: PlanTask;
  /** The day's column (0 = the first day shown) and how many columns the pill may use. */
  col: number;
  span: number;
  row: number;
}

/**
 * Where each pill of the calendar goes. A pill starts in its day's column and may run over the next one (a title needs
 * the room), so it takes the first row that is free there. Days with more tasks than rows say how many are left out.
 */
export function calendarPills(days: CalendarDay[], span = 2, maxRows = 4): { pills: CalendarPill[]; rows: number; more: number[] } {
  const freeFrom: number[] = [];
  const pills: CalendarPill[] = [];
  const more = days.map(() => 0);
  days.forEach((d, col) => {
    for (const item of d.tasks) {
      let row = freeFrom.findIndex((c) => c <= col);
      if (row < 0) row = freeFrom.length;
      if (row >= maxRows) {
        more[col]++;
        continue;
      }
      const width = Math.min(span, days.length - col);
      freeFrom[row] = col + width;
      pills.push({ item, col, span: width, row });
    }
  });
  return { pills, rows: Math.max(2, freeFrom.length), more };
}

/** The board's four columns, by status family. */
export const PLAN_COLUMNS = ["todo", "doing", "review", "done"] as const;
export type PlanColumn = (typeof PLAN_COLUMNS)[number];
const COLUMN_OF: Record<StatusTone, PlanColumn> = { new: "todo", todo: "todo", progress: "doing", testing: "doing", blocked: "doing", review: "review", done: "done" };

/** Every task in its column: the late ones first, then the nearest due day. */
export function planColumns(items: PlanTask[]): Record<PlanColumn, PlanTask[]> {
  const out: Record<PlanColumn, PlanTask[]> = { todo: [], doing: [], review: [], done: [] };
  for (const t of items) out[COLUMN_OF[t.tone]].push(t);
  for (const key of PLAN_COLUMNS) out[key].sort((a, b) => b.late - a.late || (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999"));
  return out;
}

// ── The team leader's slide: how the team's tasks split ──

export interface TeamShares {
  /** Every task of the team's people. `done + doing + review + blocked` add up to it. */
  total: number;
  done: number;
  /** Open, and neither waiting for a review nor blocked. */
  doing: number;
  review: number;
  blocked: number;
  open: number;
  late: number;
}

/** The tasks of one team's people, split four ways, and how many are late. Without a team: everyone in the numbers. */
export function teamShares(o: Pick<Overview, "people">, teamId?: number): TeamShares {
  const rows = o.people.filter((r) => teamId === undefined || r.team_id === teamId);
  const sum = (pick: (r: PersonRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const done = sum((r) => r.done);
  const open = sum((r) => r.open);
  const review = sum((r) => r.in_review);
  const blocked = sum((r) => r.blocked);
  return { total: done + open, done, doing: Math.max(0, open - review - blocked), review, blocked, open, late: sum((r) => r.late) };
}

// ── Monitoring and evaluation: following every project against its plan ──

export type FollowUpFilter = "all" | "behind" | "overdue" | "on-plan";

/** The follow-up list: the projects a filter keeps, searched by name or code, the ones that need a decision first. */
export function followUp(projects: ProjectRow[], filter: FollowUpFilter, query: string): ProjectRow[] {
  const keep = (p: ProjectRow) => (filter === "behind" ? p.behind : filter === "overdue" ? p.overdue : filter === "on-plan" ? !p.behind && !p.overdue : true);
  const needs = (p: ProjectRow) => Number(p.overdue || p.behind);
  return projects
    .filter((p) => keep(p) && matches(query, p.name, p.name_en, p.code))
    .sort((a, b) => needs(b) - needs(a) || b.late - a.late);
}
