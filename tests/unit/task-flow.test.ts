// The whole task flow on the demo backend, as different people: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";

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

const { mockApi: api } = await import("@/lib/api/mock");
const { setDbForTests, getDb } = await import("@/lib/api/mock/db");
const { seed } = await import("@/lib/api/mock/seed");

const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const idOf = (code: string) => getDb().tasks.find((t) => t.code === code)!.id;
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const kinds = async (taskId: number) => (await api.history(taskId)).map((e) => e.kind);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("moving a task", () => {
  it("the assignee moves their task, and it is logged", async () => {
    as(6);
    const res = await api.moveTask(idOf("TSK-121"), { status: "in_progress" });
    expect(res.outcome).toBe("moved");
    expect(res.task.status).toBe("in_progress");
    expect((await kinds(res.task.id)).at(-1)).toBe("status");
  });

  it("blocking needs a reason, and keeps it", async () => {
    as(6);
    const e = await fails(api.moveTask(idOf("TSK-121"), { status: "blocked" }));
    expect(e?.status).toBe(422);
    expect(e?.errors?.blocked_reason).toBeTruthy();

    const res = await api.moveTask(idOf("TSK-121"), { status: "blocked", blocked_reason: "بانتظار الخادم" });
    expect(res.task.blocked_reason).toBe("بانتظار الخادم");
    const last = (await api.history(res.task.id)).at(-1)!;
    expect(last.kind).toBe("blocked");
    expect(last.note).toBe("بانتظار الخادم");
  });

  it("leaving 'blocked' clears the reason and says so in the history", async () => {
    as(4); // the team leader, TSK-097 is blocked
    const res = await api.moveTask(idOf("TSK-097"), { status: "in_progress" });
    expect(res.task.blocked_reason).toBeUndefined();
    expect((await kinds(res.task.id)).at(-1)).toBe("unblocked");
  });

  it("someone else's task is refused", async () => {
    as(5);
    expect((await fails(api.moveTask(idOf("TSK-121"), { status: "in_progress" })))?.status).toBe(403);
  });
});

describe("completion approval (the brief)", () => {
  it("an employee's 'done' becomes a request; the task stays where it was", async () => {
    as(6);
    const res = await api.moveTask(idOf("TSK-121"), { status: "completed" });
    expect(res.outcome).toBe("approval_requested");
    expect(res.task.status).toBe("new");
    expect(res.task.approval).toMatchObject({ state: "pending", from: "new", to: "completed", requested_by: 6 });
  });

  it("the PM approves: the task is done", async () => {
    as(2);
    const t = await api.decideCompletion(idOf("TSK-099"), { approve: true });
    expect(t.status).toBe("completed");
    expect(t.approval?.state).toBe("approved");
    expect((await kinds(t.id)).at(-1)).toBe("approved");
  });

  it("sending back needs a note, and returns the task to where it was asked from", async () => {
    as(2);
    expect((await fails(api.decideCompletion(idOf("TSK-099"), { approve: false })))?.errors?.note).toBeTruthy();
    const t = await api.decideCompletion(idOf("TSK-099"), { approve: false, note: "أضف اختباراً للتنبيه المتأخر" });
    expect(t.status).toBe("in_review");
    expect(t.approval).toMatchObject({ state: "rejected", note: "أضف اختباراً للتنبيه المتأخر", decided_by: 2 });
  });

  it("an employee can't approve", async () => {
    as(5);
    expect((await fails(api.decideCompletion(idOf("TSK-099"), { approve: true })))?.status).toBe(403);
  });

  it("the PM moving a task to 'done' approves it at once", async () => {
    as(2);
    const res = await api.moveTask(idOf("TSK-104"), { status: "completed" });
    expect(res.outcome).toBe("moved");
    expect(res.task.approval?.state).toBe("approved");
  });
});

describe("creating and editing tasks", () => {
  it("an employee can't add tasks", async () => {
    as(5);
    expect((await fails(api.createTask(1, { title: "x", priority: "low" })))?.status).toBe(403);
  });

  it("checks the fields: a title, and an assignee from the project", async () => {
    as(2);
    expect((await fails(api.createTask(1, { title: "  ", priority: "low" })))?.errors?.title).toBeTruthy();
    expect((await fails(api.createTask(1, { title: "x", priority: "low", assignee_id: 1 })))?.errors?.assignee_id).toBeTruthy();
    expect((await fails(api.createTask(1, { title: "x", priority: "low", status: "completed" })))?.errors?.status).toBeTruthy();
  });

  it("adds a task with a code, in the first column, with its history", async () => {
    as(2);
    const t = await api.createTask(1, { title: "  صفحة الإعدادات  ", priority: "high", assignee_id: 5 });
    expect(t.title).toBe("صفحة الإعدادات");
    expect(t.code).toMatch(/^TSK-\d+$/);
    expect(t.status).toBe("new");
    expect(await kinds(t.id)).toEqual(["created"]);
    expect((await api.tasks(1)).some((x) => x.id === t.id)).toBe(true);
  });

  it("logs a changed due date with its reason, and only what changed", async () => {
    as(2);
    const id = idOf("TSK-118");
    const before = (await api.history(id)).length;
    const t = await api.updateTask(id, { due: "2026-12-01", due_note: "طلب العميل تعديلاً", title: (await api.task(id)).title });
    expect(t.due).toBe("2026-12-01");
    const added = (await api.history(id)).slice(before);
    expect(added.map((e) => e.kind)).toEqual(["due"]);
    expect(added[0].note).toBe("طلب العميل تعديلاً");
  });

  it("unassigns with null", async () => {
    as(2);
    const t = await api.updateTask(idOf("TSK-118"), { assignee_id: null });
    expect(t.assignee_id).toBeUndefined();
  });
});

describe("comments", () => {
  it("M&E can comment; the admin can't; empty is refused", async () => {
    as(3);
    const c = await api.addComment(idOf("TSK-104"), "  متى الموعد الجديد؟ ");
    expect(c.body).toBe("متى الموعد الجديد؟");
    expect((await fails(api.addComment(idOf("TSK-104"), "   ")))?.errors?.body).toBeTruthy();
    as(8);
    expect((await fails(api.addComment(idOf("TSK-104"), "مرحباً")))?.status).toBe(403);
  });

  it("a task in a project you can't see is 'not found'", async () => {
    as(5); // Sara is not in the sales project
    expect((await fails(api.task(idOf("TSK-201"))))?.status).toBe(404);
  });
});
