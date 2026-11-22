// The administrator's console pages: importing accounts from a CSV (reading it, checking each row, creating the valid
// ones), sign-in sessions (who may end which), failed sign-ins, unlocking, the structure of the teams, and the
// "needs attention" rules of the health page. The pure rules first, then the demo backend as different people.
import { beforeEach, describe, expect, it } from "vitest";
import { checkImportRows, IMPORT_LIMIT, parseCsv, roleFromText, rowsFromCsv, templateRows } from "@/features/admin/csv-import";
import { bytesText, needsAttention, storageParts } from "@/features/admin/health";
import { activeSessions, endSessionProblem, neverSignedIn, securitySummary, sessionsToEnd, type SessionRecord } from "@/features/admin/security";
import { structureOf, structureProblems } from "@/features/admin/structure";
import type { AdminUser, AuditEntry, DataHealth, ImportRow } from "@/features/admin/types";
import type { Team } from "@/shared/api/types";
import { ApiError } from "@/shared/api/errors";
import { toCsv } from "@/shared/lib/csv";

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
const { setDbForTests, getDb } = await import("@/mock/db");
const { currentUser } = await import("@/mock/helpers");
const { seed, DEMO_PASSWORD } = await import("@/mock/seed");

const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

const row = (more: Partial<ImportRow> = {}): ImportRow => ({ name: "ليلى", name_en: "", email: "laila@demo.test", phone: "", role: "", title: "", team: "", password: "Laila-Start-1", ...more });

describe("reading a CSV", () => {
  it("quotes keep commas, quotes written twice and new lines; CRLF and LF; the BOM and empty lines go", () => {
    const text = '﻿name,title\r\n"Kareem, Ali","He said ""hi"""\r\n\r\n"two\nlines",plain\n';
    expect(parseCsv(text)).toEqual([
      ["name", "title"],
      ["Kareem, Ali", 'He said "hi"'],
      ["two\nlines", "plain"],
    ]);
  });

  it("Arabic text and Arabic commas inside a cell stay as they are; a semicolon file is read too", () => {
    expect(parseCsv("الاسم,المسمى\nسارة علي,\"مطورة، واجهات\"")).toEqual([
      ["الاسم", "المسمى"],
      ["سارة علي", "مطورة، واجهات"],
    ]);
    expect(parseCsv("name;email\n\"a;b\";x@demo.test")).toEqual([
      ["name", "email"],
      ["a;b", "x@demo.test"],
    ]);
  });

  it("what our own CSV download writes reads back the same (also a phone that starts with +)", () => {
    const rows = [["name", "email", "phone"], ["علي, حسين", "ali@demo.test", "+9647700000000"]];
    const back = rowsFromCsv(toCsv(rows));
    expect(back.rows).toEqual([row({ name: "علي, حسين", email: "ali@demo.test", phone: "+9647700000000", password: "" })]);
  });

  it("finds the columns by name in either language and in any order; tells unknown and missing columns", () => {
    const ar = rowsFromCsv("البريد الإلكتروني,الاسم,الفريق,ملاحظات\nhuda2@demo.test,هدى,فريق التطوير,x");
    expect(ar.rows).toEqual([row({ name: "هدى", email: "huda2@demo.test", team: "فريق التطوير", password: "" })]);
    expect(ar.unknown).toEqual(["ملاحظات"]);
    // The password column is required too: an account is never made without one.
    expect(ar.missing).toEqual(["password"]);
    expect(rowsFromCsv("name,phone\nx,1").missing).toEqual(["email", "password"]);
    expect(rowsFromCsv("a,b\n1,2").noHeader).toBe(true);
    expect(rowsFromCsv("").noHeader).toBe(true);
  });

  it("the template has every column and reads back as two rows", () => {
    const parsed = rowsFromCsv(toCsv(templateRows()));
    expect(parsed.missing).toEqual([]);
    expect(parsed.unknown).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
  });
});

describe("checking import rows", () => {
  const teams: Team[] = [{ id: 1, name: "فريق التطوير", name_en: "Development team" }];
  const check = (rows: ImportRow[]) => checkImportRows(rows, { emails: ["Sara@demo.test"], teams });

  it("a good row has no problem; the job and team are read in either language; an empty job is an employee", () => {
    expect(check([row(), row({ email: "b@demo.test", role: "Team leader", team: "development TEAM" }), row({ email: "c@demo.test", role: "موظف", team: "فريق التطوير" })]).map((r) => r.problems)).toEqual([[], [], []]);
    expect(roleFromText("")).toBe("employee");
    expect(roleFromText("PM")).toBe("pm");
    expect(roleFromText("مدير القسم")).toBe("pm");
    expect(roleFromText("boss")).toBeNull();
  });

  it("every problem of a row is listed, with its field", () => {
    const [r] = check([row({ name: " ", email: "not-an-email", role: "boss", team: "Sales", title: "x".repeat(81) })]);
    expect(r.problems.map((p) => [p.field, p.problem])).toEqual([
      ["name", "name_missing"],
      ["email", "email_bad"],
      ["role", "role_unknown"],
      ["title", "title_too_long"],
      ["team", "team_unknown"],
    ]);
  });

  it("an email twice in the file points at its first line; an existing account's email is taken (any case)", () => {
    const rows = check([row({ email: "x@demo.test" }), row({ email: "X@demo.test" }), row({ email: "sara@DEMO.test" }), row({ email: "" })]);
    expect(rows[0].problems).toEqual([]);
    expect(rows[1].problems).toEqual([{ field: "email", problem: "email_twice", other_line: 1 }]);
    expect(rows[2].problems).toEqual([{ field: "email", problem: "email_taken" }]);
    expect(rows[3].problems).toEqual([{ field: "email", problem: "email_missing" }]);
  });

  it("a CEO or a system admin is never imported", () => {
    expect(check([row({ role: "ceo" }), row({ email: "z@demo.test", role: "مسؤول النظام" })]).map((r) => r.problems[0]?.problem)).toEqual(["role_not_allowed", "role_not_allowed"]);
  });
});

describe("importing on the demo backend", () => {
  const rows = [row({ name: "كرار محمد", email: "karrar@demo.test", team: "فريق التطوير" }), row({ name: "نور سالم", email: "noor@demo" }), row({ name: "ريم", email: "reem@demo.test", role: "lead" })];

  it("a dry run checks and creates nothing; the real run creates the valid rows, skips the rest, and logs it all", async () => {
    as(8);
    const users = getDb().users.length;
    const lines = getDb().audit.length;
    const dry = await api.importUsers(rows, true);
    expect(dry).toMatchObject({ dry_run: true, created: 0, skipped: 1 });
    expect(dry.rows[1].problems).toEqual([{ field: "email", problem: "email_bad" }]);
    expect(getDb().users).toHaveLength(users);
    expect(getDb().audit).toHaveLength(lines);

    const done = await api.importUsers(rows, false);
    expect(done).toMatchObject({ dry_run: false, created: 2, skipped: 1 });
    expect(done.rows[0].user_id).toBeTruthy();
    expect(done.rows[1].user_id).toBeUndefined();
    const karrar = getDb().users.find((u) => u.email === "karrar@demo.test")!;
    expect(karrar).toMatchObject({ role: "employee", team_id: 1, active: true });
    expect(getDb().users.find((u) => u.email === "reem@demo.test")?.role).toBe("lead");
    const newLines = getDb().audit.slice(lines);
    expect(newLines.map((e) => e.action)).toEqual(["user_created", "user_created", "users_imported"]);
    expect(newLines[0].changes).toContainEqual({ field: "source", to: "import" });
    expect(newLines[2].changes).toEqual([{ field: "created", to: "2" }, { field: "skipped", to: "1" }]);
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: karrar.id, kind: "team_joined" });
    // Imported again: the emails are taken now.
    expect((await api.importUsers(rows.slice(0, 1), true)).rows[0].problems).toEqual([{ field: "email", problem: "email_taken" }]);
    // The new accounts have never signed in, and were made today.
    const listed = await api.users();
    expect(listed.find((u) => u.id === karrar.id)).toMatchObject({ last_login_at: undefined });
    expect(listed.find((u) => u.id === karrar.id)?.created_at).toBeTruthy();
  });

  it("no rows or too many rows: 422 on rows; other jobs: 403", async () => {
    as(8);
    expect((await fails(api.importUsers([], true)))?.errors).toHaveProperty("rows");
    expect((await fails(api.importUsers(Array.from({ length: IMPORT_LIMIT + 1 }, (_, i) => row({ email: `p${i}@demo.test` })), true)))?.errors).toHaveProperty("rows");
    as(2);
    expect((await fails(api.importUsers(rows, true)))?.status).toBe(403);
  });
});

describe("sign-in sessions", () => {
  const NOW = new Date(2026, 10, 19, 12);
  const s = (id: string, user_id: number, seenDaysAgo = 0, ended = false): SessionRecord => ({
    id,
    user_id,
    started_at: new Date(NOW.getTime() - (seenDaysAgo + 1) * 86_400_000).toISOString(),
    last_seen_at: new Date(NOW.getTime() - seenDaysAgo * 86_400_000).toISOString(),
    ...(ended ? { ended_at: NOW.toISOString() } : {}),
  });

  it("the rules: your own current session can't be ended here; an ended or idle one is already over", () => {
    expect(endSessionProblem(s("a", 1), "b", NOW)).toBeNull();
    expect(endSessionProblem(s("a", 1), "a", NOW)).toBe("current");
    expect(endSessionProblem(s("a", 1, 0, true), "b", NOW)).toBe("ended");
    expect(endSessionProblem(s("a", 1, 31), "b", NOW)).toBe("ended");
    // "Everywhere" ends the person's active sessions but the one making the request.
    const all = [s("a", 1), s("b", 1), s("c", 1, 40), s("d", 1, 0, true), s("e", 2)];
    expect(sessionsToEnd(all, 1, "b", NOW).map((x) => x.id)).toEqual(["a"]);
    expect(sessionsToEnd(all, 1, undefined, NOW).map((x) => x.id)).toEqual(["a", "b"]);
    expect(activeSessions(all, NOW).map((x) => x.id)).toEqual(["a", "b", "e"]);
  });

  it("the admin sees every active session (the seeded ones and their own new one, marked current)", async () => {
    await authMock.login("admin@demo.test", DEMO_PASSWORD);
    as(8);
    const list = await api.sessions();
    expect(list.filter((x) => x.user_id === 1)).toHaveLength(2);
    const mine = list.filter((x) => x.current);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ user_id: 8 });
    expect(mine[0].ip).toMatch(/^10\./);
  });

  it("ending someone's session logs it, signs that browser out, and leaves their other sessions", async () => {
    // Sara signs in in "her browser"; the admin ends that session from "his".
    await authMock.login("employee@demo.test", DEMO_PASSWORD);
    const saras = getDb().sessions.filter((x) => x.user_id === 5 && !x.ended_at);
    const fresh = saras.at(-1)!;
    const herBrowser = store.get("p3.demo.session");
    store.delete("p3.demo.session");
    as(8);
    await api.endSession(fresh.id);
    expect(getDb().audit.at(-1)).toMatchObject({ actor_id: 8, action: "session_ended", target: { type: "user", id: 5 } });
    expect(getDb().audit.at(-1)?.changes?.map((c) => c.field)).toEqual(["session", "device", "ip"]);
    expect((await api.sessions()).filter((x) => x.user_id === 5)).toHaveLength(saras.length - 1);
    expect((await fails(api.endSession(fresh.id)))?.status).toBe(404);
    // Back in Sara's browser: the next call says the session ended.
    store.set("p3.demo.session", herBrowser!);
    as(5);
    expect(() => currentUser()).toThrow(/أنهى مسؤول النظام هذه الجلسة/);
  });

  it("your own current session: 409; 'everywhere' for yourself keeps it; for someone else ends all of theirs", async () => {
    await authMock.login("admin@demo.test", DEMO_PASSWORD);
    as(8);
    const mine = (await api.sessions()).find((x) => x.current)!;
    expect((await fails(api.endSession(mine.id)))?.status).toBe(409);
    expect(await api.endUserSessions(8)).toEqual({ ended: 1 }); // the seeded older one
    expect((await api.sessions()).filter((x) => x.user_id === 8).map((x) => x.id)).toEqual([mine.id]);
    expect(await api.endUserSessions(1)).toEqual({ ended: 2 });
    expect(getDb().audit.at(-1)).toMatchObject({ action: "sessions_ended", target: { id: 1 }, changes: [{ field: "sessions", to: "2" }] });
    expect(await api.endUserSessions(1)).toEqual({ ended: 0 });
  });

  it("stopping an account signs it out everywhere; other jobs can't see or end sessions (403)", async () => {
    as(8);
    await api.updateUser(5, { active: false });
    expect((await api.sessions()).some((x) => x.user_id === 5)).toBe(false);
    as(1);
    expect((await api.sessions()).length).toBeGreaterThan(0);
    as(4);
    expect((await fails(api.sessions()))?.status).toBe(403);
    expect((await fails(api.endUserSessions(5)))?.status).toBe(403);
    expect((await fails(api.securitySummary()))?.status).toBe(403);
  });

  it("signing out ends this browser's session", async () => {
    await authMock.login("lead@demo.test", DEMO_PASSWORD);
    const id = store.get("p3.demo.session")!;
    await authMock.logout("demo-4");
    expect(getDb().sessions.find((x) => x.id === id)).toMatchObject({ end_reason: "signed_out" });
    expect(store.has("p3.demo.session")).toBe(false);
  });
});

describe("failed sign-ins, locks and unlocking", () => {
  it("the summary counts the last 7 days by account and by address, the most first; an unknown email by what was typed", () => {
    const now = new Date(2026, 10, 19, 12);
    let id = 0;
    const failed = (daysAgo: number, target: AuditEntry["target"], ip: string): AuditEntry => ({ id: ++id, action: "login_failed", target, ip, at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString() });
    const audit = [
      failed(1, { type: "login", id: 5, label: "employee@demo.test" }, "192.0.2.58"),
      failed(1, { type: "login", id: 5, label: "employee@demo.test" }, "203.0.113.9"),
      failed(2, { type: "login", id: 5, label: "employee@demo.test" }, "203.0.113.9"),
      failed(0.5, { type: "login", label: "nobody@demo.test" }, "203.0.113.9"),
      failed(9, { type: "login", id: 4, label: "lead@demo.test" }, "203.0.113.9"),
    ];
    const users: AdminUser[] = [
      { id: 5, name: "s", email: "employee@demo.test", role: "employee", title: "", active: true, failed_logins: 3, locked_until: new Date(now.getTime() + 600_000).toISOString(), last_login_at: "2026-11-01T00:00:00Z" },
      { id: 9, name: "n", email: "n@demo.test", role: "employee", title: "", active: true, failed_logins: 0 },
    ];
    const s = securitySummary(audit, users, { lock_after: 5, lock_minutes: 15 }, now);
    expect(s.failed_total).toBe(4);
    expect(s.by_account.map((a) => [a.user_id, a.label, a.count, a.ips.length])).toEqual([
      [5, "employee@demo.test", 3, 2],
      [undefined, "nobody@demo.test", 1, 1],
    ]);
    expect(s.by_ip.map((a) => [a.ip, a.count, a.accounts])).toEqual([
      ["203.0.113.9", 3, 2],
      ["192.0.2.58", 1, 1],
    ]);
    expect(s.locked).toEqual([{ user_id: 5, locked_until: users[0].locked_until, failed: 3 }]);
    expect(s.never_signed_in).toEqual([{ user_id: 9 }]);
  });

  it("the admin unlocks a locked account at once (logged); an account that isn't locked: 409", async () => {
    for (let i = 0; i < 5; i++) await fails(authMock.login("employee@demo.test", "wrong"));
    as(8);
    const summary = await api.securitySummary();
    expect(summary.locked.map((l) => l.user_id)).toEqual([5]);
    expect(summary.by_account[0]).toMatchObject({ user_id: 5, count: 5 });
    const u = await api.unlockUser(5);
    expect(u).toMatchObject({ failed_logins: 0, locked_until: undefined });
    expect(getDb().audit.at(-1)).toMatchObject({ actor_id: 8, action: "user_unlocked", target: { id: 5 } });
    expect((await fails(api.unlockUser(5)))?.status).toBe(409);
    expect((await authMock.login("employee@demo.test", DEMO_PASSWORD)).user.id).toBe(5);
  });
});

describe("structure and needs attention", () => {
  const NOW = new Date(2026, 10, 19, 12);
  const u = (id: number, more: Partial<AdminUser> = {}): AdminUser => ({ id, name: `u${id}`, email: `u${id}@demo.test`, role: "employee", title: "", active: true, failed_logins: 0, last_login_at: "2026-11-18T09:00:00Z", ...more });
  const teams: Team[] = [
    { id: 1, name: "A", lead_id: 2 },
    { id: 2, name: "B" },
    { id: 3, name: "C", lead_id: 4 },
    { id: 4, name: "D", lead_id: 9 },
  ];
  const users = [
    u(1, { role: "ceo" }),
    u(2, { role: "lead", team_id: 1 }),
    u(3, { team_id: 1 }),
    u(4, { role: "lead", team_id: 3 }),
    u(5),
    u(6, { role: "lead" }),
    u(7, { role: "pm" }),
    u(8, { active: false }),
    u(9, { role: "lead", team_id: 4, active: false }),
    u(10, { team_id: 4 }),
  ];

  it("the structure: people of a team job in no team, teams with no (active) leader, a lonely leader, idle leaders", () => {
    const s = structureOf(users, teams);
    expect(s.noTeam.map((x) => x.id)).toEqual([5]); // not the CEO, the PM, the stopped account, or idle leader 6 (listed below)
    expect(s.noLeader.map((t) => t.team.id)).toEqual([2, 4]); // team D's leader is stopped
    expect(s.leaderAlone.map((t) => t.team.id)).toEqual([3]);
    expect(s.idleLeads.map((x) => x.id)).toEqual([6]);
    expect(s.teams.find((t) => t.team.id === 1)?.members.map((x) => x.id)).toEqual([3]);
    expect(structureProblems(s)).toBe(5);
  });

  it("needs attention: the urgent first, each linking to its fix; nothing when all is well", () => {
    const health: DataHealth = {
      users_active: 8, users_stopped: 2, users_locked: 1, projects: 1, tasks: 1, files: 1, files_bytes: 1, audit_entries: 1,
      storage: { attachments_bytes: 850, attachments: 1, pictures_bytes: 0, pictures: 0, voice_bytes: 0, voice: 0, audit_bytes: 0 },
      storage_quota_bytes: 1000,
      backup: { status: "failed", at: "2026-11-19T02:00:00Z" },
    };
    const people = [...users, u(11, { locked_until: new Date(NOW.getTime() + 60_000).toISOString() }), u(12, { last_login_at: undefined, created_at: "2026-11-01T00:00:00Z" }), u(13, { last_login_at: undefined, created_at: "2026-11-18T00:00:00Z" })];
    const items = needsAttention({ users: people, teams, health, now: NOW });
    expect(items.map((i) => [i.key, i.level, i.href])).toEqual([
      ["locked", "high", "/admin/security#locked"],
      ["storage", "high", "/admin/health#storage"],
      ["backup", "high", "/admin/health#backup"],
      ["never", "normal", "/admin/security#never"],
      ["no_leader", "normal", "/admin/structure#no-leader"],
      ["no_team", "normal", "/admin/structure#no-team"],
    ]);
    expect(items.find((i) => i.key === "never")?.count).toBe(1); // only the one older than 7 days
    expect(items.find((i) => i.key === "storage")?.count).toBeCloseTo(0.85);

    const fine = needsAttention({
      users: [u(1, { role: "lead", team_id: 1 }), u(2, { team_id: 1 })],
      teams: [{ id: 1, name: "A", lead_id: 1 }],
      health: { ...health, storage_quota_bytes: 10_000, backup: { status: "ok", at: new Date(NOW.getTime() - 3_600_000).toISOString() } },
      now: NOW,
    });
    expect(fine).toEqual([]);
    // A backup older than two days needs a look too.
    expect(needsAttention({ users: [], teams: [], health: { ...health, storage_quota_bytes: 10_000, backup: { status: "ok", at: "2026-11-15T02:00:00Z" } }, now: NOW }).map((i) => i.key)).toEqual(["backup"]);
  });

  it("never signed in: only active accounts; the age limit counts from when the account was made", () => {
    const list = [u(1, { last_login_at: undefined }), u(2, { last_login_at: undefined, created_at: "2026-11-18T00:00:00Z" }), u(3, { last_login_at: undefined, active: false })];
    expect(neverSignedIn(list, NOW).map((x) => x.id)).toEqual([1, 2]);
    expect(neverSignedIn(list, NOW, 7).map((x) => x.id)).toEqual([1]);
  });

  it("storage by kind and in words; the demo backend sends the parts, the quota and the backup", async () => {
    expect(bytesText(512)).toBe("512 B");
    expect(bytesText(1536)).toBe("1.5 KB");
    expect(bytesText(5 * 1024 ** 3)).toBe("5.0 GB");
    as(8);
    const h = await api.health();
    expect(h.storage?.attachments).toBe(getDb().attachments.length);
    expect(h.storage_quota_bytes).toBeGreaterThan(0);
    expect(h.backup?.status).toBe("ok");
    expect(storageParts(h).map((p) => p.key)).toEqual(["attachments", "pictures", "voice", "audit"]);
  });
});
