// The dashboard and reports: the counting (pure), the CSV helper, and the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import type { Project } from "@/features/projects/types";
import { calendarDays, calendarPills, followUp, planColumns, planTasks, projectRow, teamShares, totals, velocity } from "@/features/reports/compute";
import type { SprintRow } from "@/features/reports/types";
import type { Task } from "@/features/tasks/types";
import { ApiError } from "@/shared/api/errors";
import { toCsv } from "@/shared/lib/csv";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";

// The demo backend reads the session from localStorage: a small in-memory one for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { reportsMock: api } = await import("@/features/reports/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (projects 1–3), 3 M&E, 4 team leader (projects 1–2), 5 employee, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

const project = (over: Partial<Project> = {}): Project => ({
  id: 1, code: "PRJ-1", name: "P", description: "", pm_id: 2, member_ids: [2], start: "2026-11-01", end: "2026-11-30",
  state: "active", priority: "medium", uses_sprints: false, statuses: DEFAULT_STATUSES, phases: [], ...over,
});
const task = (status: string, due?: string): Task =>
  ({ id: Math.random(), code: "T", project_id: 1, title: "", description: "", priority: "low", status, due, subtasks_done: 0, subtasks_total: 0, updated_at: "" }) as Task;

describe("counting", () => {
  it("a project's progress against the plan: behind when more than 15 points under it; overdue after its end", () => {
    // Nov 1 → Nov 30, on Nov 22: about 72% of the time gone. 1 of 4 done = 25%: behind.
    const row = projectRow(project(), [task("completed"), task("todo", "2026-11-20"), task("todo"), task("blocked")], "2026-11-22");
    expect(row).toMatchObject({ total: 4, done: 1, late: 1, blocked: 1, ratio: 0.25, behind: true, overdue: false });
    expect(row.planned_ratio).toBeCloseTo(21 / 29);
    expect(projectRow(project(), [task("completed")], "2026-12-02")).toMatchObject({ behind: false, overdue: true });
    expect(projectRow(project({ state: "done" }), [], "2026-12-02").overdue).toBe(false);
  });

  it("velocity is the average done of the last 3 ended sprints", () => {
    const s = (done: number, closed: boolean): SprintRow => ({ project_id: 1, sprint_id: done, name: "", start: "", end: "", closed, planned: 10, done, left: 10 - done });
    expect(velocity([s(2, true), s(4, true), s(6, true), s(8, true), s(1, false)])).toBe(6);
    expect(velocity([s(1, false)])).toBe(0);
  });

  it("CSV: quotes what needs it, and never lets a cell become a formula", () => {
    expect(toCsv([["a,b", 'say "hi"', 3], ["=SUM(A1)", "-1", undefined]])).toBe('"a,b","say ""hi""",3\r\n\'=SUM(A1),\'-1,');
    expect(toCsv([[-1, "سارة"]])).toBe("-1,سارة"); // a real number stays a number
  });
});

describe("the project manager's plan", () => {
  // Thursday 19 November 2026: the strip runs from Monday 16 to Monday 23, with Friday 20 and Saturday 21 off.
  const day = "2026-11-19";
  const item = (id: number, status: string, due?: string, sub: [number, number] = [0, 0]) => ({ ...task(status, due), id, subtasks_done: sub[0], subtasks_total: sub[1] });

  it("each task gets its status family, how late it is, and its progress from its sub-tasks", () => {
    const [late, half, done] = planTasks([{ project: project(), tasks: [item(1, "in_progress", "2026-11-17"), item(2, "todo", "2026-11-25", [1, 2]), item(3, "completed", "2026-11-10")] }], day);
    expect([late.tone, late.late, late.progress]).toEqual(["progress", 2, 0]);
    expect([half.tone, half.late, half.progress]).toEqual(["todo", 0, 0.5]);
    expect([done.tone, done.late, done.progress]).toEqual(["done", 0, 1]);
  });

  it("the board: four columns by family, the late tasks first, then the nearest due day", () => {
    const items = planTasks(
      [{ project: project(), tasks: [item(1, "new", "2026-11-25"), item(2, "todo", "2026-11-17"), item(3, "blocked", "2026-11-22"), item(4, "testing"), item(5, "in_review"), item(6, "completed")] }],
      day,
    );
    const columns = planColumns(items);
    expect(columns.todo.map((t) => t.task.id)).toEqual([2, 1]);
    expect(columns.doing.map((t) => t.task.id)).toEqual([3, 4]);
    expect(columns.review.map((t) => t.task.id)).toEqual([5]);
    expect(columns.done.map((t) => t.task.id)).toEqual([6]);
  });

  it("the calendar: eight days around today, the weekend marked, only the tasks that are not done", () => {
    const items = planTasks([{ project: project(), tasks: [item(1, "todo", day), item(2, "completed", day), item(3, "todo", "2026-11-30")] }], day);
    const days = calendarDays(items, day);
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
    expect(days.filter((d) => d.dayOff).map((d) => d.date)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(days.find((d) => d.isToday)?.tasks.map((t) => t.task.id)).toEqual([1]);
  });

  it("the pills: a pill may run over the next day, so the next one takes another row; too many say how many are left out", () => {
    const tasks = [item(1, "todo", "2026-11-17"), item(2, "todo", "2026-11-18"), item(3, "todo", "2026-11-19"), item(4, "todo", "2026-11-19"), item(5, "todo", "2026-11-19"), item(6, "todo", "2026-11-23")];
    const strip = calendarPills(calendarDays(planTasks([{ project: project(), tasks }], day), day), 2, 2);
    const at = (id: number) => strip.pills.find((p) => p.item.task.id === id);
    expect([at(1)?.col, at(1)?.row]).toEqual([1, 0]);
    expect([at(2)?.col, at(2)?.row]).toEqual([2, 1]);
    expect([at(3)?.col, at(3)?.row]).toEqual([3, 0]);
    // Two rows only: the other two tasks of the 19th don't fit.
    expect(strip.more[3]).toBe(2);
    // The last day has one column left.
    expect(at(6)?.span).toBe(1);
  });
});

describe("the team leader's slide", () => {
  const people = [
    { user_id: 5, team_id: 1, open: 4, done: 2, late: 1, blocked: 1, in_review: 1 },
    { user_id: 6, team_id: 1, open: 2, done: 2, late: 0, blocked: 0, in_review: 0 },
    { user_id: 9, team_id: 2, open: 5, done: 0, late: 3, blocked: 0, in_review: 0 },
  ];

  it("one team's tasks split four ways that add up, with the late ones counted", () => {
    const s = teamShares({ people }, 1);
    expect(s).toEqual({ total: 10, done: 4, doing: 4, review: 1, blocked: 1, open: 6, late: 1 });
    expect(s.done + s.doing + s.review + s.blocked).toBe(s.total);
  });

  it("without a team it counts everyone; a team with no tasks is all zeros", () => {
    expect(teamShares({ people }).total).toBe(15);
    expect(teamShares({ people }, 7)).toEqual({ total: 0, done: 0, doing: 0, review: 0, blocked: 0, open: 0, late: 0 });
  });
});

describe("following the projects (monitoring and evaluation)", () => {
  const row = (id: number, name: string, over: Partial<ReturnType<typeof projectRow>> = {}) => ({ ...projectRow(project({ id, code: `PRJ-${id}`, name }), [], "2026-11-10"), behind: false, overdue: false, late: 0, ...over });
  const rows = [row(1, "منصة الحجز"), row(2, "تطبيق المبيعات", { behind: true, late: 1 }), row(3, "حملة الشتاء", { overdue: true, late: 4 })];

  it("the ones that need a decision come first, the most late tasks on top", () => {
    expect(followUp(rows, "all", "").map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it("the filter keeps one kind; the search reads the name and the code", () => {
    expect(followUp(rows, "behind", "").map((p) => p.id)).toEqual([2]);
    expect(followUp(rows, "overdue", "").map((p) => p.id)).toEqual([3]);
    expect(followUp(rows, "on-plan", "").map((p) => p.id)).toEqual([1]);
    expect(followUp(rows, "all", "المبيعات").map((p) => p.id)).toEqual([2]);
    expect(followUp(rows, "all", "prj-3").map((p) => p.id)).toEqual([3]);
    expect(followUp(rows, "on-plan", "المبيعات")).toEqual([]);
  });
});

describe("the demo backend", () => {
  it("the CEO sees every project; the totals add up", async () => {
    as(1);
    const o = await api.overview();
    expect(o.projects.map((p) => p.id).sort()).toEqual([1, 2, 3]);
    const t = totals(o);
    expect(t.tasks.total).toBe(getDb().tasks.length);
    expect(o.bugs.open + o.bugs.closed).toBe(getDb().bugs.length);
    expect(o.people.find((r) => r.user_id === 5)).toMatchObject({ team_id: 1 });
    expect(o.teams.map((x) => x.team_id)).toEqual([1]);
    expect(o.sprints.map((s) => s.name)).toEqual(["الدورة 3", "الدورة 4", "الدورة 5"]);
  });

  it("a team leader counts only the projects they are in", async () => {
    as(4);
    const o = await api.overview();
    expect(o.projects.map((p) => p.id).sort()).toEqual([1, 2]);
    // Ahmed's only task (TSK-302) is in project 3, which the leader can't see: he isn't counted.
    expect(o.people.some((r) => r.user_id === 2)).toBe(false);
  });

  it("employees and the admin can't open the reports (403)", async () => {
    as(5);
    expect((await fails(api.overview()))?.status).toBe(403);
    as(8);
    expect((await fails(api.overview()))?.status).toBe(403);
  });
});
