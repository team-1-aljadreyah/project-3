// Administration, sign-in locking and the audit log on the demo backend, as different people.
import { beforeEach, describe, expect, it } from "vitest";
import { settingsProblem } from "@/features/admin/rules";
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
