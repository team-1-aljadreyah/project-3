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
