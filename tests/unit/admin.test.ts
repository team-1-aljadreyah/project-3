// Administration, sign-in locking and the audit log on the demo backend, as different people. Then the counting and the
// drawing maths behind the top of the admin page (pure functions).
import { beforeEach, describe, expect, it } from "vitest";
import { place, scaleSteps, softArea, softLine } from "@/features/admin/curve";
import { settingsProblem } from "@/features/admin/rules";
import { adminOverview, changeRatio, levels, perDay, recentAccounts, weekDays } from "@/features/admin/summary";
import type { AdminUser, AuditAction, AuditEntry } from "@/features/admin/types";
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

const { adminMock: api } = await import("@/features/admin/mock");
const { authMock } = await import("@/features/auth/mock");
const { projectsMock } = await import("@/features/projects/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed, DEMO_PASSWORD } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (projects 1–3), 4 team leader, 5 employee, 8 admin (the only one).
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const lastAudit = () => getDb().audit.at(-1);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("users", () => {
  it("the admin adds a user; email must be valid and free; the audit log has it; the person hears their team", async () => {
    as(8);
    const u = await api.createUser({ name: " ليلى سمير ", email: "Laila@Demo.test", role: "employee", title: "مصممة", team_id: 1 });
    expect(u).toMatchObject({ name: "ليلى سمير", email: "laila@demo.test", active: true, team_id: 1 });
    expect(lastAudit()).toMatchObject({ actor_id: 8, action: "user_created", target: { type: "user", id: u.id } });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: u.id, kind: "team_joined" });
    expect((await fails(api.createUser({ name: "x", email: "laila@demo.test", role: "employee", title: "" })))?.errors).toHaveProperty("email");
    expect((await fails(api.createUser({ name: "x", email: "not-an-email", role: "employee", title: "" })))?.errors).toHaveProperty("email");
  });

  it("guards: not your own role, never zero admins, a PM with open projects keeps the role", async () => {
    as(8);
    expect((await fails(api.updateUser(8, { role: "employee" })))?.status).toBe(409);
    expect((await fails(api.updateUser(8, { active: false })))?.status).toBe(409);
    expect((await fails(api.updateUser(2, { role: "employee" })))?.message).toMatch(/PRJ-1/);
    expect((await fails(api.updateUser(2, { active: false })))?.status).toBe(409);
  });

  it("a stopped account can't sign in; the change is in the audit log with what changed", async () => {
    as(8);
    await api.updateUser(5, { title: "مطورة أولى", active: false });
    const lines = getDb().audit.slice(-2);
    expect(lines[0]).toMatchObject({ action: "user_changed", changes: [{ field: "title", from: "مطورة واجهات", to: "مطورة أولى" }] });
    expect(lines[1]).toMatchObject({ action: "user_stopped" });
    expect((await fails(authMock.login("employee@demo.test", DEMO_PASSWORD)))?.status).toBe(403);
  });

  it("only the admin runs this (403 for the CEO)", async () => {
    as(1);
    expect((await fails(api.users()))?.status).toBe(403);
    expect((await fails(api.saveSettings({ due_soon_days: 2, lock_after: 5, lock_minutes: 15 })))?.status).toBe(403);
  });
});

describe("sign-in locking", () => {
  it("after the set number of wrong passwords the account locks; the admins are told; the admin unlocks it", async () => {
    for (let i = 0; i < 5; i++) await fails(authMock.login("employee@demo.test", "wrong"));
    expect(getDb().audit.filter((e) => e.action === "login_failed")).toHaveLength(5);
    expect(lastAudit()).toMatchObject({ action: "login_locked", target: { id: 5 } });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 8, kind: "account_locked" });
    // Even the right password waits until the lock ends.
    expect((await fails(authMock.login("employee@demo.test", DEMO_PASSWORD)))?.status).toBe(429);
    as(8);
    expect((await api.users()).find((u) => u.id === 5)?.locked_until).toBeTruthy();
    await api.updateUser(5, { unlock: true });
    expect((await authMock.login("employee@demo.test", DEMO_PASSWORD)).user.id).toBe(5);
  });
});

describe("teams and settings", () => {
  it("a new team with a leader: the leader joins it and is told; names are unique; the leader must be a team leader", async () => {
    as(8);
    const t = await api.createTeam({ name: "فريق التصميم", lead_id: 4 });
    expect(getDb().users.find((u) => u.id === 4)?.team_id).toBe(t.id);
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 4, kind: "team_joined" });
    expect((await fails(api.createTeam({ name: "فريق التصميم" })))?.errors).toHaveProperty("name");
    expect((await fails(api.createTeam({ name: "فريق آخر", lead_id: 5 })))?.errors).toHaveProperty("lead_id");
  });

  it("settings stay in range; a change is logged with old and new values", async () => {
    expect(settingsProblem({ due_soon_days: 0, lock_after: 5, lock_minutes: 15 })).toBe("due_soon_days");
    as(8);
    expect((await fails(api.saveSettings({ due_soon_days: 3, lock_after: 50, lock_minutes: 15 })))?.errors).toHaveProperty("lock_after");
    await api.saveSettings({ due_soon_days: 3, lock_after: 5, lock_minutes: 15 });
    expect(lastAudit()).toMatchObject({ action: "settings_changed", changes: [{ field: "due_soon_days", from: "1", to: "3" }] });
  });
});

describe("the audit log", () => {
  it("records important actions from other parts (a new PM); the CEO and admin read it, newest first; filters work", async () => {
    as(8);
    const pm = await api.createUser({ name: "كريم عادل", email: "pm2@demo.test", role: "pm", title: "مدير مشاريع" });
    as(1);
    await projectsMock.updateProject(3, { pm_id: pm.id });
    const log = await api.audit({});
    expect(log[0]).toMatchObject({ actor_id: 1, action: "project_pm_changed", target: { id: 3 }, changes: [{ field: "pm", from: "أحمد كريم", to: "كريم عادل" }] });
    expect((await api.audit({ action: "project_created" })).every((e) => e.action === "project_created")).toBe(true);
    as(5);
    expect((await fails(api.audit({})))?.status).toBe(403);
  });
});

// The top of the admin page. "Now" is fixed (19 November 2026 at noon, local time); `line` writes an audit line `days`
// before it at `hour` o'clock, so the tests give the same answer in every time zone.
const NOW = new Date(2026, 10, 19, 12);
const WEEK = weekDays("2026-11-19");
let lineId = 0;
const line = (days: number, action: AuditAction, target: Partial<AuditEntry["target"]> = {}, hour = 10): AuditEntry => ({
  id: ++lineId,
  actor_id: 8,
  action,
  target: { type: "user", label: "-", ...target },
  at: new Date(2026, 10, 19 - days, hour).toISOString(),
});
const account = (id: number, more: Partial<AdminUser> = {}): AdminUser => ({ id, name: `u${id}`, email: `u${id}@demo.test`, role: "employee", title: "", active: true, failed_logins: 0, ...more });
const newestFirst = (lines: AuditEntry[]) => [...lines].sort((a, b) => b.at.localeCompare(a.at));

describe("the top of the admin page: the counting", () => {
  it("the last 7 days end today, the 7 before them end a week ago, and a month's end is no problem", () => {
    expect(WEEK).toEqual(["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(weekDays("2026-11-19", 7)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(weekDays("2026-12-02")[0]).toBe("2026-11-26");
  });

  it("an audit line counts on its own local day, also late at night and just after midnight", () => {
    const audit = [line(0, "user_changed", {}, 0), line(1, "user_changed", {}, 23), line(1, "login_failed"), line(6, "team_created"), line(7, "settings_changed")];
    expect(perDay(audit, WEEK)).toEqual([1, 0, 0, 0, 0, 2, 1]);
    expect(perDay(audit, weekDays("2026-11-19", 7))).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it("the change against last week is a percent only when last week had lines", () => {
    expect(changeRatio(17, 10)).toBeCloseTo(0.7);
    expect(changeRatio(5, 10)).toBe(-0.5);
    expect(changeRatio(3, 0)).toBeNull();
  });

  it("how many there were on each day is counted back from today, by undoing the later lines", () => {
    // 9 accounts today and one was added yesterday: 8 until then.
    const audit = [line(1, "user_created")];
    expect(levels(9, WEEK, audit, (e) => (e.action === "user_created" ? 1 : 0))).toEqual([8, 8, 8, 8, 8, 9, 9]);
    // Never under zero, even if the log has more lines than there are accounts.
    expect(levels(0, WEEK, audit, () => 1)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("recent accounts: by the newest line about each one (a wrong password is not one), then the newest account first", () => {
    const users = [1, 2, 3, 4].map((id) => account(id));
    const audit = [line(5, "user_changed", { id: 2 }), line(1, "login_locked", { id: 1 }), line(3, "user_changed", { id: 1 }), line(0, "login_failed", { type: "login", id: 3 })];
    const recent = recentAccounts(users, audit);
    expect(recent.map((r) => r.user.id)).toEqual([1, 2, 4, 3]);
    expect(recent[0].at).toBe(audit[1].at);
    expect(recent[2].at).toBeUndefined();
    expect(recentAccounts(users, audit, 2)).toHaveLength(2);
  });

  it("the overview: totals, new this week, stopped and locked, each day's numbers, the newest lines and accounts", () => {
    const users = [
      ...[1, 2, 3, 4, 8, 9].map((id) => account(id)),
      account(5, { locked_until: new Date(2026, 10, 19, 12, 10).toISOString() }), // locked for ten more minutes
      account(6, { locked_until: new Date(2026, 10, 19, 11).toISOString() }), // a lock that ended an hour ago
      account(7, { active: false }),
    ];
    const audit = newestFirst([
      line(0, "user_stopped", { id: 7 }),
      line(1, "user_created", { id: 9 }),
      line(3, "team_created", { type: "team", id: 2 }),
      line(5, "login_failed", { type: "login", id: 5 }),
      line(5, "login_failed", { type: "login", id: 5 }, 11),
      line(8, "settings_changed", { type: "settings" }),
      line(10, "user_changed", { id: 4 }),
      line(10, "project_created", { type: "project", id: 1 }, 9),
      line(20, "user_changed", { id: 3 }),
    ]);
    const o = adminOverview(users, [{ id: 1, name: "a" }, { id: 2, name: "b" }], audit, NOW);
    expect(o.week).toEqual(WEEK);
    expect(o.perDay).toEqual([0, 2, 0, 1, 0, 1, 1]);
    expect(o.perDayBefore).toEqual([0, 0, 0, 2, 0, 1, 0]);
    expect(o.lines).toMatchObject({ week: 5, before: 3 });
    expect(o.lines.ratio).toBeCloseTo(2 / 3);
    expect(o.accounts).toEqual({ total: 9, added: 1, trend: [8, 8, 8, 8, 8, 9, 9] });
    // Active today: 8 of the 9. Yesterday the new account made it 9 (the stop came today); before that it was 8.
    expect(o.active).toEqual({ total: 8, stopped: 1, locked: 1, trend: [8, 8, 8, 8, 8, 9, 8] });
    expect(o.teams).toEqual({ total: 2, added: 1, trend: [1, 1, 1, 2, 2, 2, 2] });
    expect(o.latest.map((e) => e.action)).toEqual(["user_stopped", "user_created", "team_created", "login_failed", "login_failed"]);
    expect(o.people.map((p) => p.user.id)).toEqual([7, 9, 4, 3, 8, 6, 5]);
  });

  it("on the demo backend: stopping an account and making a team show in the numbers at once", async () => {
    as(8);
    await api.updateUser(7, { active: false });
    await api.createTeam({ name: "فريق الجودة" });
    const o = adminOverview(await api.users(), await api.teams(), await api.audit({}));
    expect(o.accounts).toMatchObject({ total: 8, added: 0 });
    expect(o.active).toMatchObject({ total: 7, stopped: 1, locked: 0 });
    expect(o.active.trend.slice(-2)).toEqual([8, 7]);
    expect(o.teams).toMatchObject({ total: 2, added: 1 });
    expect(o.teams.trend.slice(-2)).toEqual([1, 2]);
    expect(o.perDay.at(-1)).toBe(2);
    expect(o.latest).toHaveLength(5);
    expect(o.latest[0]).toMatchObject({ action: "team_created", target: { label: "فريق الجودة" } });
    expect(o.people[0]).toMatchObject({ user: { id: 7, active: false } });
    expect(o.people[0].at).toBeTruthy();
  });
});

describe("the top of the admin page: the drawing maths", () => {
  it("places numbers across the box: from edge to edge, or each in the middle of its column on a given scale", () => {
    expect(place([0, 5, 10])).toEqual([{ x: 0, y: 1 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }]);
    expect(place([3, 3, 3]).map((d) => d.y)).toEqual([0.5, 0.5, 0.5]);
    expect(place([1, 2], { min: 0, max: 4 }, true)).toEqual([{ x: 0.25, y: 0.75 }, { x: 0.75, y: 0.5 }]);
    expect(place([])).toEqual([]);
  });

  it("the soft line leaves and reaches every dot level, so it never shows a number that isn't there", () => {
    // From the floor (0) to the top (10): both handles of the curve are level with the dot beside them.
    expect(softLine(place([0, 10]))).toBe("M0 100 C50 100 50 0 100 0");
    expect(softArea(place([0, 10]))).toBe("M0 100 C50 100 50 0 100 0 L100 100 L0 100 Z");
    expect(softLine([])).toBe("");
    expect(softArea([])).toBe("");
  });

  it("the side scale: whole-number steps, at least four of them, that reach the highest number", () => {
    expect(scaleSteps(0)).toEqual([0, 1, 2, 3, 4]);
    expect(scaleSteps(5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(scaleSteps(7)).toEqual([0, 2, 4, 6, 8]);
    expect(scaleSteps(11)).toEqual([0, 5, 10, 15, 20]);
    expect(scaleSteps(100)).toEqual([0, 20, 40, 60, 80, 100]);
  });
});
