// Project templates on the demo backend, as different people: save a project as a template, start a project from it.
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

const { projectsMock: api } = await import("@/features/projects/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (projects 1–3), 5 employee. Template 1 "تطبيق جوال" was made by the PM.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const newProject = { name: "تطبيق التوصيل", description: "", pm_id: 2, member_ids: [5], start: "2026-12-01", end: "2027-03-01", priority: "medium" as const, uses_sprints: true };

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("project templates", () => {
  it("the PM saves project 3 (its own statuses, no phases) as a template: structure and tasks, no people or dates", async () => {
    as(2);
    const t = await api.saveTemplate(3, { name: "  حملة تسويق  ", description: "حملة موسمية" });
    const project = getDb().projects.find((p) => p.id === 3)!;
    expect(t).toMatchObject({ name: "حملة تسويق", from_project: project.name, uses_sprints: false, phases: [], created_by: 2 });
    expect(t.statuses.map((s) => s.key)).toEqual(project.statuses.map((s) => s.key));
    expect(t.tasks.map((x) => x.title).sort()).toEqual(getDb().tasks.filter((x) => x.project_id === 3).map((x) => x.title).sort());
    expect(JSON.stringify(t.tasks)).not.toMatch(/assignee|due|start/);
  });

  it("a new project from a template gets its statuses, phases and tasks (no assignee, no dates, first status)", async () => {
    as(1);
    const p = await api.createProject({ ...newProject, template_id: 1 });
    expect(p.phases.map((ph) => ph.name)).toEqual(["التحليل والتصميم", "التطوير", "الإطلاق"]);
    const tasks = getDb().tasks.filter((t) => t.project_id === p.id);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((t) => !t.assignee_id && !t.due && t.status === p.statuses[0].key)).toBe(true);
    const launch = p.phases.find((ph) => ph.name === "الإطلاق")!.id;
    expect(tasks.find((t) => t.title === "النشر في متجري التطبيقات")?.phase_id).toBe(launch);
    // Each copied task has its "created" history line.
    expect(getDb().events.filter((e) => tasks.some((t) => t.id === e.task_id))).toHaveLength(5);
  });

  it("refused: employees (403), an empty or taken name (422), an unknown template (422)", async () => {
    as(5);
    expect((await fails(api.templates()))?.status).toBe(403);
    as(2);
    expect((await fails(api.saveTemplate(1, { name: " " })))?.errors).toHaveProperty("name");
    expect((await fails(api.saveTemplate(1, { name: "تطبيق جوال" })))?.errors).toHaveProperty("name");
    expect((await fails(api.createProject({ ...newProject, template_id: 99 })))?.errors).toHaveProperty("template_id");
  });

  it("removed by who made it or the CEO, not by another PM", async () => {
    as(1);
    const ceoTemplate = await api.saveTemplate(2, { name: "قالب المدير" });
    as(2);
    expect((await fails(api.deleteTemplate(ceoTemplate.id)))?.status).toBe(403);
    await api.deleteTemplate(1);
    as(1);
    await api.deleteTemplate(ceoTemplate.id);
    expect(await api.templates()).toEqual([]);
  });
});
