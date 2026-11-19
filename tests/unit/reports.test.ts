// The dashboard and reports: the counting (pure), the CSV helper, and the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import type { Project } from "@/features/projects/types";
import { projectRow, totals, velocity } from "@/features/reports/compute";
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
