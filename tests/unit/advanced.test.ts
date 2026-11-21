// The CEO's advanced settings: the defaults, the merge, the checks and the "what changed" (pure rules), then the demo
// backend as different people (403 for others, 422 per field, history only for real changes, import, reset), and
// what the settings change elsewhere (features off, read-only mode, the notification table, code prefixes).
import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIONS,
  ALL_ROLES,
  changedCount,
  changedRules,
  checkRules,
  DEFAULT_RULES,
  diffRules,
  liveFor,
  rulesOf,
  STAFF_ROLES,
  workDaysBetween,
} from "@/features/advanced/rules";
import type { AdvancedRules } from "@/features/advanced/types";
import { canPostAnnouncements } from "@/features/announcements/rules";
import { canCreateGroupChat } from "@/features/chat/rules";
import { canSeePeoplePerf } from "@/features/performance/rules";
import { canCreateProject } from "@/features/projects/rules";
import { canSeeReports } from "@/features/reports/rules";
import { ApiError } from "@/shared/api/errors";
import { REQUIRED_NOTIFICATIONS } from "@/shared/api/notification-kinds";
import type { Role } from "@/shared/api/types";
import { hiddenNavKeys } from "@/shared/lib/site";

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
const { chatMock } = await import("@/features/chat/mock");
const { tasksMock } = await import("@/features/tasks/mock");
const { bugsMock } = await import("@/features/bugs/mock");
const { notificationsMock } = await import("@/features/notifications/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const withRules = (patch: Partial<AdvancedRules>) => ({ ...DEFAULT_RULES, ...patch });

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the rules: defaults, merge, changes", () => {
  it("the defaults pass the check and change nothing", () => {
    expect(checkRules(DEFAULT_RULES)).toEqual({});
    expect(changedRules(DEFAULT_RULES)).toEqual({});
    expect(changedCount(DEFAULT_RULES)).toBe(0);
    expect(DEFAULT_RULES.work.days).toEqual([0, 1, 2, 3, 4]); // Friday (5) and Saturday (6) off
  });

  it("the default rights are today's rules of the features", () => {
    const def = (key: string) => ACTIONS.find((a) => a.key === key)!.def as Role[];
    for (const role of STAFF_ROLES) {
      const u = { role };
      expect(def("create_project").includes(role), `create_project ${role}`).toBe(canCreateProject(u));
      expect(def("post_announcement").includes(role), `post_announcement ${role}`).toBe(canPostAnnouncements(u));
      expect(def("create_group_chat").includes(role), `create_group_chat ${role}`).toBe(canCreateGroupChat(u));
      expect(def("see_reports").includes(role), `see_reports ${role}`).toBe(canSeeReports(u));
      expect(def("see_scores").includes(role), `see_scores ${role}`).toBe(canSeePeoplePerf(u));
    }
  });

  it("merges one level down: a missing setting is its default; the admin's numbers win for security", () => {
    const r = rulesOf({ work: { days: [0, 1] } as AdvancedRules["work"], features: { chat: false } as AdvancedRules["features"] }, { lock_after: 7 });
    expect(r.work).toEqual({ ...DEFAULT_RULES.work, days: [0, 1] });
    expect(r.features.chat).toBe(false);
    expect(r.features.bugs).toBe(true);
    expect(r.security).toEqual({ ...DEFAULT_RULES.security, lock_after: 7 });
    expect(rulesOf(null)).toEqual(DEFAULT_RULES);
  });

  it("keeps only the parts that differ, and they rebuild the same rules", () => {
    const r = withRules({ names: { task: "JOB", project: "PRJ", bug: "BUG" }, banner: { text: "hi", roles: [], tone: "info" } });
    expect(Object.keys(changedRules(r)).sort()).toEqual(["banner", "names"]);
    expect(rulesOf(changedRules(r))).toEqual(r);
  });

  it("lists only real changes, one level down; the order of ticks doesn't count", () => {
    const after = withRules({
      work: { ...DEFAULT_RULES.work, days: [4, 3, 2, 1, 0] },
      permissions: { ...DEFAULT_RULES.permissions, change_due: ["pm"] },
    });
    expect(diffRules(DEFAULT_RULES, after)).toEqual([{ key: "permissions.change_due", from: ["pm", "lead"], to: ["pm"] }]);
    expect(diffRules(DEFAULT_RULES, withRules({ banner: { text: "x", roles: [], tone: "info" } }))).toEqual([{ key: "banner", from: null, to: { text: "x", roles: [], tone: "info" } }]);
    expect(diffRules(DEFAULT_RULES, DEFAULT_RULES)).toEqual([]);
  });
});

describe("the rules: the check (the same on the page and the server)", () => {
  const problems = (patch: Partial<AdvancedRules>) => Object.keys(checkRules(withRules(patch)));

  it("working time: at least one day, the start before the end, holidays with a date and a name, once a day", () => {
    expect(problems({ work: { ...DEFAULT_RULES.work, days: [] } })).toEqual(["work.days"]);
    expect(problems({ work: { ...DEFAULT_RULES.work, days: [0, 9] } })).toEqual(["work.days"]);
    expect(problems({ work: { ...DEFAULT_RULES.work, from: "17:00", to: "08:00" } })).toEqual(["work.hours"]);
    expect(problems({ work: { ...DEFAULT_RULES.work, holidays: [{ date: "2026-12-25", name: " " }] } })).toEqual(["work.holidays"]);
    expect(problems({ work: { ...DEFAULT_RULES.work, holidays: [{ date: "2026-12-25", name: "a" }, { date: "2026-12-25", name: "b" }] } })).toEqual(["work.holidays"]);
    expect(problems({ work: { ...DEFAULT_RULES.work, holidays: [{ date: "2026-12-25", name: "عيد" }] } })).toEqual([]);
  });

  it("due days and fix targets: whole numbers in range, and a worse bug never waits longer", () => {
    expect(problems({ due_days: { ...DEFAULT_RULES.due_days, high: 0 } })).toEqual(["due_days.high"]);
    expect(problems({ due_days: { ...DEFAULT_RULES.due_days, low: Number.NaN } })).toEqual(["due_days.low"]);
    expect(problems({ fix_days: { critical: 5, high: 3, medium: 7, low: 14 } })).toEqual(["fix_days.high"]);
  });

  it("tasks, security and prefixes", () => {
    expect(problems({ tasks: { ...DEFAULT_RULES.tasks, wip_limit: 51 } })).toEqual(["tasks.wip_limit"]);
    expect(problems({ security: { ...DEFAULT_RULES.security, lock_after: 2 } })).toEqual(["security.lock_after"]);
    expect(problems({ security: { ...DEFAULT_RULES.security, password_min: 4 } })).toEqual(["security.password_min"]);
    expect(problems({ names: { task: "tsk", project: "PRJ", bug: "BUG" } })).toEqual(["names.task"]);
    expect(problems({ names: { task: "TASKS1", project: "PRJ", bug: "BUG" } })).toEqual(["names.task"]);
    expect(problems({ names: { task: "TSK", project: "TSK", bug: "BUG" } })).toEqual(["names.project"]);
  });

  it("a required notification reaches every job; rights never list the CEO", () => {
    const required = [...REQUIRED_NOTIFICATIONS][0];
    expect(problems({ notify: { ...DEFAULT_RULES.notify, [required]: ["ceo"] } })).toEqual([`notify.${required}`]);
    expect(problems({ notify: { ...DEFAULT_RULES.notify, task_comment: ["pm"] } })).toEqual([]);
    expect(problems({ permissions: { ...DEFAULT_RULES.permissions, create_project: ["ceo" as never] } })).toEqual(["permissions.create_project"]);
  });

  it("the banner needs its text; read-only mode needs its message", () => {
    expect(problems({ banner: { text: " ", roles: [], tone: "info" } })).toEqual(["banner.text"]);
    expect(problems({ banner: { text: "x", roles: [], tone: "info", until: "not a date" } })).toEqual(["banner.until"]);
    expect(problems({ read_only: { on: true, message: "" } })).toEqual(["read_only.message"]);
  });
});

describe("the rules: what each person gets, working days", () => {
  it("the banner only for its jobs and until it ends; features off leave the menu, never the CEO's", () => {
    const r = withRules({ banner: { text: "x", roles: ["employee"], tone: "warning" }, features: { ...DEFAULT_RULES.features, chat: false } });
    expect(liveFor(r, "employee").banner?.text).toBe("x");
    expect(liveFor(r, "pm").banner).toBeNull();
    const ended = withRules({ banner: { text: "x", roles: [], tone: "info", until: "2020-01-01T00:00:00Z" } });
    expect(liveFor(ended, "pm").banner).toBeNull();
    expect(hiddenNavKeys(liveFor(r, "employee"), "employee")).toEqual(["chat"]);
    expect(hiddenNavKeys(liveFor(r, "ceo"), "ceo")).toEqual([]);
  });

  it("counts working days: Friday, Saturday and holidays don't count", () => {
    // 2026-11-19 is a Thursday: Fri 20 and Sat 21 are off, Sun 22 counts.
    expect(workDaysBetween(DEFAULT_RULES, "2026-11-19", "2026-11-22")).toBe(1);
    const withHoliday = withRules({ work: { ...DEFAULT_RULES.work, holidays: [{ date: "2026-11-22", name: "عطلة" }] } });
    expect(workDaysBetween(withHoliday, "2026-11-19", "2026-11-23")).toBe(1);
  });
});

describe("the demo backend", () => {
  it("the CEO only: 403 for everyone else; what each person must obey is for everyone", async () => {
    for (const id of [2, 3, 4, 5, 8]) {
      as(id);
      expect((await fails(api.get()))?.status).toBe(403);
      expect((await fails(api.save({})))?.status).toBe(403);
      expect((await fails(api.history()))?.status).toBe(403);
      expect((await api.live()).features.chat).toBe(true);
    }
    as(1);
    expect((await api.get()).rules).toEqual(DEFAULT_RULES);
  });

  it("422 with a message on each wrong field, and nothing saved", async () => {
    as(1);
    const e = await fails(api.save({ work: { ...DEFAULT_RULES.work, days: [] }, names: { task: "x", project: "PRJ", bug: "BUG" } }));
    expect(e?.status).toBe(422);
    expect(Object.keys(e?.errors ?? {}).sort()).toEqual(["names.task", "work.days"]);
    expect(getDb().advanced).toEqual({});
    expect(getDb().advanced_log).toEqual([]);
  });

  it("keeps only the differences, and writes history and audit only for real changes", async () => {
    as(1);
    const r = withRules({ work: { ...DEFAULT_RULES.work, days: [0, 1, 2, 3] } });
    await api.save(changedRules(r));
    expect(getDb().advanced).toEqual({ work: r.work });
    const [line] = await api.history();
    expect(line).toMatchObject({ by: { id: 1 }, changes: [{ key: "work.days", from: [0, 1, 2, 3, 4], to: [0, 1, 2, 3] }] });
    expect(getDb().audit.at(-1)).toMatchObject({ actor_id: 1, action: "settings_changed", changes: [{ field: "work.days" }] });

    // The same save again, or the same days in another order: no new line.
    const audits = getDb().audit.length;
    await api.save(changedRules(r));
    await api.save(changedRules(withRules({ work: { ...DEFAULT_RULES.work, days: [3, 2, 1, 0] } })));
    expect(await api.history()).toHaveLength(1);
    expect(getDb().audit).toHaveLength(audits);
  });

  it("the security numbers are the administration's settings, both ways", async () => {
    as(1);
    await api.save(changedRules(withRules({ security: { ...DEFAULT_RULES.security, lock_after: 7, password_min: 10 } })));
    expect(getDb().settings.lock_after).toBe(7);
    expect((await adminMock.settings()).lock_after).toBe(7);
    await adminMock.saveSettings({ ...getDb().settings, lock_minutes: 30 });
    expect((await api.get()).rules.security).toEqual({ due_soon_days: 1, lock_after: 7, lock_minutes: 30, password_min: 10 });
  });

  it("import is marked in the history; reset brings every default back", async () => {
    as(1);
    await api.save(changedRules(withRules({ features: { ...DEFAULT_RULES.features, bugs: false }, security: { ...DEFAULT_RULES.security, lock_after: 8 } })), "import");
    expect((await api.history())[0]).toMatchObject({ how: "import" });
    await api.save({ names: { task: "JOB", project: "PRJ", bug: "BUG" } }, "reset");
    const [last] = await api.history();
    expect(last.how).toBe("reset");
    expect(last.changes.map((c) => c.key).sort()).toEqual(["features.bugs", "security.lock_after"]);
    expect((await api.get()).rules).toEqual(DEFAULT_RULES);
    expect(getDb().advanced).toEqual({});
    expect(getDb().settings.lock_after).toBe(5);
  });
});

describe("what the settings change", () => {
  it("a feature switched off is refused for everyone but the CEO", async () => {
    as(1);
    await api.save(changedRules(withRules({ features: { ...DEFAULT_RULES.features, chat: false, bugs: false } })));
    as(5);
    expect((await fails(chatMock.conversations()))?.code).toBe("FEATURE_OFF");
    expect((await fails(bugsMock.bugs()))?.status).toBe(403);
    expect((await api.live()).features.chat).toBe(false);
    as(1);
    expect((await chatMock.conversations()).length).toBeGreaterThan(0);
  });

  it("read-only mode refuses changes from everyone but the CEO, and keeps nothing of them", async () => {
    as(1);
    await api.save(changedRules(withRules({ read_only: { on: true, message: "نقل البيانات" } })));
    as(2);
    const task = structuredClone(getDb().tasks.find((t) => t.project_id === 1)!);
    const e = await fails(tasksMock.updateTask(task.id, { title: "عنوان جديد" }));
    expect(e?.status).toBe(423);
    expect(e?.code).toBe("READ_ONLY");
    expect(e?.message).toMatch(/نقل البيانات/);
    expect(getDb().tasks.find((t) => t.id === task.id)!.title).toBe(task.title);
    // Their own bookkeeping still works: reading notifications.
    await notificationsMock.notifications();
    await notificationsMock.markAllRead();
    as(1);
    await tasksMock.updateTask(task.id, { title: "عنوان من المديرة" });
    expect(getDb().tasks.find((t) => t.id === task.id)!.title).toBe("عنوان من المديرة");
  });

  it("the notification table stops a kind for a whole job; required kinds still arrive", async () => {
    as(1);
    const notify = { ...DEFAULT_RULES.notify, task_comment: ALL_ROLES.filter((r) => r !== "pm") };
    await api.save(changedRules(withRules({ notify })));
    const before = getDb().seq.notification;
    as(6);
    const task = getDb().tasks.find((t) => t.project_id === 1 && t.assignee_id && t.assignee_id !== 6)!;
    await tasksMock.addComment(task.id, "ملاحظة");
    const got = getDb().notifications.filter((n) => n.id > before);
    expect(got.some((n) => n.user_id === 2)).toBe(false); // the PM's job no longer gets comments
    expect(got.some((n) => n.user_id === task.assignee_id && n.kind === "task_comment")).toBe(true);
  });

  it("new records take the chosen prefixes; old codes stay", async () => {
    as(1);
    await api.save(changedRules(withRules({ names: { task: "JOB", project: "PRJ", bug: "ISS" } })));
    as(2);
    const t = await tasksMock.createTask(1, { title: "مهمة", priority: "low" });
    expect(t.code).toMatch(/^JOB-\d+$/);
    const b = await bugsMock.report(1, { title: "مشكلة", description: "", severity: "low", priority: "low" });
    expect(b.code).toMatch(/^ISS-\d+$/);
    expect(getDb().tasks.some((x) => x.code.startsWith("TSK-"))).toBe(true);
  });
});
