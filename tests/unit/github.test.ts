// The GitHub link: its rules (names, safe links, code mentions) and the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import { isRepoName, mentions, safeGithubUrl } from "@/features/github/rules";
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

const { githubMock: api } = await import("@/features/github/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (projects 1–3), 3 M&E, 5 employee (project 1). GitHub is on for project 1.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const taskId = (code: string) => getDb().tasks.find((t) => t.code === code)!.id;

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("rules", () => {
  it("repository names, safe links and code mentions", () => {
    expect(isRepoName("aljadreyah/booking-web")).toBe(true);
    expect(isRepoName("https://github.com/a/b")).toBe(false);
    expect(isRepoName("a/b.git")).toBe(false);
    expect(safeGithubUrl("https://github.com/a/b/pull/1")).toBe("https://github.com/a/b/pull/1");
    expect(safeGithubUrl("javascript:alert(1)")).toBeNull();
    expect(safeGithubUrl("https://github.com.evil.example/x")).toBeNull();
    expect(safeGithubUrl("http://github.com/a")).toBeNull();
    expect(mentions("Fix TSK-104: board", "TSK-104")).toBe(true);
    expect(mentions("TSK-1040 something", "TSK-104")).toBe(false);
    expect(mentions("XTSK-104", "TSK-104")).toBe(false);
  });
});

describe("the demo backend", () => {
  it("a task shows its PRs and commits from the project's repositories only, newest first", async () => {
    as(5);
    const links = await api.links({ type: "task", id: taskId("TSK-104") });
    expect(links.enabled).toBe(true);
    expect(links.items.map((g) => g.ref)).toEqual(["#41", "9f2a1c3", "1b7e004"]); // not the other company's repo
    const bug = await api.links({ type: "bug", id: 1 });
    expect(bug.items.map((g) => g.kind).sort()).toEqual(["commit", "pr"]);
  });

  it("a project with GitHub off shows nothing", async () => {
    as(2);
    expect(await api.links({ type: "task", id: taskId("TSK-201") })).toEqual({ enabled: false, repos: [], items: [] });
  });

  it("only the PM or the CEO changes the setting; names are checked; on needs a repository", async () => {
    as(5);
    expect((await fails(api.saveSettings(1, { enabled: false, repos: [] })))?.status).toBe(403);
    as(2);
    expect((await fails(api.saveSettings(2, { enabled: true, repos: ["not a repo"] })))?.errors).toHaveProperty("repos");
    expect((await fails(api.saveSettings(2, { enabled: true, repos: [] })))?.errors).toHaveProperty("repos");
    const s = await api.saveSettings(2, { enabled: true, repos: [" aljadreyah/sales-app ", "aljadreyah/sales-app"] });
    expect(s).toEqual({ project_id: 2, enabled: true, repos: ["aljadreyah/sales-app"] });
  });

  it("someone who can't see the project gets 404", async () => {
    as(5);
    expect((await fails(api.links({ type: "task", id: taskId("TSK-301") })))?.status).toBe(404);
  });
});
