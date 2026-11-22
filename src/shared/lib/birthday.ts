// Birthdays: the date maths of the reminders and the dashboard card, and who may see the year. Pure functions (no React),
// shared because the demo server (src/mock), the dashboard (features/reports) and the welcome splash (shared/shell) all
// use them. The real server must do the same (docs/backend.md section 20).
import type { User } from "../api/types";
import { canSeeBirthDate } from "./access";
import { daysBetween } from "./utils";

/** The "soon" reminder comes this many days before the birthday (the client: "also notified a week before"). */
export const BIRTHDAY_SOON_DAYS = 7;

/** The dashboard card looks this many days ahead. */
export const UPCOMING_DAYS = 30;

/** The youngest and oldest age an account's birth date may give (the admin's form and the server check it). */
export const BIRTH_AGE = { min: 16, max: 80 };

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number) => String(n).padStart(2, "0");

/** The day and month of a birth date: "1994-03-07" → "03-07". An "MM-DD" stays as it is. */
export const monthDay = (birth: string) => birth.slice(-5);

/**
 * The day the birthday falls on in `year` ("YYYY-MM-DD"). 29 February falls on 28 February in a year without one, so
 * those people are still reminded (and on the right side of the month end).
 */
export function birthdayIn(birth: string, year: number) {
  const md = monthDay(birth);
  if (md === "02-29" && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${md}`;
}

/** The next birthday on or after `day` (both "YYYY-MM-DD"), and how many days away it is (0 = today). */
export function nextBirthday(birth: string, day: string) {
  const year = Number(day.slice(0, 4));
  let date = birthdayIn(birth, year);
  if (date < day) date = birthdayIn(birth, year + 1);
  return { date, days: daysBetween(day, date) };
}

/**
 * Which reminder `day` brings for this birthday: "birthday_today" on the day, "birthday_soon" exactly a week before
 * (across the year end too: a 3 January birthday is reminded on 27 December), else none.
 */
export function birthdayReminder(birth: string, day: string) {
  const { date, days } = nextBirthday(birth, day);
  if (days === 0) return { kind: "birthday_today" as const, date };
  if (days === BIRTHDAY_SOON_DAYS) return { kind: "birthday_soon" as const, date };
  return null;
}

/** Whole years from the birth date to `day`. */
export function ageOn(birthDate: string, day: string) {
  const years = Number(day.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return day.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

/** A real calendar day written "YYYY-MM-DD" (not 2026-02-30). */
export function isRealDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** What is wrong with a birth date on `day`, or null when it is fine: not a date, in the future, too young or too old. */
export function birthDateProblem(value: unknown, day: string): "date" | "future" | "young" | "old" | null {
  if (!isRealDay(value)) return "date";
  if (value > day) return "future";
  const age = ageOn(value, day);
  if (age < BIRTH_AGE.min) return "young";
  if (age > BIRTH_AGE.max) return "old";
  return null;
}

/** The earliest and latest birth date the form allows on `day` (for the date picker's min and max). */
export function birthDateRange(day: string) {
  const year = Number(day.slice(0, 4));
  // 16 years ago today is the last day allowed; the day after "81 years ago today" is the first.
  const latest = birthdayIn(day, year - BIRTH_AGE.min);
  const oldest = new Date(`${birthdayIn(day, year - BIRTH_AGE.max - 1)}T00:00:00`);
  oldest.setDate(oldest.getDate() + 1);
  return { min: `${oldest.getFullYear()}-${pad(oldest.getMonth() + 1)}-${pad(oldest.getDate())}`, max: latest };
}

/**
 * THE PRIVACY RULE, in one place: what `viewer` may see of `person`'s birthday. Everyone gets `birthday` ("MM-DD");
 * the full `birth_date` (with the year, and so the age) only the person themself, the admin and the CEO
 * (canSeeBirthDate). The real `GET /users` must answer the same.
 */
export function birthdayView<T extends User>(viewer: Pick<User, "id" | "role">, person: T): T {
  const { birth_date, ...rest } = person;
  if (!birth_date) return { ...rest, birthday: undefined } as T;
  return (canSeeBirthDate(viewer, person) ? { ...rest, birth_date, birthday: monthDay(birth_date) } : { ...rest, birthday: monthDay(birth_date) }) as T;
}

/** The person's birthday, from what this viewer has: the day and month, or nothing. */
export const birthdayOf = (person: Pick<User, "birth_date" | "birthday">) => person.birthday ?? (person.birth_date ? monthDay(person.birth_date) : undefined);

/** The active people whose birthday is within `within` days of `day` (today first), soonest first, then by name. */
export function upcomingBirthdays<T extends Pick<User, "id" | "name" | "active" | "birth_date" | "birthday">>(people: T[], day: string, within = UPCOMING_DAYS) {
  return people
    .flatMap((person) => {
      const md = person.active ? birthdayOf(person) : undefined;
      if (!md) return [];
      const next = nextBirthday(md, day);
      return next.days <= within ? [{ person, ...next }] : [];
    })
    .sort((a, b) => a.days - b.days || a.person.name.localeCompare(b.person.name, "ar"));
}

/** Is it this person's birthday on `day`? */
export function isBirthday(person: Pick<User, "birth_date" | "birthday">, day: string) {
  const md = birthdayOf(person);
  return !!md && nextBirthday(md, day).days === 0;
}
