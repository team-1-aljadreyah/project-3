// Monitoring notes and the CEO's inbox: the rules, and the demo backend's answers as different people.
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiError } from "@/shared/api/errors";

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

const { monitoringMock: api } = await import("@/features/monitoring/mock");
const rules = await import("@/features/monitoring/rules");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 monitoring officer, 4 team leader, 5 employee, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the rules", () => {
  it("the monitoring officer and the CEO write notes; other jobs don't", () => {
    expect(rules.canWriteNotes({ role: "monitor" })).toBe(true);
    expect(rules.canWriteNotes({ role: "ceo" })).toBe(true);
    for (const role of ["pm", "lead", "employee", "admin"] as const) expect(rules.canWriteNotes({ role })).toBe(false);
  });

  it("a note is seen and sent by its writer and the CEO; only the CEO has the inbox", () => {
    expect(rules.canSeeNote({ id: 3, role: "monitor" }, { author_id: 3 })).toBe(true);
    expect(rules.canSeeNote({ id: 2, role: "pm" }, { author_id: 3 })).toBe(false);
    expect(rules.canSendToCeo({ id: 3, role: "monitor" }, { author_id: 3 })).toBe(true);
    expect(rules.canUseCeoInbox({ role: "monitor" })).toBe(false);
  });
});

describe("requests to the CEO", () => {
  it("an employee sends a request about anything; it goes to the CEO at once, and her answer comes back", async () => {
    as(5);
    const r = await api.create({ kind: "request", subject: "إجازة", title: "إجازة يومين", body: "أحتاج إجازة يومي الأحد والإثنين.", about: { type: "general" } });
    expect(r).toMatchObject({ kind: "request", subject: "إجازة", ceo_state: "new" });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 1, kind: "note_sent", actor_id: 5 });
    as(1);
    expect((await api.inbox()).some((n) => n.id === r.id)).toBe(true);
    await api.answer(r.id, { state: "done", reply: "موافقة." });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 5, kind: "note_answered", data: { note_kind: "request" } });
  });

  it("a request needs a subject; every job sends requests except the CEO, who receives them", async () => {
    as(5);
    expect((await fails(api.create({ kind: "request", title: "x", body: "y", about: { type: "general" } })))?.status).toBe(422);
    for (const id of [2, 3, 4, 8]) {
      as(id);
      expect((await api.create({ kind: "request", subject: "s", title: `from ${id}`, body: "y", about: { type: "general" } })).ceo_state).toBe("new");
    }
    as(1);
    expect((await fails(api.create({ kind: "request", subject: "s", title: "x", body: "y", about: { type: "general" } })))?.status).toBe(403);
    expect(rules.canSendRequests({ role: "ceo" })).toBe(false);
  });

  it("a done note stays done when opened again, and goes back to \"to handle\" only when reopened", async () => {
    as(5);
    const r = await api.create({ kind: "request", subject: "s", title: "t", body: "b", about: { type: "general" } });
    as(1);
    expect((await api.answer(r.id, { state: "done" })).ceo_state).toBe("done");
    expect((await api.answer(r.id, { state: "seen" })).ceo_state).toBe("done");
    expect((await api.answer(r.id, { state: "seen", reopen: true })).ceo_state).toBe("seen");
  });
});

describe("the demo backend", () => {
  it("she writes a report about a team, a feedback on anyone, and a problem; each can go to the CEO, who is told", async () => {
    as(3);
    const report = await api.create({ kind: "report", title: "تقرير", body: "نص", about: { type: "team", id: 1 } });
    expect(report.about).toMatchObject({ type: "team", label: "فريق التطوير" });
    expect(report.sent_at).toBeUndefined();
    const feedback = await api.create({ kind: "feedback", tone: "improve", title: "ملاحظة", body: "نص", about: { type: "person", id: 2 }, send: true });
    expect(feedback).toMatchObject({ tone: "improve", ceo_state: "new" });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 1, kind: "note_sent", actor_id: 3 });
    const sent = await api.send(report.id);
    expect(sent.ceo_state).toBe("new");
  });

  it("a problem can be about anything, in her words, and involve any people", async () => {
    as(3);
    const p = await api.create({ kind: "problem", title: "تأخر الموافقات", body: "نص", about: { type: "general" }, subject: "الموافقات على الإجازات", people_ids: [5, 6, 2] });
    expect(p.subject).toBe("الموافقات على الإجازات");
    expect(p.people?.map((x) => x.id)).toEqual([5, 6, 2]);
    expect(p.people?.[0].label).toBe("سارة علي");
    expect((await fails(api.create({ kind: "problem", title: "x", body: "y", about: { type: "general" }, people_ids: [999] })))?.status).toBe(422);
  });

  it("feedback must be about a person other than herself; a title and a text are required", async () => {
    as(3);
    expect((await fails(api.create({ kind: "feedback", title: "x", body: "y", about: { type: "team", id: 1 } })))?.status).toBe(422);
    expect((await fails(api.create({ kind: "feedback", title: "x", body: "y", about: { type: "person", id: 3 } })))?.status).toBe(422);
    expect((await fails(api.create({ kind: "problem", title: " ", body: "y", about: { type: "general" } })))?.status).toBe(422);
  });

  it("the CEO reads her inbox, answers, and the writer is told; other jobs can't", async () => {
    as(1);
    const inbox = await api.inbox();
    expect(inbox.every((n) => n.sent_at)).toBe(true);
    const problem = inbox.find((n) => n.kind === "problem")!;
    const answered = await api.answer(problem.id, { state: "done", reply: "سأقرر اليوم." });
    expect(answered).toMatchObject({ ceo_state: "done", ceo_reply: "سأقرر اليوم." });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 3, kind: "note_answered" });
    as(3);
    expect((await fails(api.inbox()))?.status).toBe(403);
    as(2);
    expect((await fails(api.create({ kind: "problem", title: "x", body: "y", about: { type: "general" } })))?.status).toBe(403);
    expect((await fails(api.send(1)))?.status).toBe(404);
  });
});

const { performanceMock } = await import("@/features/performance/mock");
const { draftSummary, againstPlan } = await import("@/features/monitoring/report");
const { makeFmt } = await import("@/shared/lib/format");
const { today } = await import("@/shared/lib/utils");

describe("the report builder", () => {
  const all = () => ({ from: "2000-01-01", to: today() });

  it("a team report counts like the performance page: one row per member, the totals add up", async () => {
    as(3);
    const f = await api.reportFacts({ type: "team", id: 1 }, all());
    expect(f.about).toMatchObject({ type: "team", id: 1, label: "فريق التطوير" });
    expect(f.rows.map((r) => r.id).sort()).toEqual([4, 5, 6, 7]);
    expect(f.assigned).toBe(f.rows.reduce((s, r) => s + r.assigned, 0));
    expect(f.left).toBe(f.assigned - f.done);
    expect(f.completion).toBeCloseTo(f.assigned ? f.done / f.assigned : 0);
    // The same numbers as the performance page's team line for the same period.
    const team = (await performanceMock.overview(all())).teams.find((t) => t.team_id === 1)!;
    expect({ assigned: f.assigned, done: f.done, late: f.late, blocked: f.blocked }).toEqual({ assigned: team.assigned, done: team.done, late: team.late, blocked: team.blocked });
  });

  it("a person report has one row per project; a project report one row per person and the project's bugs", async () => {
    as(3);
    const person = await api.reportFacts({ type: "person", id: 5 }, all());
    expect(person.rows.length).toBeGreaterThan(0);
    expect(person.rows.every((r) => r.type === "project" && r.assigned > 0)).toBe(true);
    const project = await api.reportFacts({ type: "project", id: 1 }, all());
    expect(project.rows.every((r) => r.type === "person")).toBe(true);
    const bugs = getDb().bugs.filter((b) => b.project_id === 1);
    expect(project.bugs_open).toBe(bugs.filter((b) => b.status !== "closed").length);
    expect(project.bugs_reported).toBe(bugs.length);
    expect(project.planned).not.toBeNull();
  });

  it("only the monitoring officer and the CEO use it; a bad period or an unknown team is refused", async () => {
    as(5);
    expect((await fails(api.reportFacts({ type: "team", id: 1 }, all())))?.status).toBe(403);
    as(1);
    expect((await api.reportFacts({ type: "team", id: 1 }, all())).rows.length).toBe(4);
    as(3);
    expect((await fails(api.reportFacts({ type: "team", id: 1 }, { from: "2026-02-01", to: "2026-01-01" })))?.status).toBe(422);
    expect((await fails(api.reportFacts({ type: "team", id: 99 }, all())))?.status).toBe(422);
  });

  it("a saved report keeps the numbers the server counted, and the CEO gets them with it", async () => {
    as(3);
    const r = await api.create({ kind: "report", title: "تقرير الفريق", body: "نص", about: { type: "team", id: 1 }, period: all(), send: true });
    expect(r.facts).toMatchObject({ about: { type: "team", id: 1 }, period: all() });
    as(1);
    expect((await api.inbox()).find((n) => n.id === r.id)?.facts?.rows.length).toBe(4);
    as(3);
    expect((await fails(api.create({ kind: "feedback", title: "x", body: "y", about: { type: "person", id: 5 }, period: all() })))?.status).toBe(422);
    expect((await fails(api.create({ kind: "report", title: "x", body: "y", about: { type: "general" }, period: all() })))?.status).toBe(422);
  });

  it("writes a first draft from the numbers, in Arabic or English", async () => {
    as(3);
    const f = await api.reportFacts({ type: "team", id: 1 }, all());
    const ar = draftSummary(f, makeFmt("ar"));
    expect(ar).toContain(`كان لدى فريق التطوير ${f.assigned} مهمة`);
    expect(ar).toContain("الأخطاء:");
    expect(draftSummary(f, makeFmt("en"))).toContain(`Development team had ${f.assigned} tasks`);
  });

  it("says where the work is against the plan: within 5 points is on plan", () => {
    expect(againstPlan({ completion: 0.5, planned: null })).toBeNull();
    expect(againstPlan({ completion: 0.52, planned: 0.5 })).toBe("on");
    expect(againstPlan({ completion: 0.7, planned: 0.5 })).toBe("ahead");
    expect(againstPlan({ completion: 0.3, planned: 0.5 })).toBe("behind");
  });
});
