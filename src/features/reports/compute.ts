// Counting the dashboard and the reports from projects, tasks, people, teams, bugs and sprints. Pure functions (no
// network, no React), tested in tests/unit/reports.test.ts. The demo backend uses them; the real server must give the
// same numbers (docs/backend.md, section 12).
import { bugLateDays, isOpen, type Bug } from "@/features/bugs";
import { countTasks, isDone, keysOfTone, lateDays, plannedRatio, sprintNumbers, type Project, type Sprint } from "@/features/projects";
import type { Task } from "@/features/tasks";
import type { Team, User } from "@/shared/api/types";
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
