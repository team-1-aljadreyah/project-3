// Quick search: the demo backend finds only what the person may see, and refuses searches that are too short.
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiError } from "@/shared/api/errors";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { searchMock: api } = await import("@/features/search/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");
const { canSeeProject } = await import("@/shared/lib/access");

const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
  return user;
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("quick search", () => {
  it("finds a task by its code and a project by its name", async () => {
    as(1);
    const r = await api.search("TSK-118");
    expect(r.hits.find((h) => h.kind === "task")).toMatchObject({ code: "TSK-118", title: "تصميم شاشة تسجيل الدخول" });
    expect((await api.search("booking")).hits.some((h) => h.kind === "project" && h.code === "PRJ-1")).toBe(true);
  });

  it("returns only projects, tasks and bugs in projects the person may see", async () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const user = as(id);
      const db = getDb();
      const visible = new Set(db.projects.filter((p) => canSeeProject(user, p)).map((p) => p.id));
      const { hits } = await api.search("ال");
      for (const h of hits) {
        if (h.kind === "project") expect(visible.has(h.id)).toBe(true);
        if (h.kind === "task") expect(visible.has(db.tasks.find((t) => t.id === h.id)!.project_id)).toBe(true);
        if (h.kind === "bug") expect(visible.has(db.bugs.find((b) => b.id === h.id)!.project_id)).toBe(true);
      }
    }
  });

  it("needs at least two letters, and at most 8 results of each kind", async () => {
    as(1);
    expect((await fails(api.search("a")))?.status).toBe(422);
    const { hits } = await api.search("ال");
    for (const kind of ["project", "task", "bug", "announcement", "person"]) expect(hits.filter((h) => h.kind === kind).length).toBeLessThanOrEqual(8);
  });
});
