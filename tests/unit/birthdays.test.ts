// Birthdays (docs/backend.md section 20): the date maths of the reminders, the checks on a birth date, who may see the
// year, and the demo backend making each reminder once, for the monitoring officers and the CEO.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/errors";
import type { User } from "@/shared/api/types";
import { canSeeBirthDate } from "@/shared/lib/access";
import {
  ageOn,
  birthDateProblem,
  birthDateRange,
  birthdayIn,
  birthdayReminder,
  birthdayView,
  isBirthday,
  nextBirthday,
  upcomingBirthdays,
} from "@/shared/lib/birthday";
import { today } from "@/shared/lib/utils";

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

const { notificationsMock } = await import("@/features/notifications/mock");
const { authMock } = await import("@/features/auth/mock");
const { adminMock } = await import("@/features/admin/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader (birthday in 7 days), 5 Sara (birthday today), 6–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const birthdaysOf = (userId: number) =>
  getDb()
    .notifications.filter((n) => n.user_id === userId && (n.kind === "birthday_soon" || n.kind === "birthday_today"))
    .map((n) => `${n.kind}:${n.data.person_id}`)
    .sort();

const person = (id: number, birth_date?: string, extra: Partial<User> = {}): User => ({ id, name: `P${id}`, email: `p${id}@x.test`, role: "employee", title: "", active: true, birth_date, ...extra });

describe("the date maths", () => {
  it("29 February falls on 28 February in a year without one", () => {
    expect(birthdayIn("1992-02-29", 2027)).toBe("2027-02-28");
    expect(birthdayIn("1992-02-29", 2028)).toBe("2028-02-29");
    expect(birthdayIn("1995-12-10", 2026)).toBe("2026-12-10");
    expect(nextBirthday("1992-02-29", "2027-03-01")).toEqual({ date: "2028-02-29", days: 365 });
  });

  it("the next birthday is today, later this year, or next year", () => {
    expect(nextBirthday("1998-11-22", "2026-11-22")).toEqual({ date: "2026-11-22", days: 0 });
    expect(nextBirthday("1998-11-29", "2026-11-22")).toEqual({ date: "2026-11-29", days: 7 });
    expect(nextBirthday("1998-11-21", "2026-11-22")).toEqual({ date: "2027-11-21", days: 364 });
  });

  it("reminds on the day and exactly a week before, also across the year end", () => {
    expect(birthdayReminder("1998-11-22", "2026-11-22")).toEqual({ kind: "birthday_today", date: "2026-11-22" });
    expect(birthdayReminder("1998-11-29", "2026-11-22")).toEqual({ kind: "birthday_soon", date: "2026-11-29" });
    // A 3 January birthday is reminded on 27 December, for the next year's day.
    expect(birthdayReminder("1998-01-03", "2026-12-27")).toEqual({ kind: "birthday_soon", date: "2027-01-03" });
    expect(birthdayReminder("1998-01-03", "2027-01-03")).toEqual({ kind: "birthday_today", date: "2027-01-03" });
    // 29 February: on 28 February without a leap year, and a week before that day.
    expect(birthdayReminder("1992-02-29", "2027-02-21")).toEqual({ kind: "birthday_soon", date: "2027-02-28" });
    expect(birthdayReminder("1992-02-29", "2027-02-28")).toEqual({ kind: "birthday_today", date: "2027-02-28" });
    expect(birthdayReminder("1992-02-29", "2028-02-22")).toEqual({ kind: "birthday_soon", date: "2028-02-29" });
    // Any other day: nothing.
    for (const day of ["2026-11-21", "2026-11-23", "2026-11-28", "2026-11-30"]) expect(birthdayReminder("1998-11-22", day)).toBeNull();
    for (const day of ["2026-11-21", "2026-11-23"]) expect(birthdayReminder("1998-11-29", day)).toBeNull();
  });

  it("counts the age in whole years and knows a birthday by day and month", () => {
    expect(ageOn("1998-11-22", "2026-11-22")).toBe(28);
    expect(ageOn("1998-11-23", "2026-11-22")).toBe(27);
    expect(isBirthday({ birthday: "11-22" }, "2026-11-22")).toBe(true);
    expect(isBirthday({ birth_date: "1992-02-29" }, "2027-02-28")).toBe(true);
    expect(isBirthday({}, "2026-11-22")).toBe(false);
  });

  it("lists the next 30 days' birthdays of active people, today first", () => {
    const people = [person(1, "1990-12-30"), person(2, "1990-11-22"), person(3, "1990-11-25", { active: false }), person(4), { ...person(5), birthday: "11-29" }, person(6, "1990-12-23")];
    expect(upcomingBirthdays(people, "2026-11-22").map((r) => [r.person.id, r.days])).toEqual([[2, 0], [5, 7]]);
    expect(upcomingBirthdays(people, "2026-11-22", 31).map((r) => r.person.id)).toEqual([2, 5, 6]);
  });
});

describe("the checks on a birth date", () => {
  it("a real day, not in the future, an age from 16 to 80", () => {
    const day = "2026-11-22";
    expect(birthDateProblem("1990-04-21", day)).toBeNull();
    expect(birthDateProblem("2026-02-30", day)).toBe("date");
    expect(birthDateProblem("21/04/1990", day)).toBe("date");
    expect(birthDateProblem(19900421, day)).toBe("date");
    expect(birthDateProblem("2026-11-23", day)).toBe("future");
    expect(birthDateProblem("2010-11-22", day)).toBeNull(); // 16 today
    expect(birthDateProblem("2010-11-23", day)).toBe("young");
    expect(birthDateProblem("1945-11-23", day)).toBeNull(); // 80, 81 tomorrow
    expect(birthDateProblem("1945-11-22", day)).toBe("old");
  });

  it("the date picker's range is exactly the allowed days", () => {
    const day = "2026-11-22";
    const { min, max } = birthDateRange(day);
    expect([min, max]).toEqual(["1945-11-23", "2010-11-22"]);
    expect(birthDateRange("2028-02-29")).toEqual({ min: "1947-03-01", max: "2012-02-29" });
  });

  it("the server refuses a wrong birth date with 422 on birth_date, keeps a good one, and clears it with null", async () => {
    setDbForTests(seed());
    as(8);
    for (const bad of ["2026-02-30", today(1), "2020-01-01", "1900-01-01"]) {
      const e = await fails(adminMock.updateUser(6, { birth_date: bad }));
      expect(e?.status).toBe(422);
      expect(e?.errors).toHaveProperty("birth_date");
    }
    expect((await fails(adminMock.createUser({ name: "ليلى", email: "laila@demo.test", role: "employee", title: "", birth_date: today(1), password: "Start-Pass-1" })))?.errors).toHaveProperty("birth_date");
    await adminMock.updateUser(6, { birth_date: "1994-03-07" });
    expect(getDb().users.find((u) => u.id === 6)!.birth_date).toBe("1994-03-07");
    // The audit log says the field changed, never the dates themselves.
    expect(getDb().audit.at(-1)!.changes).toEqual([{ field: "birth_date" }]);
    await adminMock.updateUser(6, { birth_date: null });
    expect(getDb().users.find((u) => u.id === 6)!.birth_date).toBeUndefined();
    // Optional: an account without one is fine.
    const added = await adminMock.createUser({ name: "ليلى", email: "laila@demo.test", role: "employee", title: "", password: "Start-Pass-1" });
    expect(added.birth_date).toBeUndefined();
  });
});

describe("the privacy rule: the year only for the person, the admin and the CEO", () => {
  const sara = person(5, "1998-11-22");
  it("canSeeBirthDate and birthdayView", () => {
    expect(canSeeBirthDate({ id: 5, role: "employee" }, sara)).toBe(true);
    expect(canSeeBirthDate({ id: 8, role: "admin" }, sara)).toBe(true);
    expect(canSeeBirthDate({ id: 1, role: "ceo" }, sara)).toBe(true);
    for (const role of ["pm", "monitor", "lead", "employee"] as const) expect(canSeeBirthDate({ id: 2, role }, sara)).toBe(false);

    const colleague = birthdayView({ id: 6, role: "employee" }, sara);
    expect(colleague.birth_date).toBeUndefined();
    expect(colleague.birthday).toBe("11-22");
    expect(JSON.stringify(colleague)).not.toContain("1998");
    expect(birthdayView({ id: 3, role: "monitor" }, sara).birth_date).toBeUndefined();
    expect(birthdayView({ id: 5, role: "employee" }, sara)).toMatchObject({ birth_date: "1998-11-22", birthday: "11-22" });
    expect(birthdayView({ id: 1, role: "ceo" }, sara)).toMatchObject({ birth_date: "1998-11-22" });
    expect(birthdayView({ id: 6, role: "employee" }, person(7)).birthday).toBeUndefined();
  });

  it("GET /users: colleagues get the day and month only; the admin and the CEO the full date; /me has your own", async () => {
    setDbForTests(seed());
    as(6);
    const seen = await authMock.users();
    expect(seen.every((u) => u.birthday?.length === 5)).toBe(true);
    expect(seen.filter((u) => u.birth_date).map((u) => u.id)).toEqual([6]);
    const years = getDb().users.filter((u) => u.id !== 6).map((u) => u.birth_date!.slice(0, 4));
    const others = JSON.stringify(seen.filter((u) => u.id !== 6));
    for (const y of years) expect(others).not.toContain(`${y}-`);
    expect((await authMock.me()).birth_date).toBe(getDb().users.find((u) => u.id === 6)!.birth_date);
    as(3); // monitoring: reminded of birthdays, but still no years
    expect((await authMock.users()).filter((u) => u.birth_date).map((u) => u.id)).toEqual([3]);
    for (const id of [8, 1]) {
      as(id);
      expect((await authMock.users()).every((u) => u.birth_date)).toBe(true);
    }
    as(8);
    expect((await adminMock.users()).every((u) => u.birth_date && u.birthday)).toBe(true);
  });
});

describe("the demo makes the reminders", () => {
  beforeEach(() => {
    store.clear();
    setDbForTests(seed());
  });
  afterEach(() => vi.useRealTimers());

  it("the monitor and the CEO are told once: Sara today, Mustafa in a week; nobody else", async () => {
    as(3);
    await notificationsMock.notifications();
    expect(birthdaysOf(3)).toEqual(["birthday_soon:4", "birthday_today:5"]);
    const n = getDb().notifications.find((x) => x.user_id === 3 && x.kind === "birthday_today")!;
    expect(n.data).toMatchObject({ person_id: 5, person_name: "سارة علي", person_name_en: "Sara Ali", due: today() });
    expect(n.actor_id).toBeUndefined();
    // Opening the list again (a reload) sends nothing new.
    await notificationsMock.notifications();
    await notificationsMock.notifications();
    expect(birthdaysOf(3)).toEqual(["birthday_soon:4", "birthday_today:5"]);
    as(1);
    await notificationsMock.notifications();
    expect(birthdaysOf(1)).toEqual(["birthday_soon:4", "birthday_today:5"]);
    for (const id of [2, 4, 5, 6, 8]) {
      as(id);
      await notificationsMock.notifications();
      expect(birthdaysOf(id)).toEqual([]);
    }
  });

  it("never about yourself or a stopped account; a person's choice and the CEO's table turn them off", async () => {
    const db = getDb();
    db.users.find((u) => u.id === 4)!.active = false;
    db.users.find((u) => u.id === 3)!.birth_date = db.users.find((u) => u.id === 5)!.birth_date;
    db.users.push({ id: 9, name: "رنا", email: "rana@demo.test", role: "monitor", title: "", active: true, birth_date: "1990-01-01" });
    as(3);
    await notificationsMock.notifications();
    expect(birthdaysOf(3)).toEqual(["birthday_today:5"]);
    // The other monitor hears about both of today's birthdays (Sara and Huda).
    as(9);
    await notificationsMock.savePrefs({ birthday_soon: false });
    await notificationsMock.notifications();
    expect(birthdaysOf(9)).toEqual(["birthday_today:3", "birthday_today:5"]);
    await notificationsMock.savePrefs({ birthday_today: false });
    // The CEO unticks her own job for both kinds in the notification table.
    db.advanced = { notify: { birthday_soon: ["monitor"], birthday_today: ["monitor"] } as never };
    as(1);
    await notificationsMock.notifications();
    expect(birthdaysOf(1)).toEqual([]);
  });

  it("across the year end: on 27 December the monitor hears of a 3 January birthday, once, then on the day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 11, 27, 9, 0));
    setDbForTests(seed());
    // Zainab's invented birthday is 3 January.
    as(3);
    await notificationsMock.notifications();
    await notificationsMock.notifications();
    expect(getDb().notifications.filter((n) => n.user_id === 3 && n.kind === "birthday_soon" && n.data.person_id === 7).map((n) => n.data.due)).toEqual(["2027-01-03"]);
    vi.setSystemTime(new Date(2027, 0, 3, 9, 0));
    await notificationsMock.notifications();
    expect(getDb().notifications.filter((n) => n.user_id === 3 && n.data.person_id === 7).map((n) => `${n.kind}:${n.data.due}`)).toEqual(["birthday_soon:2027-01-03", "birthday_today:2027-01-03"]);
  });

  it("29 February in a year without one: reminded on 21 and 28 February", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 1, 21, 9, 0));
    setDbForTests(seed());
    // Huda (the monitor) was born on 29 February: the CEO is told.
    as(1);
    await notificationsMock.notifications();
    expect(getDb().notifications.filter((n) => n.user_id === 1 && n.data.person_id === 3).map((n) => `${n.kind}:${n.data.due}`)).toEqual(["birthday_soon:2027-02-28"]);
    vi.setSystemTime(new Date(2027, 1, 28, 9, 0));
    await notificationsMock.notifications();
    expect(getDb().notifications.filter((n) => n.user_id === 1 && n.data.person_id === 3).map((n) => n.kind)).toEqual(["birthday_soon", "birthday_today"]);
  });
});
