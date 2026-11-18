// The fake backend's rules are the reference for the real backend, so they are tested too.
import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";
import { authMock } from "@/features/auth/mock";
import { DEMO_PASSWORD, seed } from "@/mock/seed";
import { canSeeProject } from "@/shared/lib/access";

const db = seed(new Date(2026, 10, 16));
const user = (id: number) => db.users.find((u) => u.id === id)!;
const visible = (id: number) => db.projects.filter((p) => canSeeProject(user(id), p)).map((p) => p.id);

describe("who sees which project (the brief)", () => {
  it("the CEO, M&E and the admin see every project", () => {
    expect(visible(1)).toEqual([1, 2, 3]);
    expect(visible(3)).toEqual([1, 2, 3]);
    expect(visible(8)).toEqual([1, 2, 3]);
  });

  it("an employee sees only the projects they are in", () => {
    expect(visible(5)).toEqual([1]);
    expect(visible(7)).toEqual([1, 3]);
  });
});

describe("signing in", () => {
  it("works with the right email and password", async () => {
    const s = await authMock.login("PM@demo.test ", DEMO_PASSWORD);
    expect(s.user.role).toBe("pm");
    expect(s.token).toBe("demo-2");
  });

  it("refuses a wrong password without saying whether the email exists", async () => {
    const wrongPassword = await authMock.login("pm@demo.test", "nope").catch((e) => e);
    const noSuchEmail = await authMock.login("nobody@demo.test", "nope").catch((e) => e);
    expect(wrongPassword).toBeInstanceOf(ApiError);
    expect(wrongPassword.status).toBe(422);
    expect(noSuchEmail.message).toBe(wrongPassword.message);
  });
});

describe("the demo data", () => {
  it("has a blocked task, and it has a reason (the brief requires one)", () => {
    const blocked = db.tasks.filter((t) => t.status === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((t) => !!t.blocked_reason)).toBe(true);
  });

  it("uses only statuses that each task's project has", () => {
    for (const t of db.tasks) {
      const p = db.projects.find((x) => x.id === t.project_id)!;
      expect(p.statuses.map((s) => s.key)).toContain(t.status);
    }
  });
});
