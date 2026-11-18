// Project setup on the demo backend, as different people: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
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
const { canChangePm, canCreateProject, canManageProject } = await import("@/features/projects/rules");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const newProject = { name: "  تطبيق الحضور  ", description: "", pm_id: 2, member_ids: [5], start: "2026-12-01", end: "2027-02-01", priority: "medium" as const, uses_sprints: true };
const kinds = async (projectId: number) => (await api.history(projectId)).map((e) => e.kind);

beforeEach(() => {
  store.clear();
  setDbForTests(seed(new Date(2026, 10, 18)));
});

describe("who may set up projects (assumptions, docs/backend.md)", () => {
  const user = (id: number) => getDb().users.find((u) => u.id === id)!;
  it("the CEO and project managers create projects; nobody else", () => {
    expect([1, 2, 3, 4, 5, 8].map((id) => canCreateProject(user(id)))).toEqual([true, true, false, false, false, false]);
  });
  it("a project's PM and the CEO manage it; only the CEO changes the PM", () => {
    const p = getDb().projects[0];
    expect([1, 2, 4, 5].map((id) => canManageProject(user(id), p))).toEqual([true, true, false, false]);
    expect([1, 2].map((id) => canChangePm(user(id)))).toEqual([true, false]);
  });
});

describe("creating a project", () => {
  it("a PM creates one they manage, with the seven base statuses and no phases", async () => {
    as(2);
    const p = await api.createProject({ ...newProject, pm_id: 1 });
    expect(p.pm_id).toBe(2);
    expect(p.name).toBe("تطبيق الحضور");
    expect(p.code).toBe(`PRJ-${p.id}`);
    expect(p.member_ids).toEqual([2, 5]);
    expect(p.statuses.map((s) => s.key)).toEqual(DEFAULT_STATUSES.map((s) => s.key));
    expect(p.phases).toEqual([]);
    expect(await kinds(p.id)).toEqual(["created"]);
  });

  it("an employee can't (403)", async () => {
    as(5);
    expect((await fails(api.createProject(newProject)))?.status).toBe(403);
  });

  it("checks the fields: a name, an end after the start, a real project manager", async () => {
    as(1);
    expect((await fails(api.createProject({ ...newProject, name: " " })))?.errors).toHaveProperty("name");
    expect((await fails(api.createProject({ ...newProject, end: "2026-11-01" })))?.errors).toHaveProperty("end");
    expect((await fails(api.createProject({ ...newProject, pm_id: 5 })))?.errors).toHaveProperty("pm_id");
    expect((await fails(api.createProject({ ...newProject, member_ids: [8] })))?.errors).toHaveProperty("member_ids");
  });
});

describe("changing a project", () => {
  it("only the CEO hands it to another PM; the old PM stays a member, and it is logged", async () => {
    as(2);
    expect((await fails(api.updateProject(1, { pm_id: 1 })))?.errors).toBeUndefined();
    getDb().users.push({ id: 9, name: "رنا", email: "rana@demo.test", role: "pm", title: "مديرة مشاريع", active: true });
    expect((await fails(api.updateProject(1, { pm_id: 9 })))?.status).toBe(403);
    as(1);
    const p = await api.updateProject(1, { pm_id: 9 });
    expect(p.pm_id).toBe(9);
    expect(p.member_ids).toContain(2);
    expect(await kinds(1)).toContain("pm");
  });

  it("someone with open tasks can't be removed; others can, and both are logged", async () => {
    as(2);
    const busy = await fails(api.updateProject(1, { member_ids: [2, 4, 6, 7] }));
    expect(busy?.status).toBe(409);
    await api.updateProject(1, { member_ids: [2, 3, 4, 5, 6, 7] });
    const p = await api.updateProject(1, { member_ids: [2, 4, 5, 6, 7] });
    expect(p.member_ids).not.toContain(3);
    expect((await kinds(1)).slice(-2)).toEqual(["member_added", "member_removed"]);
  });

  it("a changed plan is logged with its reason (an edge case in the brief)", async () => {
    as(2);
    await api.updateProject(1, { end: "2027-01-31", note: "طلب العميل ميزة إضافية" });
    const last = (await api.history(1)).at(-1)!;
    expect(last.kind).toBe("dates");
    expect(last.to).toContain("2027-01-31");
    expect(last.note).toBe("طلب العميل ميزة إضافية");
  });

  it("someone who isn't the PM or the CEO can't change the setup (403)", async () => {
    as(4);
    expect((await fails(api.updateProject(1, { name: "x" })))?.status).toBe(403);
  });
});

describe("statuses", () => {
  const keys = () => getDb().projects[0].statuses;

  it("a new status gets a key from the server; the base ones stay", async () => {
    as(2);
    const p = await api.saveStatuses(1, [...keys(), { name: "بانتظار العميل", name_en: "", tone: "review" }]);
    const added = p.statuses.at(-1)!;
    expect(added.key).toMatch(/^custom_/);
    expect(added.name_en).toBe("بانتظار العميل");
  });

  it("a base status can't be removed or change family (422)", async () => {
    as(2);
    expect((await fails(api.saveStatuses(1, keys().filter((s) => s.key !== "testing"))))?.errors).toHaveProperty("statuses");
    expect((await fails(api.saveStatuses(1, keys().map((s) => (s.key === "testing" ? { ...s, tone: "done" as const } : s)))))?.errors).toHaveProperty("statuses");
  });

  it("a status with tasks in it can't be removed (409)", async () => {
    as(2);
    const p3 = getDb().projects[2];
    const e = await fails(api.saveStatuses(3, p3.statuses.filter((s) => s.key !== "approval")));
    expect(e?.status).toBe(409);
  });

  it("names are unique, and the first column can't be blocked or done", async () => {
    as(2);
    expect((await fails(api.saveStatuses(1, [...keys(), { name: "جديدة", name_en: "x", tone: "new" }])))?.errors).toHaveProperty("statuses");
    const blockedFirst = [...keys()].sort((a) => (a.key === "blocked" ? -1 : 1));
    expect((await fails(api.saveStatuses(1, blockedFirst)))?.errors).toHaveProperty("statuses");
  });
});

describe("phases", () => {
  it("adds and renames phases; a phase with tasks can't be removed (409)", async () => {
    as(2);
    const p = await api.savePhases(1, [{ id: 1, name: "التحليل" }, { id: 2, name: "التطوير" }, { id: 3, name: "الإطلاق" }, { name: "الصيانة" }]);
    expect(p.phases.map((x) => x.name)).toEqual(["التحليل", "التطوير", "الإطلاق", "الصيانة"]);
    expect((await fails(api.savePhases(1, [{ id: 1, name: "التحليل" }, { id: 3, name: "الإطلاق" }])))?.status).toBe(409);
  });

  it("a task can only be in a phase of its own project, and moving it is logged", async () => {
    as(2);
    const bad = await fails(tasksMock.createTask(2, { title: "مهمة", priority: "low", phase_id: 1 }));
    expect(bad?.errors).toHaveProperty("phase_id");
    const task = getDb().tasks.find((t) => t.code === "TSK-118")!;
    await tasksMock.updateTask(task.id, { phase_id: 2 });
    expect((await tasksMock.history(task.id)).at(-1)).toMatchObject({ kind: "phase", from: "1", to: "2" });
  });
});

describe("sprints", () => {
  it("only projects that use sprints have them (409)", async () => {
    as(2);
    expect((await fails(api.createSprint(2, { name: "الدورة 1", start: "2026-12-01", end: "2026-12-14" })))?.status).toBe(409);
  });

  it("sprints of a project can't overlap (422 on start)", async () => {
    as(2);
    const s1 = getDb().sprints[0];
    expect((await fails(api.createSprint(1, { name: "الدورة 5", start: s1.end, end: "2026-12-30" })))?.errors).toHaveProperty("start");
    const ok = await api.createSprint(1, { name: "الدورة 5", start: "2026-12-30", end: "2027-01-12" });
    expect(ok.id).toBeGreaterThan(s1.id);
  });

  it("a sprint with tasks can't be removed (409); an empty one can, and it is logged", async () => {
    as(2);
    expect((await fails(api.deleteSprint(1)))?.status).toBe(409);
    const s = await api.createSprint(1, { name: "الدورة 6", start: "2027-02-01", end: "2027-02-14" });
    await api.deleteSprint(s.id);
    expect((await kinds(1)).slice(-2)).toEqual(["sprint_added", "sprint_removed"]);
  });

  it("an employee can't change sprints (403)", async () => {
    as(5);
    expect((await fails(api.createSprint(1, { name: "x", start: "2027-03-01", end: "2027-03-02" })))?.status).toBe(403);
  });
});

describe("the project's history", () => {
  it("members can read it; someone who can't see the project gets 404", async () => {
    as(5);
    expect((await api.history(1)).length).toBeGreaterThan(0);
    expect((await fails(api.history(2)))?.status).toBe(404);
  });
});
