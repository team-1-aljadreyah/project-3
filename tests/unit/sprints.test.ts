// Sprints and the Scrum board: the pure rules, and ending a sprint on the demo backend, as different people.
import { beforeEach, describe, expect, it } from "vitest";
import { canCloseSprint, currentSprint, moveTargets, sprintNumbers } from "@/features/projects/sprints";
import type { Sprint } from "@/features/projects/types";
import { ApiError } from "@/shared/api/errors";
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

const { projectsMock: api } = await import("@/features/projects/mock");
const { tasksMock } = await import("@/features/tasks/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (project 1), 4 team leader, 5–7 employees. Project 1's sprints: 1 = "الدورة 4" (runs
// today), 2 = "الدورة 3" (ended), 3 = "الدورة 5" (next). TSK-121 is in the backlog.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const taskId = (code: string) => getDb().tasks.find((t) => t.code === code)!.id;

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

const s = (id: number, start: string, end: string, closed = false): Sprint => ({
  id, project_id: 1, name: `S${id}`, start, end, planned_ratio: 0, closed_at: closed ? `${end}T12:00:00Z` : undefined,
});

describe("rules", () => {
  it("the board opens on the running sprint, else one that ended but isn't closed, else the next, else the last closed", () => {
    const old = s(1, "2026-11-01", "2026-11-10", true);
    const now = s(2, "2026-11-11", "2026-11-24");
    const next = s(3, "2026-11-25", "2026-12-08");
    expect(currentSprint([next, old, now], "2026-11-19")?.id).toBe(2);
    expect(currentSprint([old, s(2, "2026-11-11", "2026-11-15"), next], "2026-11-19")?.id).toBe(2); // overdue, needs ending
    expect(currentSprint([old, next], "2026-11-19")?.id).toBe(3);
    expect(currentSprint([old], "2026-11-19")?.id).toBe(1);
    expect(currentSprint([], "2026-11-19")).toBeUndefined();
  });

  it("a sprint can end once it has started, and only once; tasks move only to other open sprints", () => {
    expect(canCloseSprint(s(1, "2026-11-20", "2026-11-30"), "2026-11-19")).toBe(false);
    expect(canCloseSprint(s(1, "2026-11-10", "2026-11-30"), "2026-11-19")).toBe(true);
    expect(canCloseSprint(s(1, "2026-11-01", "2026-11-10", true), "2026-11-19")).toBe(false);
    const all = [s(1, "2026-11-01", "2026-11-10"), s(2, "2026-12-01", "2026-12-10"), s(3, "2026-11-20", "2026-11-30"), s(4, "2026-10-01", "2026-10-10", true)];
    expect(moveTargets(all, all[0]).map((x) => x.id)).toEqual([3, 2]);
  });

  it("planned, done and left: counted now for an open sprint, kept for an ended one", () => {
    const project = { statuses: DEFAULT_STATUSES };
    const tasks = [{ sprint_id: 1, status: "completed" }, { sprint_id: 1, status: "in_progress" }, { sprint_id: 2, status: "todo" }];
    expect(sprintNumbers(project, s(1, "2026-11-01", "2026-11-30"), tasks)).toEqual({ planned: 2, done: 1, left: 1, ratio: 0.5 });
    const ended = { ...s(2, "2026-11-01", "2026-11-10", true), result: { planned: 5, done: 4, moved: 1 } };
    expect(sprintNumbers(project, ended, tasks)).toMatchObject({ planned: 5, done: 4, left: 1 });
  });
});

describe("ending a sprint", () => {
  it("the PM ends it: unfinished tasks move to the chosen sprint with a history line; done ones stay; numbers kept", async () => {
    as(2);
    const before = getDb().tasks.filter((t) => t.sprint_id === 1);
    const done = before.filter((t) => t.status === "completed").map((t) => t.id);
    const ended = await api.closeSprint(1, { move_to: 3 });
    expect(ended.closed_at).toBeTruthy();
    expect(ended.result).toEqual({ planned: before.length, done: done.length, moved: before.length - done.length, moved_to: 3 });
    expect(getDb().tasks.filter((t) => t.sprint_id === 1).map((t) => t.id).sort()).toEqual(done.sort());
    expect(getDb().tasks.filter((t) => t.sprint_id === 3)).toHaveLength(before.length - done.length);
    const line = (await tasksMock.history(taskId("TSK-104"))).at(-1);
    expect(line).toMatchObject({ kind: "sprint", from: "الدورة 4", to: "الدورة 5", actor_id: 2 });
    expect((await api.history(1)).at(-1)).toMatchObject({ kind: "sprint_closed", from: "الدورة 4", to: "الدورة 5" });
  });

  it("to the backlog: the unfinished tasks leave every sprint", async () => {
    as(2);
    await api.closeSprint(1, { move_to: null });
    expect(getDb().tasks.find((t) => t.code === "TSK-104")!.sprint_id).toBeUndefined();
  });

  it("refused: not a manager (403), twice (409), not started (409), a bad target (422)", async () => {
    as(5);
    expect((await fails(api.closeSprint(1, { move_to: 3 })))?.status).toBe(403);
    as(2);
    expect((await fails(api.closeSprint(3, { move_to: null })))?.status).toBe(409); // starts in the future
    expect((await fails(api.closeSprint(1, { move_to: 2 })))?.errors).toHaveProperty("move_to"); // ended sprint
    expect((await fails(api.closeSprint(1, { move_to: 1 })))?.errors).toHaveProperty("move_to"); // itself
    await api.closeSprint(1, { move_to: 3 });
    expect((await fails(api.closeSprint(1, { move_to: null })))?.status).toBe(409);
  });

  it("an ended sprint can't be changed or removed, and takes no tasks", async () => {
    as(2);
    expect((await fails(api.updateSprint(2, { name: "x", start: "2026-01-01", end: "2026-01-02" })))?.status).toBe(409);
    expect((await fails(api.deleteSprint(2)))?.status).toBe(409);
    expect((await fails(tasksMock.updateTask(taskId("TSK-121"), { sprint_id: 2 })))?.errors).toHaveProperty("sprint_id");
    // A done task in an ended sprint stays there.
    expect((await fails(tasksMock.updateTask(taskId("TSK-085"), { sprint_id: 1 })))?.errors).toHaveProperty("sprint_id");
  });
});

describe("the backlog", () => {
  it("a task goes from the backlog into a sprint and back, each with a history line", async () => {
    as(2);
    const id = taskId("TSK-121");
    await tasksMock.updateTask(id, { sprint_id: 1 });
    expect(getDb().tasks.find((t) => t.id === id)!.sprint_id).toBe(1);
    await tasksMock.updateTask(id, { sprint_id: null });
    expect(getDb().tasks.find((t) => t.id === id)!.sprint_id).toBeUndefined();
    const lines = (await tasksMock.history(id)).filter((e) => e.kind === "sprint");
    expect(lines.map((e) => [e.from, e.to])).toEqual([[undefined, "الدورة 4"], ["الدورة 4", undefined]]);
  });
});
