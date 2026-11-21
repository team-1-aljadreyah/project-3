// Announcements on the demo backend, as different people: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
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

const { announcementsMock: api } = await import("@/features/announcements/mock");
const { notificationsMock } = await import("@/features/notifications/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("posting", () => {
  it("the CEO posts; everyone else is notified; the author has seen it", async () => {
    as(1);
    const before = getDb().seq.notification;
    const a = await api.create({ title: "  إجازة رسمية يوم الأحد  ", body: "تُغلق الشركة يوم الأحد.", important: false });
    expect(a).toMatchObject({ title: "إجازة رسمية يوم الأحد", seen: true, seen_count: 1, audience_count: 8 });
    const told = getDb().notifications.filter((n) => n.id > before);
    expect(told.map((n) => n.user_id).sort()).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(told.every((n) => n.kind === "announcement" && n.announcement_id === a.id)).toBe(true);
  });

  it("the monitoring officer posts (the client asked)", async () => {
    as(3);
    expect((await api.create({ title: "زيارة متابعة", body: "", important: false })).author_id).toBe(3);
  });

  it("an employee can't post (403); an empty title is refused (422)", async () => {
    as(5);
    expect((await fails(api.create({ title: "x", body: "", important: false })))?.status).toBe(403);
    as(8);
    expect((await fails(api.create({ title: " ", body: "", important: false })))?.errors).toHaveProperty("title");
  });

  it("the new-announcement notification can't be turned off (the brief: employees must receive it)", async () => {
    as(5);
    expect((await fails(notificationsMock.savePrefs({ announcement: false })))?.errors).toHaveProperty("prefs");
  });
});

describe("reading", () => {
  it("important ones first; each person sees whether they have seen it", async () => {
    as(5);
    const list = await api.announcements();
    expect(list.map((a) => a.id)).toEqual([1, 2]); // 1 is important, though 2 is older and not important
    expect(list.map((a) => a.seen)).toEqual([false, true]);
  });

  it("opening it marks it seen once", async () => {
    as(5);
    await api.markSeen(1);
    await api.markSeen(1);
    const a = await api.announcement(1);
    expect(a.seen).toBe(true);
    expect(a.seen_count).toBe(4); // 1, 2, 4 in the demo data, and now 5
  });
});

describe("who has seen it", () => {
  it("the author and the management see both lists", async () => {
    as(1);
    const r = await api.reads(1);
    expect(r.seen.map((s) => s.user_id)).toEqual([1, 2, 4]);
    expect(r.not_seen).toEqual([3, 5, 6, 7, 8]);
    as(8);
    expect((await api.reads(1)).not_seen).toHaveLength(5);
  });

  it("an employee can't see the lists (403)", async () => {
    as(5);
    expect((await fails(api.reads(1)))?.status).toBe(403);
  });
});

describe("removing", () => {
  it("the author or the management may remove it; an employee may not", async () => {
    as(5);
    expect((await fails(api.remove(2)))?.status).toBe(403);
    as(8);
    await api.remove(2);
    expect((await fails(api.announcement(2)))?.status).toBe(404);
  });
});
