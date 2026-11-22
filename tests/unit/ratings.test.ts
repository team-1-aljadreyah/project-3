// Quick ratings of teams and people (the client, 22 November 2026): the rules, the numbers, and the demo backend's
// answers as different people.
import { beforeEach, describe, expect, it } from "vitest";
import type { Rating, RatingInput } from "@/features/ratings";
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

const { ratingsMock: api } = await import("@/features/ratings/mock");
const rules = await import("@/features/ratings/rules");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM (runs every project), 3 monitoring officer, 4 team leader of team 1, 5 Sara (team 1),
// 8 admin. Each test adds team 2 with one person (9) who is in none of the PM's projects.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const TEAM = { type: "team" as const, id: 1 };
const OTHER_TEAM = { type: "team" as const, id: 2 };
const SARA = { type: "person" as const, id: 5 };
const good: RatingInput = { score: 4, reason_type: "other", reason: "سلّم الفريق العرض قبل موعده بيومين." };

beforeEach(() => {
  store.clear();
  const db = seed();
  db.teams.push({ id: 2, name: "فريق الدعم", name_en: "Support team" });
  db.users.push({ id: 9, name: "ليلى سمير", name_en: "Laila Samir", email: "laila@demo.test", role: "employee", title: "دعم فني", team_id: 2, active: true });
  setDbForTests(db);
});

describe("the rules", () => {
  const projects = [{ pm_id: 2, member_ids: [2, 4, 5] }];
  const users = [
    { id: 4, team_id: 1, active: true },
    { id: 5, team_id: 1, active: true },
    { id: 9, team_id: 2, active: true },
  ];

  it("monitoring and the CEO rate any team; a PM only the teams in their projects; leaders and employees never", () => {
    expect(rules.canRateTeam({ id: 3, role: "monitor" }, { id: 2 }, users, projects)).toBe(true);
    expect(rules.canRateTeam({ id: 1, role: "ceo" }, { id: 2 }, users, projects)).toBe(true);
    expect(rules.canRateTeam({ id: 2, role: "pm" }, { id: 1 }, users, projects)).toBe(true);
    expect(rules.canRateTeam({ id: 2, role: "pm" }, { id: 2 }, users, projects)).toBe(false);
    expect(rules.canRateTeam({ id: 4, role: "lead", team_id: 1 }, { id: 1 }, users, projects)).toBe(false);
    expect(rules.canRateTeam({ id: 5, role: "employee", team_id: 1 }, { id: 1 }, users, projects)).toBe(false);
    expect(rules.canGiveRatings({ role: "lead" })).toBe(false);
    expect(rules.canGiveRatings({ role: "monitor" })).toBe(true);
  });

  it("people: monitoring anyone, a PM the people in their projects, never yourself, never the CEO or the admin", () => {
    expect(rules.canRatePerson({ id: 3, role: "monitor" }, { id: 9, role: "employee" }, projects)).toBe(true);
    expect(rules.canRatePerson({ id: 2, role: "pm" }, { id: 5, role: "employee" }, projects)).toBe(true);
    expect(rules.canRatePerson({ id: 2, role: "pm" }, { id: 9, role: "employee" }, projects)).toBe(false);
    expect(rules.canRatePerson({ id: 3, role: "monitor" }, { id: 3, role: "monitor" }, projects)).toBe(false);
    expect(rules.canRatePerson({ id: 3, role: "monitor" }, { id: 1, role: "ceo" }, projects)).toBe(false);
    expect(rules.canRatePerson({ id: 4, role: "lead" }, { id: 5, role: "employee" }, projects)).toBe(false);
    // Sara reads her own; Ali (another employee) doesn't.
    expect(rules.canSeePersonRatings({ id: 5, role: "employee" }, { id: 5, role: "employee" }, projects)).toBe(true);
    expect(rules.canSeePersonRatings({ id: 6, role: "employee" }, { id: 5, role: "employee" }, projects)).toBe(false);
  });

  it("a team's people read its ratings; the admin sees the team page but not its ratings", () => {
    expect(rules.canSeeTeamRatings({ id: 5, role: "employee", team_id: 1 }, { id: 1 }, users, projects)).toBe(true);
    expect(rules.canSeeTeamRatings({ id: 9, role: "employee", team_id: 2 }, { id: 1 }, users, projects)).toBe(false);
    expect(rules.canSeeTeam({ id: 8, role: "admin" }, { id: 1 })).toBe(true);
    expect(rules.canSeeTeamRatings({ id: 8, role: "admin" }, { id: 1 }, users, projects)).toBe(false);
    expect(rules.canSeeTeam({ id: 9, role: "employee", team_id: 2 }, { id: 1 })).toBe(false);
  });

  it("a private rating is for the CEO and its writer; a writer changes theirs for 24 hours, the CEO any time", () => {
    const r = { private: true, rater_id: 3, created_at: new Date(Date.now() - 2 * 3_600_000).toISOString() };
    expect(rules.canSeeRating({ id: 4, role: "lead" }, r)).toBe(false);
    expect(rules.canSeeRating({ id: 3, role: "monitor" }, r)).toBe(true);
    expect(rules.canSeeRating({ id: 1, role: "ceo" }, r)).toBe(true);
    expect(rules.canChangeRating({ id: 3, role: "monitor" }, r, new Date())).toBe(true);
    const old = { ...r, created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() };
    expect(rules.canChangeRating({ id: 3, role: "monitor" }, old, new Date())).toBe(false);
    expect(rules.canChangeRating({ id: 1, role: "ceo" }, old, new Date())).toBe(true);
    expect(rules.canChangeRating({ id: 2, role: "pm" }, r, new Date())).toBe(false);
  });

  it("the form's checks: a score 1–5, a known kind, a reason of 1–1000 letters, a period in order", () => {
    expect(rules.ratingProblems(good)).toEqual({});
    expect(Object.keys(rules.ratingProblems({ score: 6, reason_type: "x" as never, reason: "  " })).sort()).toEqual(["reason", "reason_type", "score"]);
    expect(rules.ratingProblems({ ...good, reason: "a".repeat(1001) })).toHaveProperty("reason");
    expect(rules.ratingProblems({ ...good, period: { from: "2026-11-10", to: "2026-11-01" } })).toHaveProperty("period");
  });

  it("the numbers: the average, the last 90 days against before, the kinds and the scores", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    const s = rules.summarize(
      [
        { score: 3, reason_type: "deadlines", created_at: at(130) },
        { score: 3, reason_type: "quality", created_at: at(100) },
        { score: 4, reason_type: "other", created_at: at(30) },
        { score: 5, reason_type: "other", created_at: at(2) },
      ],
      now,
    );
    expect(s).toMatchObject({ count: 4, average: 3.8, recent: { count: 2, average: 4.5 }, before: { count: 2, average: 3 }, by_score: [0, 0, 2, 1, 1] });
    expect(s.by_type).toMatchObject({ other: 2, quality: 1, deadlines: 1, incident: 0 });
    expect(s.last).toMatchObject({ score: 5 });
    expect(rules.trendOf(s)).toBe(1.5);
    expect(rules.summarize([], now)).toMatchObject({ count: 0, average: null });
  });
});

describe("the demo backend: teams", () => {
  it("the monitoring officer rates any team, for another reason; the leader is told", async () => {
    as(3);
    const r = await api.rate(OTHER_TEAM, good);
    expect(r).toMatchObject({ subject_type: "team", subject_id: 2, rater_id: 3, score: 4, reason_type: "other", private: false });
    const team1 = await api.rate(TEAM, { ...good, reason_type: "incident", project_id: 1 });
    expect(team1).toMatchObject({ project_id: 1, project_name: "منصة الحجز الإلكتروني" });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 4, kind: "team_rated", team_id: 1, data: { score: "4", team_name: "فريق التطوير" } });
  });

  it("a private rating: nobody is told, and only the CEO and its writer read it", async () => {
    as(3);
    const before = getDb().notifications.length;
    const r = await api.rate(TEAM, { ...good, private: true });
    expect(getDb().notifications.length).toBe(before);
    as(4);
    expect((await api.ratings(TEAM)).items.map((x) => x.id)).not.toContain(r.id);
    as(2);
    expect((await api.ratings(TEAM)).items.map((x) => x.id)).not.toContain(r.id);
    as(1);
    expect((await api.ratings(TEAM)).items.map((x) => x.id)).toContain(r.id);
    // The seeded private one (id 5) too: the leader sees the four others, the CEO all five.
    as(4);
    expect((await api.ratings(TEAM)).items.map((x) => x.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it("a PM rates the teams in their projects only; leaders and employees can't (403)", async () => {
    as(2);
    expect(await api.rate(TEAM, good)).toMatchObject({ rater_id: 2 });
    expect((await fails(api.rate(OTHER_TEAM, good)))?.status).toBe(403);
    as(4);
    expect((await fails(api.rate(TEAM, good)))?.status).toBe(403);
    as(5);
    expect((await fails(api.rate(TEAM, good)))?.status).toBe(403);
    expect((await api.ratings(TEAM)).can_rate).toBe(false);
  });

  it("a team you may not see is 404; the admin sees the team but not its ratings (403)", async () => {
    as(5);
    expect((await fails(api.team(2)))?.status).toBe(404);
    expect((await api.teams()).map((r) => r.team.id)).toEqual([1]);
    as(8);
    expect((await api.team(1)).can_see_ratings).toBe(false);
    expect((await fails(api.ratings(TEAM)))?.status).toBe(403);
    expect((await api.teams()).every((r) => r.ratings === null && !r.can_rate)).toBe(true);
  });

  it("each field's problem comes back at once (422)", async () => {
    as(3);
    const e = await fails(api.rate(TEAM, { score: 0, reason_type: "nope" as never, reason: "" }));
    expect(e?.status).toBe(422);
    expect(Object.keys(e?.errors ?? {}).sort()).toEqual(["reason", "reason_type", "score"]);
    expect((await fails(api.rate(TEAM, { ...good, project_id: 999 })))?.errors).toHaveProperty("project_id");
  });

  it("the list and the team page: members, the leader first, the numbers and the trend", async () => {
    as(3);
    const detail = await api.team(1);
    expect(detail.members[0].id).toBe(4);
    expect(detail.members.map((m) => m.id).sort()).toEqual([4, 5, 6, 7]);
    expect(detail.tasks?.open).toBeGreaterThan(0);
    const row = (await api.teams()).find((r) => r.team.id === 1)!;
    expect(row).toMatchObject({ member_count: 4, can_rate: true, ratings: { count: 5 } });
    as(5);
    expect((await api.team(1)).tasks).toBeNull(); // an employee sees the people, not the numbers
  });
});

describe("the demo backend: people, changes and removals", () => {
  it("the monitoring officer rates Sara; Sara reads it and is told; a private one she never sees", async () => {
    as(3);
    const seen = await api.rate(SARA, { ...good, reason: "ساعدت زميلها في إغلاق خطأ عاجل." });
    expect(getDb().notifications.at(-1)).toMatchObject({ user_id: 5, kind: "person_rated", data: { score: "4" } });
    const hidden = await api.rate(SARA, { ...good, private: true });
    as(5);
    const mine = await api.ratings(SARA);
    expect(mine.items.map((r) => r.id)).toContain(seen.id);
    expect(mine.items.map((r) => r.id)).not.toContain(hidden.id);
    expect(mine.can_rate).toBe(false);
    // Another employee can't read Sara's.
    as(6);
    expect((await fails(api.ratings(SARA)))?.status).toBe(403);
  });

  it("a PM rates the people in their projects only; nobody rates themselves", async () => {
    as(2);
    expect(await api.rate(SARA, good)).toMatchObject({ subject_type: "person", subject_id: 5 });
    expect((await fails(api.rate({ type: "person", id: 9 }, good)))?.status).toBe(403);
    as(3);
    expect((await fails(api.rate({ type: "person", id: 3 }, good)))?.status).toBe(403);
    expect((await fails(api.rate({ type: "person", id: 99 }, good)))?.status).toBe(404);
    expect((await api.people()).find((r) => r.user_id === 5)?.ratings.count).toBe(3);
  });

  it("its writer changes or removes it for 24 hours, then it stays (409)", async () => {
    as(3);
    const r = await api.rate(TEAM, good);
    expect(await api.updateRating(r.id, { ...good, score: 5 })).toMatchObject({ score: 5, edited_at: expect.any(String) });
    const old = getDb().ratings.find((x) => x.id === r.id) as Rating;
    old.created_at = new Date(Date.now() - 25 * 3_600_000).toISOString();
    expect((await fails(api.updateRating(r.id, good)))?.status).toBe(409);
    expect((await fails(api.deleteRating(r.id)))?.status).toBe(409);
    // The PM can read it but it isn't theirs (403).
    as(2);
    expect((await fails(api.deleteRating(r.id)))?.status).toBe(403);
  });

  it("the CEO removes any rating, at any time, and the audit log keeps what it said", async () => {
    as(1);
    await api.deleteRating(4);
    expect(getDb().ratings.some((r) => r.id === 4)).toBe(false);
    expect(getDb().audit.at(-1)).toMatchObject({ actor_id: 1, action: "rating_deleted", target: { type: "team", id: 1 } });
    expect(getDb().audit.at(-1)?.changes?.find((c) => c.field === "rater")?.from).toBe("هدى ناصر");
    // Changing someone else's is logged too, and marked as changed by her.
    const changed = await api.updateRating(3, { ...good, score: 2 });
    expect(changed).toMatchObject({ edited_by: 1, rater_id: 2 });
    expect(getDb().audit.at(-1)).toMatchObject({ action: "rating_changed" });
  });

  it("a custom role without «Quick ratings» can't rate (403), even as monitoring", async () => {
    const db = getDb();
    db.advanced = { roles: [{ key: "role-x", name: "مراقب", name_en: "Observer", color: "todo", base: "monitor", actions: [], pages: [] }] };
    db.users.find((u) => u.id === 3)!.custom_role = "role-x";
    as(3);
    expect((await fails(api.rate(TEAM, good)))?.status).toBe(403);
    expect((await api.ratings(TEAM)).can_rate).toBe(false);
  });
});
