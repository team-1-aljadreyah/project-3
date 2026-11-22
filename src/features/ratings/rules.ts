// Quick ratings of teams and people: who sees a team, who rates whom, who reads which rating, the checks on a rating and
// the numbers of a set of ratings. Pure functions: the pages show only what a person may do, and the demo backend
// refuses the rest with the SAME functions (the real server must keep them, docs/backend.md section 21).
//
// The client (22 November 2026): "add a rating system for teams, and make sure the monitor can rate for whatever
// reason", then "here [the performance page] it should be able to give a rating as a monitor". Assumptions, written in
// docs/backend.md: the monitoring officer and the CEO rate any team and any person, any time; a project manager rates
// the teams that work in their projects and the people in their projects; team leaders and employees don't rate. A
// team's people read their team's ratings that aren't private, and a person reads the ones about themselves that
// aren't private (read only). The admin sees the team page (its members), not ratings (they are about work).
import type { Role, StatusTone, Team, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { Average, Rating, RatingInput, RatingSummary, ReasonType } from "./types";

type U = Pick<User, "id" | "role" | "team_id">;
type Member = Pick<User, "id" | "team_id" | "active">;
type Projects = { pm_id: number; member_ids: number[] }[];

export const RATING_LIMITS = { reason: 1000, editHours: 24, trendDays: 90 };

/** The five steps of the scale, lowest first. */
export const SCORES = [1, 2, 3, 4, 5] as const;

export const SCORE_WORDS: Record<number, { ar: string; en: string }> = {
  1: { ar: "ضعيف", en: "Poor" },
  2: { ar: "مقبول", en: "Fair" },
  3: { ar: "جيد", en: "Good" },
  4: { ar: "جيد جداً", en: "Very good" },
  5: { ar: "ممتاز", en: "Excellent" },
};

/** The reason types in the order the form shows them ("other" last, always there), with a colour family each. */
export const REASON_TYPES: ReasonType[] = ["quality", "deadlines", "teamwork", "attitude", "incident", "other"];

export const REASON_WORDS: Record<ReasonType, { ar: string; en: string; tone: StatusTone }> = {
  quality: { ar: "جودة العمل", en: "Quality of work", tone: "testing" },
  deadlines: { ar: "الالتزام بالمواعيد", en: "Meeting deadlines", tone: "review" },
  teamwork: { ar: "التعاون والتواصل", en: "Teamwork and communication", tone: "todo" },
  attitude: { ar: "السلوك والانضباط", en: "Attitude and discipline", tone: "progress" },
  incident: { ar: "موقف أو حادثة", en: "An incident", tone: "blocked" },
  other: { ar: "سبب آخر", en: "Another reason", tone: "new" },
};

// ---------- teams ----------

/** The team's active members (the leader is one: a team's leader joins it). */
export const membersOf = <T extends Member>(team: Pick<Team, "id">, users: T[]) => users.filter((u) => u.active && u.team_id === team.id);

/** Does a member of this team work in a project `pmId` runs? */
export function worksForPm(pmId: number, team: Pick<Team, "id">, users: Member[], projects: Projects) {
  const ids = new Set(membersOf(team, users).map((u) => u.id));
  return projects.some((p) => p.pm_id === pmId && p.member_ids.some((id) => ids.has(id)));
}

/** The team page (name, leader, members): management, monitoring, PMs and the admin see every team; others their own. */
export const canSeeTeam = (user: U, team: Pick<Team, "id">) => isCeo(user) || ["monitor", "pm", "admin"].includes(user.role) || (!!user.team_id && user.team_id === team.id);

/** The jobs that give quick ratings at all (the Teams menu item, the "Rate" buttons): monitoring, PMs and the CEO. */
export const canGiveRatings = (user: Pick<User, "role">) => isCeo(user) || user.role === "monitor" || user.role === "pm";

/** May `user` rate this team? Monitoring and the CEO any team, any time; a PM the teams that work in their projects. */
export function canRateTeam(user: U, team: Pick<Team, "id">, users: Member[], projects: Projects) {
  if (isCeo(user) || user.role === "monitor") return true;
  return user.role === "pm" && worksForPm(user.id, team, users, projects);
}

/** May `user` read this team's ratings? Whoever may rate it, and the team's own people (read only). */
export function canSeeTeamRatings(user: U, team: Pick<Team, "id">, users: Member[], projects: Projects) {
  return isCeo(user) || canRateTeam(user, team, users, projects) || (user.role !== "admin" && !!user.team_id && user.team_id === team.id);
}

// ---------- people ----------

/** The people a quick rating can be about: the working jobs (never the CEO or the system admin). */
const RATED_ROLES: Role[] = ["pm", "monitor", "lead", "employee"];

/** May `user` rate this person? Never themselves. Monitoring and the CEO anyone; a PM the people in their projects. */
export function canRatePerson(user: Pick<User, "id" | "role">, person: Pick<User, "id" | "role">, projects: Projects) {
  if (user.id === person.id || !RATED_ROLES.includes(person.role)) return false;
  if (isCeo(user) || user.role === "monitor") return true;
  return user.role === "pm" && projects.some((p) => p.pm_id === user.id && p.member_ids.includes(person.id));
}

/** May `user` read the ratings about this person? Whoever may rate them, and the person themselves (read only). */
export const canSeePersonRatings = (user: Pick<User, "id" | "role">, person: Pick<User, "id" | "role">, projects: Projects) =>
  isCeo(user) || canRatePerson(user, person, projects) || user.id === person.id;

// ---------- one rating ----------

/** Of the ratings the person may read: a private one only for the CEO and its rater. */
export const canSeeRating = (user: Pick<User, "id" | "role">, rating: Pick<Rating, "private" | "rater_id">) => isCeo(user) || !rating.private || rating.rater_id === user.id;

/** Is a rating still inside its writer's time to change it (24 hours from when it was written)? */
export const inEditWindow = (rating: Pick<Rating, "created_at">, now: Date) => now.getTime() - new Date(rating.created_at).getTime() < RATING_LIMITS.editHours * 3_600_000;

/**
 * May `user` change or remove this rating? Its writer for 24 hours, then it stays as history. The CEO any rating, any
 * time (the CEO rule; the server writes it in the audit log when it isn't her own).
 */
export const canChangeRating = (user: Pick<User, "id" | "role">, rating: Pick<Rating, "rater_id" | "created_at">, now: Date) =>
  isCeo(user) || (rating.rater_id === user.id && inEditWindow(rating, now));

/** The milliseconds left for its writer to change it (0 when the time is over). */
export const editTimeLeft = (rating: Pick<Rating, "created_at">, now: Date) =>
  Math.max(0, new Date(rating.created_at).getTime() + RATING_LIMITS.editHours * 3_600_000 - now.getTime());

const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The checks of a rating's form, the same on the page and on the server: each field's problem in both languages. */
export function ratingProblems(input: Partial<RatingInput>): Record<string, { ar: string; en: string }> {
  const e: Record<string, { ar: string; en: string }> = {};
  if (!Number.isInteger(input.score) || (input.score as number) < 1 || (input.score as number) > 5) e.score = { ar: "اختر درجة من 1 إلى 5.", en: "Choose a score from 1 to 5." };
  if (!input.reason_type || !REASON_TYPES.includes(input.reason_type)) e.reason_type = { ar: "اختر نوع السبب.", en: "Choose the kind of reason." };
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) e.reason = { ar: "اكتب سبب التقييم بكلماتك.", en: "Write the reason in your own words." };
  else if (reason.length > RATING_LIMITS.reason) e.reason = { ar: `السبب حتى ${RATING_LIMITS.reason} حرف.`, en: `The reason is up to ${RATING_LIMITS.reason} letters.` };
  const p = input.period;
  if (p) {
    if (!isDay(p.from) || !isDay(p.to)) e.period = { ar: "اختر بداية الفترة ونهايتها، أو اتركهما فارغتين.", en: "Choose the period's start and end, or leave both empty." };
    else if (p.from > p.to) e.period = { ar: "بداية الفترة بعد نهايتها.", en: "The period starts after it ends." };
  }
  if (input.project_id !== undefined && input.project_id !== null && !Number.isInteger(input.project_id)) e.project_id = { ar: "اختر مشروعاً من القائمة.", en: "Choose a project from the list." };
  if (input.private !== undefined && typeof input.private !== "boolean") e.private = { ar: "خاص أو ظاهر.", en: "Private or visible." };
  return e;
}

// ---------- numbers ----------

const averageOf = (list: Pick<Rating, "score">[]): Average => ({
  count: list.length,
  average: list.length ? Math.round((list.reduce((s, r) => s + r.score, 0) / list.length) * 10) / 10 : null,
});

/**
 * Ratings in numbers: the average (one decimal), the last 90 days against everything before (the trend), the count of
 * each reason type and score, and the newest. Over the ratings given (the ones the viewer may see).
 */
export function summarize(ratings: Pick<Rating, "score" | "reason_type" | "created_at">[], now: Date): RatingSummary {
  const since = now.getTime() - RATING_LIMITS.trendDays * 86_400_000;
  const recent = ratings.filter((r) => new Date(r.created_at).getTime() >= since);
  const before = ratings.filter((r) => new Date(r.created_at).getTime() < since);
  const by_type = Object.fromEntries(REASON_TYPES.map((t) => [t, ratings.filter((r) => r.reason_type === t).length])) as Record<ReasonType, number>;
  const by_score = SCORES.map((s) => ratings.filter((r) => r.score === s).length) as RatingSummary["by_score"];
  const newest = [...ratings].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    ...averageOf(ratings),
    recent: averageOf(recent),
    before: averageOf(before),
    by_type,
    by_score,
    last: newest ? { score: newest.score, reason_type: newest.reason_type, created_at: newest.created_at } : undefined,
  };
}

/** The trend: the last 90 days' average minus the one before them (null when either has no rating). */
export const trendOf = (s: Pick<RatingSummary, "recent" | "before">) =>
  s.recent.average === null || s.before.average === null ? null : Math.round((s.recent.average - s.before.average) * 10) / 10;

/** The step a (possibly decimal) average sits on: 4.4 → 4 «Very good». */
export const scoreStep = (average: number) => Math.min(5, Math.max(1, Math.round(average)));
