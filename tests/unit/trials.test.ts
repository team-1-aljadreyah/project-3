// Trial teams (the client, 24 November 2026): the monitoring officer's own new teams under test, their new people, her
// ratings and notes, the decision on each, and the report she sends to the CEO. Nobody else sees them, not even the CEO.
// The same rules the real server must keep (docs/backend.md section 24).
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { trialsMock } = await import("@/features/trials/mock");
const { averageOf, canUseTrials, scoreText } = await import("@/features/trials/rules");
const { trialReport } = await import("@/features/trials/report");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 the CEO, 3 Huda (monitor), 5 Sara (employee), 8 the admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the rules", () => {
  it("only the monitoring officer: not the CEO, not anyone else", () => {
    expect(canUseTrials({ role: "monitor" })).toBe(true);
    for (const role of ["ceo", "pm", "lead", "employee", "admin"] as const) expect(canUseTrials({ role })).toBe(false);
  });

  it("averages to one decimal, written without a needless .0", () => {
    expect(averageOf([])).toBeUndefined();
    expect(averageOf([5, 4])).toBe(4.5);
    expect(averageOf([5, 4, 4])).toBe(4.3);
    expect(scoreText(4)).toBe("4");
    expect(scoreText(4.25)).toBe("4.3");
  });
});

describe("a trial team", () => {
  it("is made by the monitor, gets new people, ratings, notes and decisions, and shows their numbers", async () => {
    as(3);
    const team = await trialsMock.createTeam({ name: "  فريق تطبيق الجوال ", goal: "تجربة لمدة شهر", started_on: day(-10) });
    expect(team).toMatchObject({ name: "فريق تطبيق الجوال", status: "running", created_by: 3 });
    const yasser = await trialsMock.addMember(team.id, { name: "ياسر محمود", specialty: "مطوّر تطبيقات", email: "Yasser@Example.test" });
    const noor = await trialsMock.addMember(team.id, { name: "نور سالم", specialty: "مصممة واجهات" });
    expect(yasser).toMatchObject({ decision: "pending", email: "yasser@example.test" });

    await trialsMock.addEntry(yasser.id, { score: 5, text: "أنهى شاشة الدخول قبل موعدها." });
    await trialsMock.addEntry(yasser.id, { score: 4 });
    await trialsMock.addEntry(noor.id, { text: "تسأل قبل أن تبدأ." });
    await trialsMock.updateMember(yasser.id, { decision: "accepted" });

    const detail = await trialsMock.team(team.id);
    const y = detail.members.find((m) => m.id === yasser.id)!;
    expect(y).toMatchObject({ average: 4.5, scores: 2, notes: 1, decision: "accepted" });
    expect(detail.members.find((m) => m.id === noor.id)).toMatchObject({ scores: 0, notes: 1 });
    expect(detail.entries).toHaveLength(3);

    const [row] = await trialsMock.teams();
    expect(row).toMatchObject({ members: 2, average: 4.5, entries: 3, accepted: 1 });
  });

  it("is hers alone: the CEO, another job, or another monitoring officer gets nothing", async () => {
    as(3);
    const team = await trialsMock.createTeam({ name: "فريق", started_on: day(0) });
    for (const id of [1, 5, 8]) {
      as(id);
      expect((await fails(trialsMock.teams()))?.status).toBe(403);
      expect((await fails(trialsMock.team(team.id)))?.status).toBe(403);
    }
    getDb().users.push({ id: 99, name: "متابِعة ثانية", email: "m2@demo.test", role: "monitor", title: "", active: true });
    as(99);
    expect(await trialsMock.teams()).toEqual([]);
    expect((await fails(trialsMock.team(team.id)))?.status).toBe(404);
  });

  it("refuses a missing name, a start in the future, an entry with neither score nor words, and a score out of 1–5", async () => {
    as(3);
    expect((await fails(trialsMock.createTeam({ name: " ", started_on: day(0) })))?.errors).toHaveProperty("name");
    expect((await fails(trialsMock.createTeam({ name: "فريق", started_on: day(3) })))?.errors).toHaveProperty("started_on");
    const team = await trialsMock.createTeam({ name: "فريق", started_on: day(0) });
    expect((await fails(trialsMock.addMember(team.id, { name: "علي", specialty: "" })))?.errors).toHaveProperty("specialty");
    expect((await fails(trialsMock.addMember(team.id, { name: "علي", specialty: "مطور", email: "not-an-email" })))?.errors).toHaveProperty("email");
    const m = await trialsMock.addMember(team.id, { name: "علي", specialty: "مطور" });
    expect((await fails(trialsMock.addEntry(m.id, {})))?.errors).toHaveProperty("text");
    expect((await fails(trialsMock.addEntry(m.id, { score: 6 })))?.errors).toHaveProperty("score");
  });

  it("ends and runs again; a member removed takes their ratings and notes", async () => {
    as(3);
    const team = await trialsMock.createTeam({ name: "فريق", started_on: day(-3) });
    const m = await trialsMock.addMember(team.id, { name: "علي", specialty: "مطور" });
    await trialsMock.addEntry(m.id, { score: 3 });
    expect(await trialsMock.updateTeam(team.id, { status: "ended" })).toMatchObject({ status: "ended", ended_on: day(0) });
    expect((await trialsMock.updateTeam(team.id, { status: "running" })).ended_on).toBeUndefined();
    await trialsMock.removeMember(m.id);
    expect((await trialsMock.team(team.id)).entries).toEqual([]);
  });
});

describe("the report to the CEO", () => {
  it("names the team, the goal, the numbers, each person best first with their latest note, and her own words on top", async () => {
    as(3);
    const team = await trialsMock.createTeam({ name: "فريق الجوال", goal: "تجربة شهر", started_on: day(-5) });
    const a = await trialsMock.addMember(team.id, { name: "ياسر", specialty: "مطوّر" });
    const b = await trialsMock.addMember(team.id, { name: "نور", specialty: "مصممة" });
    await trialsMock.addEntry(a.id, { score: 3, text: "قديمة" });
    await trialsMock.addEntry(a.id, { text: "أحدث ملاحظة" });
    await trialsMock.addEntry(b.id, { score: 5 });
    await trialsMock.updateMember(b.id, { decision: "accepted" });
    const tr = (ar: string) => ar;
    const report = trialReport(await trialsMock.team(team.id), { tr, day: (d) => d, extra: "أقترح قبول نور." });
    expect(report.title).toBe("تقرير الفريق التجريبي: فريق الجوال");
    const lines = report.body.split("\n");
    expect(lines[0]).toBe("أقترح قبول نور.");
    expect(report.body).toContain("الهدف: تجربة شهر");
    expect(report.body).toContain("الأعضاء: 2 · مقبولون 1 · غير مقبولين 0 · قيد التقييم 1");
    // Best first: Noor (5) before Yasser (3), and Yasser's newest note, not the older one.
    expect(report.body.indexOf("1. نور")).toBeLessThan(report.body.indexOf("2. ياسر"));
    expect(report.body).toContain("«أحدث ملاحظة»");
    expect(report.body).not.toContain("قديمة");
  });
});
