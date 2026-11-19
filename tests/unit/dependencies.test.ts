// Task dependencies (a task waits for another): the pure rules, and the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import { makesLoop, openDependencies, waitingOn } from "@/features/tasks/rules";
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

const { tasksMock: api } = await import("@/features/tasks/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 2 PM, 4 team leader, 5–7 employees. In project 1, TSK-092 (Zainab's, testing) waits for TSK-109
// (Sara's, in progress); TSK-121 waits for TSK-085 (done).
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const idOf = (code: string) => getDb().tasks.find((t) => t.code === code)!.id;
const task = (code: string) => getDb().tasks.find((t) => t.code === code)!;

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("rules", () => {
  const project = { statuses: DEFAULT_STATUSES };
  const all = [
    { id: 1, status: "completed", depends_on: [] },
    { id: 2, status: "in_progress", depends_on: [1] },
    { id: 3, status: "todo", depends_on: [1, 2] },
  ];

  it("only unfinished tasks hold a task back", () => {
    expect(openDependencies(project, all[2], all).map((t) => t.id)).toEqual([2]);
    expect(openDependencies(project, all[1], all)).toEqual([]);
    expect(waitingOn({ id: 1 }, all).map((t) => t.id)).toEqual([2, 3]);
  });

  it("finds loops through any chain", () => {
    expect(makesLoop(1, [3], all)).toBe(true); // 3 → 2 → 1
    expect(makesLoop(1, [1], all)).toBe(true);
    expect(makesLoop(3, [1], all)).toBe(false);
  });
});

describe("the demo backend", () => {
  it("a task can't be done while it waits; once the other is done, it can, and its assignee is told", async () => {
    as(2);
    expect((await fails(api.moveTask(idOf("TSK-092"), { status: "completed" })))?.message).toMatch(/TSK-109/);
    const before = getDb().seq.notification;
    await api.moveTask(idOf("TSK-109"), { status: "completed" });
    const told = getDb().notifications.filter((n) => n.id > before && n.kind === "dependency_done");
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ user_id: 7, task_id: idOf("TSK-092"), data: { note: "TSK-109" } });
    expect((await api.moveTask(idOf("TSK-092"), { status: "completed" })).task.status).toBe("completed");
  });

  it("an approval request for a waiting task is refused too", async () => {
    as(7); // Zainab, the assignee: asking to mark done becomes a request, still refused
    expect((await fails(api.moveTask(idOf("TSK-092"), { status: "completed" })))?.status).toBe(409);
    expect(task("TSK-092").approval).toBeUndefined();
  });

  it("the PM sets what a task waits for, with history lines; employees can't", async () => {
    as(5);
    expect((await fails(api.setDependencies(idOf("TSK-118"), [idOf("TSK-115")])))?.status).toBe(403);
    as(2);
    await api.setDependencies(idOf("TSK-118"), [idOf("TSK-115"), idOf("TSK-104")]);
    await api.setDependencies(idOf("TSK-118"), [idOf("TSK-104")]);
    expect(task("TSK-118").depends_on).toEqual([idOf("TSK-104")]);
    const lines = (await api.history(idOf("TSK-118"))).filter((e) => e.kind.startsWith("dependency"));
    expect(lines.map((e) => [e.kind, e.to ?? e.from])).toEqual([
      ["dependency_added", "TSK-115"],
      ["dependency_added", "TSK-104"],
      ["dependency_removed", "TSK-115"],
    ]);
  });

  it("refuses itself, another project's task, loops, and too many", async () => {
    as(2);
    const id = idOf("TSK-109");
    expect((await fails(api.setDependencies(id, [id])))?.errors).toHaveProperty("depends_on");
    expect((await fails(api.setDependencies(id, [idOf("TSK-201")])))?.errors).toHaveProperty("depends_on");
    expect((await fails(api.setDependencies(id, [idOf("TSK-092")])))?.errors).toHaveProperty("depends_on"); // 092 waits for 109
    const eleven = getDb().tasks.filter((t) => t.project_id === 1 && t.id !== id && t.code !== "TSK-092").map((t) => t.id);
    expect(eleven.length).toBeGreaterThanOrEqual(8);
    expect((await fails(api.setDependencies(id, [...eleven, 9001, 9002, 9003])))?.errors).toHaveProperty("depends_on");
  });
});
