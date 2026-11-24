// Passwords: no account without one, the admin sets a new one for someone who forgot it, and everyone changes their
// own. The same rules the real server must keep (docs/backend.md, sections 14 and 19).
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";
import { makePassword, passwordProblem } from "@/shared/lib/password";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { adminMock } = await import("@/features/admin/mock");
const { authMock } = await import("@/features/auth/mock");
const { profileMock } = await import("@/features/profile/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed, DEMO_PASSWORD } = await import("@/mock/seed");

// The demo people: 1 CEO, 5 Sara (employee), 8 the system admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const laila = { name: "ليلى", email: "laila@demo.test", role: "employee" as const, title: "" };

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the rule", () => {
  it("a password is long enough (the CEO's setting, 8 by default), not too long, not only spaces", () => {
    expect(passwordProblem("")).not.toBeNull();
    expect(passwordProblem("short7!")).not.toBeNull();
    expect(passwordProblem("long-enough")).toBeNull();
    expect(passwordProblem("12345", 6)).not.toBeNull();
    expect(passwordProblem("123456", 6)).toBeNull();
    expect(passwordProblem("         ")).not.toBeNull();
    expect(passwordProblem("x".repeat(129))).not.toBeNull();
  });

  it("a made password is 12 readable characters, different each time", () => {
    const a = makePassword();
    expect(a).toHaveLength(12);
    expect(a).not.toMatch(/[l1IO0]/);
    expect(makePassword()).not.toBe(a);
  });
});

describe("making an account", () => {
  it("is refused without a password, or with a short one; the new person signs in with the one given", async () => {
    as(8);
    expect((await fails(adminMock.createUser(laila)))?.errors).toHaveProperty("password");
    expect((await fails(adminMock.createUser({ ...laila, password: "short" })))?.errors).toHaveProperty("password");
    await adminMock.createUser({ ...laila, password: "Laila-Start-2026" });
    store.clear();
    expect((await fails(authMock.login("laila@demo.test", DEMO_PASSWORD)))?.status).toBe(422);
    expect((await authMock.login("laila@demo.test", "Laila-Start-2026")).user.email).toBe("laila@demo.test");
  });

  it("the admin sets a new password for someone who forgot theirs; the log says so, never the password", async () => {
    as(8);
    await adminMock.updateUser(5, { password: "Sara-New-2026" });
    const line = getDb().audit.at(-1)!;
    expect(line).toMatchObject({ action: "user_changed", target: { id: 5 } });
    expect(JSON.stringify(line)).not.toContain("Sara-New-2026");
    store.clear();
    expect((await authMock.login("employee@demo.test", "Sara-New-2026")).user.id).toBe(5);
  });

  it("an import row without a password is refused, and one with it signs in", async () => {
    as(8);
    const row = { name: "نور", name_en: "", email: "noor@demo.test", phone: "", role: "", title: "", team: "" };
    const none = await adminMock.importUsers([{ ...row, password: "" }], true);
    expect(none.rows[0].problems.map((p) => p.problem)).toContain("password_missing");
    const made = await adminMock.importUsers([{ ...row, password: "Noor-Start-2026" }], false);
    expect(made.created).toBe(1);
    store.clear();
    expect((await authMock.login("noor@demo.test", "Noor-Start-2026")).user.email).toBe("noor@demo.test");
  });
});

describe("changing my own password", () => {
  it("needs the current one right and a long enough new one; then only the new one signs in", async () => {
    as(5);
    expect((await fails(profileMock.changeMyPassword("wrong", "Sara-Mine-2026")))?.errors).toHaveProperty("current_password");
    expect((await fails(profileMock.changeMyPassword(DEMO_PASSWORD, "short")))?.errors).toHaveProperty("password");
    await profileMock.changeMyPassword(DEMO_PASSWORD, "Sara-Mine-2026");
    store.clear();
    expect((await fails(authMock.login("employee@demo.test", DEMO_PASSWORD)))?.status).toBe(422);
    expect((await authMock.login("employee@demo.test", "Sara-Mine-2026")).user.id).toBe(5);
  });
});

describe("the monitor adds accounts (the client, 24 November 2026)", () => {
  it("adds any job but the CEO and the system admin, sees the list, and changes no account", async () => {
    as(3);
    expect((await adminMock.users()).length).toBeGreaterThan(0);
    expect((await fails(adminMock.createUser({ ...laila, role: "admin", password: "Laila-Start-2026" })))?.errors).toHaveProperty("role");
    expect((await fails(adminMock.createUser({ ...laila, role: "ceo", password: "Laila-Start-2026" })))?.errors).toHaveProperty("role");
    const made = await adminMock.createUser({ ...laila, role: "lead", password: "Laila-Start-2026" });
    expect(getDb().audit.at(-1)).toMatchObject({ action: "user_created", actor_id: 3, target: { id: made.id } });
    expect((await fails(adminMock.updateUser(5, { title: "x" })))?.status).toBe(403);
  });

  it("other jobs can't add accounts or see the list", async () => {
    as(5);
    expect((await fails(adminMock.users()))?.status).toBe(403);
    expect((await fails(adminMock.createUser({ ...laila, password: "Laila-Start-2026" })))?.status).toBe(403);
  });
});
