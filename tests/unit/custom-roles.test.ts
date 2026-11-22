// Jobs the CEO makes (advanced settings, «Jobs and roles»): the rules (start like a job, never more than it, names,
// limits, history lines), the shared helpers (the name shown everywhere, the menu, what a person may do), and the demo
// backend (the CEO saves them, the admin gives them, a turned-off action answers 403, a role in use can't go).
import { beforeEach, describe, expect, it } from "vitest";
import { ACTIONS, basePages, changedRules, checkRoles, DEFAULT_RULES, diffRules, duplicateRole, LIMITS, newRole, rulesOf } from "@/features/advanced/rules";
import type { AdvancedRules, CustomRole } from "@/features/advanced/types";
import { ApiError } from "@/shared/api/errors";
import { navFor } from "@/shared/lib/access";
import { hiddenNavKeys, roleAllows, roleName } from "@/shared/lib/site";

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

const { advancedMock: api } = await import("@/features/advanced/mock");
const { adminMock } = await import("@/features/admin/mock");
const { bugsMock } = await import("@/features/bugs/mock");
const { projectsMock } = await import("@/features/projects/mock");
const { tasksMock } = await import("@/features/tasks/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

/** «منسق مشاريع»: starts like an employee, without reporting bugs and without the performance page. */
const coordinator = (): CustomRole => {
  const r = newRole("employee", DEFAULT_RULES, { key: "role-coord", name: "منسق مشاريع", name_en: "Project coordinator" });
  return { ...r, actions: r.actions.filter((a) => a !== "report_bugs"), pages: r.pages.filter((p) => p !== "performance") };
};
const withRoles = (roles: CustomRole[]): AdvancedRules => ({ ...DEFAULT_RULES, roles });
/** The CEO saves these roles. */
const saveRoles = async (roles: CustomRole[], how?: "import" | "reset") => {
  as(1);
  return api.save(changedRules(withRoles(roles)), how);
};

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the rules of a custom role", () => {
  it("starts like a job: its column of «who may do what» (never more than it does) and all its pages", () => {
    const r = newRole("employee", DEFAULT_RULES);
    expect(r.base).toBe("employee");
    expect(r.actions.sort()).toEqual(ACTIONS.filter((a) => a.def.includes("employee")).map((a) => a.key).sort());
    expect(r.pages).toEqual(navFor("employee").map((n) => n.key));
    // A job's column the CEO changed is copied too.
    const rules = { permissions: { ...DEFAULT_RULES.permissions, report_bugs: DEFAULT_RULES.permissions.report_bugs.filter((x) => x !== "employee") } };
    expect(newRole("employee", rules).actions).not.toContain("report_bugs");
  });

  it("checks names (required, ≤ 40, unique, not a job's name), the base job, and never more than it", () => {
    const ok = coordinator();
    expect(checkRoles([ok])).toEqual({});
    expect(Object.keys(checkRoles([{ ...ok, name: " " }]))).toEqual(["roles.role-coord.name"]);
    expect(Object.keys(checkRoles([{ ...ok, name_en: "x".repeat(LIMITS.roleName + 1) }]))).toEqual(["roles.role-coord.name_en"]);
    expect(Object.keys(checkRoles([{ ...ok, name: "موظف" }]))).toEqual(["roles.role-coord.name"]);
    expect(Object.keys(checkRoles([ok, { ...ok, key: "role-two", name_en: "Other" }]))).toEqual(["roles.role-two.name"]);
    expect(Object.keys(checkRoles([{ ...ok, base: "admin" as never }]))).toEqual(["roles.role-coord.base"]);
    expect(Object.keys(checkRoles([{ ...ok, actions: [...ok.actions, "create_project"] }]))).toEqual(["roles.role-coord.actions"]);
    expect(Object.keys(checkRoles([{ ...ok, pages: [...ok.pages, "reports"] }]))).toEqual(["roles.role-coord.pages"]);
    const many = Array.from({ length: LIMITS.roles + 1 }, (_, i) => ({ ...ok, key: `role-${i}`, name: `دور ${i}`, name_en: `Role ${i}` }));
    expect(Object.keys(checkRoles(many))).toEqual(["roles"]);
  });

  it("a copy gets a new key and a free name", () => {
    const a = coordinator();
    const b = duplicateRole(a, [a]);
    expect(b.key).not.toBe(a.key);
    expect(b.name).toBe("نسخة من منسق مشاريع");
    expect(b.name_en).toBe("Copy of Project coordinator");
    expect(checkRoles([a, b])).toEqual({});
    expect(duplicateRole(a, [a, b]).name).toBe("نسخة 2 من منسق مشاريع");
  });

  it("the history has one line per role made, changed or removed", () => {
    const a = coordinator();
    expect(diffRules(DEFAULT_RULES, withRoles([a]))).toEqual([{ key: "roles.role-coord", from: null, to: a }]);
    const renamed = { ...a, name: "منسقة مشاريع", actions: [...a.actions].reverse() };
    expect(diffRules(withRoles([a]), withRoles([renamed])).map((c) => c.key)).toEqual(["roles.role-coord"]);
    expect(diffRules(withRoles([a]), withRoles([{ ...a, actions: [...a.actions].reverse() }]))).toEqual([]); // order only
    expect(diffRules(withRoles([a]), DEFAULT_RULES)).toEqual([{ key: "roles.role-coord", from: a, to: null }]);
    expect(rulesOf(changedRules(withRoles([a]))).roles).toEqual([a]);
  });
});

describe("the shared helpers", () => {
  const roles = [coordinator()];

  it("the job's name: the custom role's, else the base job's", () => {
    expect(roleName({ role: "employee", custom_role: "role-coord" }, "ar", roles)).toBe("منسق مشاريع");
    expect(roleName({ role: "employee", custom_role: "role-coord" }, "en", roles)).toBe("Project coordinator");
    expect(roleName({ role: "employee" }, "ar", roles)).toBe("موظف");
    expect(roleName({ role: "employee", custom_role: "gone" }, "en", roles)).toBe("Employee"); // a removed role
  });

  it("the menu hides the pages the role doesn't see; the CEO is never limited", () => {
    const live = { features: DEFAULT_RULES.features, roles };
    expect(hiddenNavKeys(live, { role: "employee", custom_role: "role-coord" })).toEqual(["performance"]);
    expect(hiddenNavKeys(live, { role: "employee" })).toEqual([]);
    expect(roleAllows(live, { role: "employee", custom_role: "role-coord" }, "report_bugs")).toBe(false);
    expect(roleAllows(live, { role: "employee" }, "report_bugs")).toBe(true);
    expect(roleAllows(live, { role: "ceo", custom_role: "role-coord" }, "report_bugs")).toBe(true);
  });
});

describe("the demo backend", () => {
  it("the CEO saves a role; the admin gives it to an account, whose base job becomes the role's", async () => {
    await saveRoles([coordinator()]);
    expect((await api.get()).rules.roles.map((r) => r.name)).toEqual(["منسق مشاريع"]);
    as(8);
    const u = await adminMock.updateUser(7, { custom_role: "role-coord" });
    expect(u).toMatchObject({ role: "employee", custom_role: "role-coord" });
    expect(getDb().audit.at(-1)?.changes).toContainEqual({ field: "custom_role", to: "منسق مشاريع" });
    expect((await fails(adminMock.updateUser(6, { custom_role: "nope" })))?.errors).toHaveProperty("role");
    as(7);
    const live = await api.live();
    expect(live.me).toEqual({ role: "employee", custom_role: "role-coord" });
    expect(live.roles[0].pages).not.toContain("performance");
  });

  it("a turned-off action answers 403 for the role's people only", async () => {
    await saveRoles([coordinator()]);
    as(8);
    await adminMock.updateUser(7, { custom_role: "role-coord" });
    const bug = { title: "زر لا يعمل", description: "", severity: "low" as const, priority: "low" as const };
    as(7);
    const e = await fails(bugsMock.report(1, bug));
    expect(e?.status).toBe(403);
    expect(e?.message).toMatch(/منسق مشاريع/);
    as(6); // an employee without the role still may
    expect((await bugsMock.report(1, bug)).code).toMatch(/^BUG-/);
  });

  it("a role based on a PM or a team leader loses creating projects and moving due dates when unticked", async () => {
    const pmLike = newRole("pm", DEFAULT_RULES, { key: "role-pm", name: "مدير بلا مشاريع", name_en: "PM without projects" });
    const leadLike = newRole("lead", DEFAULT_RULES, { key: "role-lead", name: "قائد بلا مواعيد", name_en: "Lead without dates" });
    await saveRoles([{ ...pmLike, actions: pmLike.actions.filter((a) => a !== "create_project") }, { ...leadLike, actions: leadLike.actions.filter((a) => a !== "change_due") }]);
    as(8);
    await adminMock.updateUser(4, { custom_role: "role-lead" });
    as(4);
    const task = getDb().tasks.find((t) => t.project_id === 1)!;
    expect((await fails(tasksMock.updateTask(task.id, { due: "2027-02-01" })))?.status).toBe(403);
    await tasksMock.updateTask(task.id, { title: "عنوان جديد" }); // other changes still work
    // The PM role: give it to a new PM account.
    as(8);
    const pm = await adminMock.createUser({ name: "نور", email: "noor@demo.test", role: "employee", custom_role: "role-pm", title: "", password: "Start-Pass-1" });
    expect(pm.role).toBe("pm");
    as(pm.id);
    const project = { name: "مشروع", description: "", pm_id: pm.id, start: "2026-12-01", end: "2027-01-01", priority: "low" as const, uses_sprints: false, member_ids: [] };
    expect((await fails(projectsMock.createProject(project as never)))?.status).toBe(403);
  });

  it("a role still given to someone can't be removed; after moving them it can", async () => {
    await saveRoles([coordinator()]);
    as(8);
    await adminMock.updateUser(7, { custom_role: "role-coord" });
    const e = await fails(saveRoles([]));
    expect(e?.status).toBe(409);
    expect(e?.message).toMatch(/منسق مشاريع.*\(1\)/);
    as(8);
    await adminMock.updateUser(7, { custom_role: null });
    expect(getDb().users.find((u) => u.id === 7)!.custom_role).toBeUndefined();
    await saveRoles([]);
    expect((await api.history())[0].changes).toEqual([{ key: "roles.role-coord", from: coordinator(), to: null }]);
  });

  it("a role's base job can't change once it exists", async () => {
    await saveRoles([coordinator()]);
    const e = await fails(saveRoles([{ ...coordinator(), base: "lead", pages: [] }]));
    expect(e?.status).toBe(422);
    expect(Object.keys(e?.errors ?? {})).toEqual(["roles.role-coord.base"]);
  });

  it("reset and import drop roles even in use: their people go back to their base job", async () => {
    await saveRoles([coordinator()]);
    as(8);
    await adminMock.updateUser(7, { custom_role: "role-coord" });
    await saveRoles([], "reset");
    expect(getDb().users.find((u) => u.id === 7)).toMatchObject({ role: "employee" });
    expect(getDb().users.find((u) => u.id === 7)!.custom_role).toBeUndefined();
    expect((await api.get()).rules.roles).toEqual([]);
    await saveRoles([coordinator()], "import");
    expect((await api.history())[0]).toMatchObject({ how: "import", changes: [{ key: "roles.role-coord" }] });
  });

  it("only the CEO saves roles", async () => {
    as(8);
    expect((await fails(api.save(changedRules(withRoles([coordinator()])))))?.status).toBe(403);
    expect(basePages("employee")).not.toContain("advanced");
  });
});
