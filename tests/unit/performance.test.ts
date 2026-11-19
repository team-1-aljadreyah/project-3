// Performance: the counting and the scoring (pure), and the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import type { Project } from "@/features/projects/types";
import { criteriaProblem, personPerf, scoreReview } from "@/features/performance/metrics";
import { canReview } from "@/features/performance/rules";
import type { Criterion, PersonPerf } from "@/features/performance/types";
import type { Task } from "@/features/tasks/types";
import { ApiError } from "@/shared/api/errors";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";
import { today } from "@/shared/lib/utils";

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

const { performanceMock: api } = await import("@/features/performance/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader (team 1), 5–7 employees (team 1), 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const period = { from: "2026-01-01", to: today() };

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

const project = { id: 1, statuses: DEFAULT_STATUSES } as Project;
const t = (over: Partial<Task>): Task =>
  ({ id: 1, code: "T", project_id: 1, title: "", description: "", priority: "low", status: "todo", assignee_id: 5, subtasks_done: 0, subtasks_total: 0, created_at: "2026-11-01T09:00:00Z", updated_at: "2026-11-01T09:00:00Z", ...over }) as Task;

describe("counting", () => {
  it("assigned, done in the period, late, on time and blocked", () => {
    const tasks = [
      t({ status: "completed", due: "2026-11-10", approval: { state: "approved", from: "testing", to: "completed", requested_by: 5, requested_at: "", decided_at: "2026-11-09T10:00:00Z" } }), // on time
      t({ status: "completed", due: "2026-11-05", updated_at: "2026-11-08T10:00:00Z" }), // done late
      t({ status: "in_progress", due: "2026-11-12" }), // open and past due → late
      t({ status: "blocked" }),
      t({ status: "todo", created_at: "2026-12-05T09:00:00Z" }), // made after the period: not counted
      t({ status: "completed", updated_at: "2026-10-20T10:00:00Z" }), // finished before the period: not counted
      t({ status: "todo", assignee_id: 6 }), // someone else's
    ];
    const p = personPerf(5, 1, tasks, [project], { from: "2026-11-01", to: "2026-11-30" }, "2026-11-20");
    expect(p).toMatchObject({ assigned: 4, done: 2, late: 2, blocked: 1, completion: 0.5, on_time: 0.5 });
  });

  it("a review's total: counted criteria from the numbers, the others from 1–5 stars, by weight", () => {
    const criteria: Criterion[] = [
      { id: "a", name: "a", name_en: "a", kind: "auto", metric: "completion", weight: 50 },
      { id: "q", name: "q", name_en: "q", kind: "manual", weight: 50 },
    ];
    const perf = { completion: 0.8, on_time: null, assigned: 5, late: 1 } as PersonPerf;
    expect(scoreReview(criteria, perf, { q: 4 })).toEqual({ scores: { a: 80, q: 80 }, total: 80 });
    expect(scoreReview(criteria, perf, {}).total).toBe(40); // a missing score counts 0 (a draft)
  });

  it("criteria must add up to 100 and can't rest on task numbers alone", () => {
    const auto = (w: number): Criterion => ({ id: "a", name: "a", name_en: "a", kind: "auto", metric: "completion", weight: w });
    expect(criteriaProblem([auto(100)])).toBe("only_auto");
    expect(criteriaProblem([auto(50), { ...auto(40), id: "m", kind: "manual", metric: undefined }])).toBe("sum");
    expect(criteriaProblem([auto(60), { ...auto(40), id: "m", kind: "manual", metric: undefined }])).toBeNull();
  });

  it("who reviews whom: the direct manager, never themselves", () => {
    const projects = [{ pm_id: 2, member_ids: [2, 5] }];
    const sara = { id: 5, role: "employee" as const, team_id: 1 };
    expect(canReview({ id: 4, role: "lead", team_id: 1 }, sara, projects)).toBe(true);
    expect(canReview({ id: 2, role: "pm" }, sara, projects)).toBe(true);
    expect(canReview({ id: 2, role: "pm" }, { id: 7, role: "employee", team_id: 1 }, projects)).toBe(false); // not in his project
    expect(canReview({ id: 5, role: "employee", team_id: 1 }, sara, projects)).toBe(false);
    expect(canReview({ id: 1, role: "ceo" }, { id: 1, role: "ceo" }, projects)).toBe(false);
  });
});

describe("the demo backend", () => {
  it("the team leader writes a draft, Sara can't see it; made final, she sees it and is told", async () => {
    as(4);
    const draft = await api.saveReview({ user_id: 5, period, stars: { quality: 5, teamwork: 4 }, note: "عمل متقن." });
    expect(draft).toMatchObject({ state: "draft", reviewer_id: 4 });
    as(5);
    expect((await api.person(5, period)).reviews.some((r) => r.id === draft.id)).toBe(false);
    as(4);
    const before = getDb().seq.notification;
    await api.finalizeReview(draft.id);
    expect(getDb().notifications.filter((n) => n.id > before && n.kind === "review_final").map((n) => n.user_id)).toEqual([5]);
    as(5);
    expect((await api.person(5, period)).reviews.find((r) => r.id === draft.id)?.state).toBe("final");
    as(4);
    expect((await fails(api.saveReview({ user_id: 5, period, stars: {}, note: "" }, draft.id)))?.status).toBe(409);
  });

  it("a review can't be final with a missing score, or before the criteria are approved", async () => {
    as(4);
    const draft = await api.saveReview({ user_id: 5, period, stars: { quality: 3 }, note: "" });
    expect((await fails(api.finalizeReview(draft.id)))?.errors).toHaveProperty("stars");
    as(1);
    await api.saveCriteria(getDb().criteria.items); // any change clears the approval
    as(4);
    await api.saveReview({ user_id: 5, period, stars: { quality: 3, teamwork: 3 }, note: "" }, draft.id);
    expect((await fails(api.finalizeReview(draft.id)))?.status).toBe(409);
  });

  it("only the CEO sets the criteria; they must make sense", async () => {
    as(2);
    expect((await fails(api.saveCriteria([])))?.status).toBe(403);
    as(1);
    expect((await fails(api.saveCriteria([])))?.errors).toHaveProperty("items");
    const c = await api.saveCriteria(getDb().criteria.items);
    expect(c.approved_at).toBeUndefined();
    expect((await api.approveCriteria()).approved_by).toBe(1);
  });

  it("who sees whom: an employee only themselves; the PM his projects' people; nobody reviews outside their reach", async () => {
    as(5);
    expect((await fails(api.overview(period)))?.status).toBe(403);
    expect((await fails(api.person(6, period)))?.status).toBe(404);
    as(2);
    const list = (await api.overview(period)).people.map((p) => p.user_id).sort();
    expect(list).toEqual([4, 5, 6, 7]);
    as(6);
    expect((await fails(api.saveReview({ user_id: 5, period, stars: {}, note: "" })))?.status).toBe(403);
  });

  it("Sara's past reviews show her trend", async () => {
    as(1);
    const reviews = (await api.person(5, period)).reviews.filter((r) => r.state === "final");
    expect(reviews.map((r) => r.total)).toEqual([80, 66]); // newest first
  });
});
