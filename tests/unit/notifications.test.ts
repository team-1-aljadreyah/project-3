// Who is told what, on the demo backend: the same rules the real backend must keep (docs/backend.md, section 7).
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";

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

const { notificationsMock: api } = await import("@/features/notifications/mock");
const { tasksMock: tasks } = await import("@/features/tasks/mock");
const { projectsMock: projects } = await import("@/features/projects/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const idOf = (code: string) => getDb().tasks.find((t) => t.code === code)!.id;
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
/** The kinds of the notifications made after the seed, for one person. */
const newFor = (userId: number, after = seedCount) => getDb().notifications.filter((n) => n.user_id === userId && n.id > after).map((n) => n.kind);
let seedCount = 0;

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
  seedCount = getDb().seq.notification;
});

describe("tasks", () => {
  it("the person a task is given to hears it; the one who gave it doesn't", async () => {
    as(2);
    await tasks.createTask(1, { title: "مهمة جديدة", priority: "low", assignee_id: 5 });
    expect(newFor(5)).toEqual(["task_assigned"]);
    expect(newFor(2)).toEqual([]);
    await tasks.updateTask(idOf("TSK-121"), { assignee_id: 7 });
    expect(newFor(7)).toEqual(["task_assigned"]);
  });

  it("a status change reaches the assignee and the PM, not the person who moved it", async () => {
    as(4); // the team leader moves Sara's task
    await tasks.moveTask(idOf("TSK-109"), { status: "in_review" });
    expect(newFor(5)).toEqual(["task_status"]);
    expect(newFor(2)).toEqual(["task_status"]);
    expect(newFor(4)).toEqual([]);
    expect(getDb().notifications.at(-1)!.data).toMatchObject({ task_code: "TSK-109", status: "قيد المراجعة", status_en: "In review" });
  });

  it("an approval request reaches the PM and the team leaders; the decision reaches the person who asked", async () => {
    as(5);
    await tasks.moveTask(idOf("TSK-109"), { status: "completed" });
    expect(newFor(2)).toContain("approval_requested");
    expect(newFor(4)).toContain("approval_requested");
    expect(newFor(1)).toEqual([]); // the CEO isn't asked for every task (an assumption)
    const before = getDb().seq.notification;
    as(2);
    await tasks.decideCompletion(idOf("TSK-109"), { approve: false, note: "أضف صورة الإعلان" });
    expect(newFor(5, before)).toEqual(["approval_decided"]);
    expect(getDb().notifications.at(-1)!.data).toMatchObject({ decision: "rejected", note: "أضف صورة الإعلان" });
  });

  it("a comment reaches the assignee, the PM and earlier commenters, not the writer", async () => {
    as(6);
    await tasks.addComment(idOf("TSK-097"), "وصلت الصلاحية.");
    // TSK-097: assignee 4 (who also commented), PM 2 (who also commented).
    expect(newFor(4)).toEqual(["task_comment"]);
    expect(newFor(2)).toEqual(["task_comment"]);
    expect(newFor(6)).toEqual([]);
  });

  it("a changed due day reaches the assignee", async () => {
    as(2);
    await tasks.updateTask(idOf("TSK-118"), { due: "2027-01-15", due_note: "طلب العميل تأجيلاً" });
    expect(newFor(5)).toEqual(["task_due_changed"]);
  });
});

describe("reminders from the calendar", () => {
  it("a late task reminds its assignee once, when they open their notifications", async () => {
    as(5); // Sara's TSK-109 is 2 days late in the demo data
    const first = await api.notifications();
    expect(first.filter((n) => n.kind === "task_overdue").map((n) => n.data.task_code)).toEqual(["TSK-109"]);
    const again = await api.notifications();
    expect(again.filter((n) => n.kind === "task_overdue")).toHaveLength(1);
  });
});

describe("projects", () => {
  it("a new member hears they were added; the team hears about a changed plan", async () => {
    as(2);
    await projects.updateProject(1, { member_ids: [2, 3, 4, 5, 6, 7] });
    expect(newFor(3)).toEqual(["project_added"]);
    await projects.updateProject(1, { end: "2027-02-01", note: "ميزة إضافية" });
    expect(newFor(5)).toEqual(["project_plan"]);
    expect(newFor(2)).toEqual([]);
  });
});

describe("preferences", () => {
  it("an optional kind can be turned off, and then nothing of that kind arrives", async () => {
    as(5);
    await api.savePrefs({ task_comment: false });
    as(2);
    await tasks.addComment(idOf("TSK-104"), "أحسنتِ.");
    expect(newFor(5)).toEqual([]);
  });

  it("a required kind can't be turned off (422)", async () => {
    as(5);
    expect((await fails(api.savePrefs({ task_assigned: false })))?.errors).toHaveProperty("prefs");
  });
});

describe("reading", () => {
  it("each person sees only their own; marking someone else's as read answers 404", async () => {
    as(2);
    const mine = await api.notifications();
    expect(mine.every((n) => n.user_id === 2)).toBe(true);
    const sarasId = getDb().notifications.find((n) => n.user_id === 5)!.id;
    expect((await fails(api.markRead(sarasId)))?.status).toBe(404);
  });

  it("mark one read, then all", async () => {
    as(2);
    const unread = (await api.notifications()).filter((n) => !n.read);
    await api.markRead(unread[0].id);
    expect((await api.notifications()).filter((n) => !n.read)).toHaveLength(unread.length - 1);
    await api.markAllRead();
    expect((await api.notifications()).some((n) => !n.read)).toBe(false);
  });
});

describe("my tasks", () => {
  it("lists only the tasks assigned to me", async () => {
    as(5);
    const mine = await tasks.myTasks();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.assignee_id === 5)).toBe(true);
  });
});
