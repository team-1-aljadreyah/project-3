// The bug tracker on the demo backend, as different people: the same rules the real backend must keep.
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

const { bugsMock: api } = await import("@/features/bugs/mock");
const { movesFor, bugLateDays } = await import("@/features/bugs/rules");
const { notificationsMock } = await import("@/features/notifications/mock");
const { attachmentsMock } = await import("@/features/attachments/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const user = (id: number) => getDb().users.find((u) => u.id === id)!;
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const newFor = (userId: number, after: number) => getDb().notifications.filter((n) => n.user_id === userId && n.id > after).map((n) => n.kind);
const input = { title: "الصفحة لا تُحمّل", description: "", severity: "high" as const, priority: "high" as const };

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("who may move a bug (assumptions, docs/backend.md)", () => {
  const p1 = () => getDb().projects[0];
  it("the developer does the fixing steps; the reporter checks; the managers may do every move", () => {
    const assigned = { status: "assigned" as const, assignee_id: 5, reported_by: 7 };
    const testing = { status: "testing" as const, assignee_id: 5, reported_by: 7 };
    expect(movesFor(user(5), p1(), assigned)).toEqual(["fixing"]);
    expect(movesFor(user(7), p1(), assigned)).toEqual([]);
    expect(movesFor(user(7), p1(), testing)).toEqual(["closed", "reopened"]);
    expect(movesFor(user(5), p1(), testing)).toEqual([]);
    expect(movesFor(user(2), p1(), testing)).toEqual(["closed", "reopened"]);
  });

  it("a closed bug, or one with no expected day, is never late", () => {
    expect(bugLateDays({ status: "fixing", due: "2026-01-01" }, "2026-01-03")).toBe(2);
    expect(bugLateDays({ status: "closed", due: "2026-01-01" }, "2026-01-03")).toBe(0);
    expect(bugLateDays({ status: "fixing", due: undefined }, "2026-01-03")).toBe(0);
  });
});

describe("reporting", () => {
  it("a member reports; the PM and team leaders hear it; a member can't choose the developer", async () => {
    as(5);
    const before = getDb().seq.notification;
    const bug = await api.report(1, { ...input, assignee_id: 6 });
    expect(bug).toMatchObject({ code: `BUG-${bug.id}`, status: "reported", reported_by: 5, assignee_id: undefined });
    expect(newFor(2, before)).toEqual(["bug_reported"]);
    expect(newFor(4, before)).toEqual(["bug_reported"]);
  });

  it("a PM reports with a developer: it starts 'assigned' and the developer is told", async () => {
    as(2);
    const before = getDb().seq.notification;
    const bug = await api.report(1, { ...input, assignee_id: 6, due: "2026-12-01" });
    expect(bug.status).toBe("assigned");
    expect(newFor(6, before)).toEqual(["bug_assigned"]);
  });

  it("refuses the admin (403), an empty title and a task of another project (422)", async () => {
    as(8);
    expect((await fails(api.report(1, input)))?.status).toBe(403);
    as(2);
    expect((await fails(api.report(1, { ...input, title: " " })))?.errors).toHaveProperty("title");
    const otherTask = getDb().tasks.find((t) => t.project_id === 2)!.id;
    expect((await fails(api.report(1, { ...input, task_id: otherTask })))?.errors).toHaveProperty("task_id");
  });
});

describe("the flow", () => {
  it("assigned → fixing → testing → sent back with a reason → fixing; the reporter hears each step", async () => {
    as(2);
    const bug = await api.report(1, { ...input, assignee_id: 5 }); // reported by the PM, given to Sara
    const before = getDb().seq.notification;
    as(5);
    await api.move(bug.id, "fixing");
    await api.move(bug.id, "testing");
    as(2);
    expect((await fails(api.move(bug.id, "reopened")))?.errors).toHaveProperty("note");
    const back = await api.move(bug.id, "reopened", "ما زال الخطأ يظهر");
    expect(back.status).toBe("reopened");
    expect(newFor(5, before)).toContain("bug_status");
    expect(newFor(2, before)).toEqual(["bug_status", "bug_status"]); // fixing and testing, not their own send-back
    const last = (await api.history(bug.id)).at(-1)!;
    expect(last).toMatchObject({ kind: "status", from: "testing", to: "reopened", note: "ما زال الخطأ يظهر" });
  });

  it("refuses a move that isn't next (422) and a person who may not make it (403)", async () => {
    as(2);
    expect((await fails(api.move(4, "closed")))?.errors).toHaveProperty("status"); // BUG-4 is "reported"
    as(7);
    expect((await fails(api.move(1, "testing")))?.status).toBe(403); // BUG-1 is Sara's to fix, not Zainab's
  });

  it("closing sets the closed time; a closed bug can be sent back", async () => {
    as(2);
    const closed = await api.move(2, "closed"); // BUG-2 is in testing
    expect(closed.closed_at).toBeTruthy();
    const again = await api.move(2, "reopened", "عاد الخطأ بعد التحديث");
    expect(again.closed_at).toBeUndefined();
  });

  it("giving a reported bug a developer makes it 'assigned' (managers only)", async () => {
    as(5);
    expect((await fails(api.update(4, { assignee_id: 6 })))?.status).toBe(403);
    as(4);
    const bug = await api.update(4, { assignee_id: 6 });
    expect(bug.status).toBe("assigned");
  });
});

describe("seeing and reminders", () => {
  it("each person sees the bugs of the projects they can see", async () => {
    as(5);
    const codes = (await api.bugs()).map((b) => b.code);
    expect(codes).toContain("BUG-1");
    expect(codes).not.toContain("BUG-6"); // project 2
  });

  it("a late bug reminds its developer once", async () => {
    as(5); // BUG-1: Sara's, expected yesterday, still being fixed
    const first = (await notificationsMock.notifications()).filter((n) => n.kind === "bug_late");
    expect(first.map((n) => n.data.bug_code)).toEqual(["BUG-1"]);
    expect((await notificationsMock.notifications()).filter((n) => n.kind === "bug_late")).toHaveLength(1);
  });

  it("screenshots attached to a bug go into its history", async () => {
    as(7);
    await attachmentsMock.upload({ type: "bug", id: 1 }, new File(["x"], "لقطة.png", { type: "image/png" }));
    expect(getDb().bug_events.at(-1)).toMatchObject({ bug_id: 1, kind: "attachment_added", to: "لقطة.png" });
  });
});

describe("Quick actions: the monitoring officer handles bugs on every project", () => {
  it("she assigns, changes severity, priority and day, and moves a bug a step; each is in its history", async () => {
    as(3);
    const bug = getDb().bugs.find((b) => b.status !== "closed")!;
    const project = getDb().projects.find((p) => p.id === bug.project_id)!;
    // Values that differ from what it has, so each one is a change.
    const dev = project.member_ids.find((id) => user(id).role === "employee" && id !== bug.assignee_id)!;
    const severity = bug.severity === "critical" ? "low" : "critical";
    const priority = bug.priority === "low" ? "high" : "low";
    const changed = await api.update(bug.id, { assignee_id: dev, severity, priority, due: "2026-12-01" });
    expect(changed).toMatchObject({ assignee_id: dev, severity, priority, due: "2026-12-01" });
    const kinds = (await api.history(bug.id)).filter((e) => e.actor_id === 3).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["assignee", "severity", "priority", "due"]));
    expect(movesFor(user(3), project, changed).length).toBeGreaterThan(0);
  });

  it("she sends a bug in testing back with a reason (required), or closes it", async () => {
    as(3);
    const project = getDb().projects[0];
    const dev = project.member_ids.find((id) => user(id).role === "employee")!;
    const bug = await api.report(project.id, { ...input, assignee_id: dev });
    as(dev);
    await api.move(bug.id, "fixing");
    await api.move(bug.id, "testing");
    as(3);
    expect((await fails(api.move(bug.id, "reopened", " ")))?.status).toBe(422);
    expect((await api.move(bug.id, "reopened", "ما زالت الصفحة بيضاء.")).status).toBe("reopened");
  });
});
