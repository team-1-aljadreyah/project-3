// The demo backend for quick ratings (teams and people) and the team pages, with the rules the real server must keep
// (docs/backend.md, section 20): who may do what comes from ./rules.ts. Only the demo build loads it.
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import { requireAction, roleMay } from "@/mock/site";
import { ApiError } from "@/shared/api/errors";
import type { Team, User } from "@/shared/api/types";
import { canSeeProject, isCeo } from "@/shared/lib/access";
import { currentLocale } from "@/shared/lib/boot";
import { today } from "@/shared/lib/utils";
import type { RatingsApi } from "./api";
import {
  canChangeRating,
  canRatePerson,
  canRateTeam,
  canSeePersonRatings,
  canSeeRating,
  canSeeTeam,
  canSeeTeamRatings,
  membersOf,
  ratingProblems,
  SCORE_WORDS,
  summarize,
} from "./rules";
import type { Rating, RatingInput, Subject, TeamTasks } from "./types";

const NOT_FOUND: [string, string] = ["لم يُعثر على المطلوب.", "Not found."];

/** A team this person may see. Not found and not allowed answer the same (404), so nobody learns which teams exist. */
function teamFor(user: User, id: number): Team {
  const team = getDb().teams.find((t) => t.id === id);
  if (!team || !canSeeTeam(user, team)) return fail(404, "NOT_FOUND", "لم يُعثر على الفريق.", "Team not found.");
  return team;
}

/** A person (everyone's names are public in the company: `GET /users`); unknown → 404. */
function personFor(id: number): User {
  const person = getDb().users.find((u) => u.id === id);
  if (!person) return fail(404, "NOT_FOUND", ...NOT_FOUND);
  return person;
}

/** The subject, and what this person may do with its ratings (the custom role's «Quick ratings» tick included). */
function access(user: User, subject: Subject) {
  const db = getDb();
  if (subject.type === "team") {
    const team = teamFor(user, subject.id);
    return { team, label: team.name, sees: canSeeTeamRatings(user, team, db.users, db.projects), rates: canRateTeam(user, team, db.users, db.projects) };
  }
  const person = personFor(subject.id);
  return { person, label: person.name, sees: canSeePersonRatings(user, person, db.projects), rates: canRatePerson(user, person, db.projects) && person.active };
}

/** The ratings of a subject this person may read, newest first. */
const visibleRatings = (user: User, subject: Subject) =>
  getDb()
    .ratings.filter((r) => r.subject_type === subject.type && r.subject_id === subject.id && canSeeRating(user, r))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

/** A rating this person may read (404 otherwise, the same as one that doesn't exist). */
function ratingFor(user: User, id: number) {
  const rating = getDb().ratings.find((r) => r.id === id);
  if (!rating) return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Rating not found.");
  let a: ReturnType<typeof access>;
  try {
    a = access(user, { type: rating.subject_type, id: rating.subject_id });
  } catch {
    return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Rating not found.");
  }
  if (!a.sees || !canSeeRating(user, rating)) return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Rating not found.");
  return { rating, ...a };
}

/** Every problem of the form at once (422), each under its field, in the person's language. */
function check(user: User, input: RatingInput) {
  const problems = ratingProblems(input);
  // The project it is about must be one this person may see.
  if (input.project_id && !problems.project_id) {
    const project = getDb().projects.find((p) => p.id === input.project_id);
    if (!project || !canSeeProject(user, project)) problems.project_id = { ar: "اختر مشروعاً من القائمة.", en: "Choose a project from the list." };
  }
  const keys = Object.keys(problems);
  if (keys.length) {
    const ar = currentLocale() === "ar";
    const errors = Object.fromEntries(keys.map((k) => [k, ar ? problems[k].ar : problems[k].en]));
    throw new ApiError(422, errors[keys[0]], errors, "VALIDATION");
  }
}

/** The fields a rating keeps from the form (the project's name is copied, so the rating reads right later). */
function fieldsOf(input: RatingInput): Pick<Rating, "score" | "reason_type" | "reason" | "project_id" | "project_name" | "project_name_en" | "period" | "private"> {
  const project = input.project_id ? getDb().projects.find((p) => p.id === input.project_id) : undefined;
  return {
    score: input.score,
    reason_type: input.reason_type,
    reason: input.reason.trim(),
    project_id: project?.id,
    project_name: project?.name,
    project_name_en: project?.name_en,
    period: input.period ? { from: input.period.from, to: input.period.to } : undefined,
    private: input.private === true,
  };
}

/** The team's leader, or the rated person, hears about a rating that isn't private (they may turn it off). */
function tell(rating: Rating, a: ReturnType<typeof access>, actorId: number) {
  if (rating.private) return;
  const data = { score: String(rating.score), note: rating.reason.slice(0, 140) };
  if (a.team) {
    if (a.team.lead_id) notify([a.team.lead_id], "team_rated", { actor_id: actorId, team_id: a.team.id, data: { ...data, team_name: a.team.name, team_name_en: a.team.name_en } });
  } else if (a.person) {
    notify([a.person.id], "person_rated", { actor_id: actorId, data });
  }
}

const scoreText = (score: number) => `${score} ${SCORE_WORDS[score]?.ar ?? ""}`.trim();
const auditTarget = (r: Rating, label: string) => ({ type: r.subject_type === "team" ? ("team" as const) : ("user" as const), id: r.subject_id, label });

/** The members' tasks now, in the projects this person may see (for the jobs that see the reports). */
function teamTasks(user: User, team: Team): TeamTasks | null {
  if (!isCeo(user) && !["pm", "monitor", "lead"].includes(user.role)) return null;
  const db = getDb();
  const ids = new Set(membersOf(team, db.users).map((u) => u.id));
  const projects = new Map(db.projects.filter((p) => canSeeProject(user, p)).map((p) => [p.id, p]));
  const day = today();
  const counts: TeamTasks = { open: 0, late: 0, blocked: 0, done: 0 };
  for (const t of db.tasks) {
    const project = projects.get(t.project_id);
    if (!project || !t.assignee_id || !ids.has(t.assignee_id)) continue;
    const tone = project.statuses.find((s) => s.key === t.status)?.tone;
    if (tone === "done") {
      counts.done++;
      continue;
    }
    counts.open++;
    if (tone === "blocked") counts.blocked++;
    if (t.due && t.due < day) counts.late++;
  }
  return counts;
}

export const ratingsMock: RatingsApi = {
  async teams() {
    const user = currentUser();
    const db = getDb();
    const rows = db.teams
      .filter((t) => canSeeTeam(user, t))
      .map((team) => {
        const a = access(user, { type: "team", id: team.id });
        return {
          team,
          member_count: membersOf(team, db.users).length,
          ratings: a.sees ? summarize(visibleRatings(user, { type: "team", id: team.id }), new Date()) : null,
          can_rate: a.rates && roleMay(user, "give_ratings"),
        };
      });
    return wait(rows);
  },

  async team(id) {
    const user = currentUser();
    const db = getDb();
    const team = teamFor(user, id);
    // The leader first, then the others by name.
    const members = membersOf(team, db.users).sort((a, b) => Number(b.id === team.lead_id) - Number(a.id === team.lead_id) || a.name.localeCompare(b.name, "ar"));
    return wait({ team, members, can_see_ratings: canSeeTeamRatings(user, team, db.users, db.projects), tasks: teamTasks(user, team) });
  },

  async people() {
    const user = currentUser();
    const db = getDb();
    const rows = db.users
      .filter((u) => u.active && canSeePersonRatings(user, u, db.projects) && u.role !== "ceo" && u.role !== "admin")
      .map((u) => ({
        user_id: u.id,
        ratings: summarize(visibleRatings(user, { type: "person", id: u.id }), new Date()),
        can_rate: canRatePerson(user, u, db.projects) && roleMay(user, "give_ratings"),
      }));
    return wait(rows);
  },

  async ratings(subject) {
    const user = currentUser();
    const a = access(user, subject);
    if (!a.sees) return fail(403, "FORBIDDEN", "لا يحق لك رؤية هذه التقييمات.", "You can't see these ratings.");
    return wait({ items: visibleRatings(user, subject), can_rate: a.rates && roleMay(user, "give_ratings") });
  },

  async rate(subject, input) {
    const user = currentUser();
    const db = getDb();
    const a = access(user, subject);
    if (!a.rates) {
      return fail(
        403,
        "FORBIDDEN",
        "يعطي التقييمات السريعة المديرُ التنفيذي ومسؤول المتابعة، ومدير المشروع لفرق مشاريعه وأعضائها. ولا يقيّم أحد نفسه.",
        "Quick ratings are given by the CEO, monitoring, and a PM for the teams and people in their projects. Nobody rates themselves.",
      );
    }
    requireAction(user, "give_ratings");
    check(user, input);
    const rating: Rating = { id: ++db.seq.rating, subject_type: subject.type, subject_id: subject.id, rater_id: user.id, ...fieldsOf(input), created_at: nowIso() };
    db.ratings.push(rating);
    tell(rating, a, user.id);
    commit();
    return wait(rating);
  },

  async updateRating(id, input) {
    const user = currentUser();
    const { rating, ...a } = ratingFor(user, id);
    const now = new Date();
    if (rating.rater_id !== user.id && !canChangeRating(user, rating, now)) return fail(403, "FORBIDDEN", "يعدّل التقييمَ كاتبُه فقط.", "Only its writer changes a rating.");
    if (!canChangeRating(user, rating, now)) return fail(409, "BAD_STATE", "مضت 24 ساعة على التقييم، فصار في السجل ولا يتغير.", "24 hours have passed: the rating is in the history now and can't change.");
    check(user, input);
    const before = structuredClone(rating);
    Object.assign(rating, fieldsOf(input), { edited_at: nowIso(), edited_by: rating.rater_id === user.id ? undefined : user.id });
    // The CEO changing someone else's rating is written in the audit log, with what it said before.
    if (rating.rater_id !== user.id) {
      const changes = [
        { field: "score", from: scoreText(before.score), to: scoreText(rating.score) },
        { field: "reason_type", from: before.reason_type, to: rating.reason_type },
        { field: "reason", from: before.reason.slice(0, 200), to: rating.reason.slice(0, 200) },
        { field: "private", from: String(before.private), to: String(rating.private) },
      ].filter((c) => c.from !== c.to);
      audit(user.id, "rating_changed", auditTarget(rating, a.label), changes);
    }
    // A private rating made visible reaches the leader or the person now.
    if (before.private && !rating.private) tell(rating, a, user.id);
    commit();
    return wait(rating);
  },

  async deleteRating(id) {
    const user = currentUser();
    const db = getDb();
    const { rating, label } = ratingFor(user, id);
    const now = new Date();
    if (rating.rater_id !== user.id && !canChangeRating(user, rating, now)) return fail(403, "FORBIDDEN", "يحذف التقييمَ كاتبُه أو المدير التنفيذي.", "Only its writer or the CEO removes a rating.");
    if (!canChangeRating(user, rating, now)) return fail(409, "BAD_STATE", "مضت 24 ساعة على التقييم، فصار في السجل ولا يُحذف.", "24 hours have passed: the rating is in the history now and can't be removed.");
    // Every removal is written in the audit log (who wrote it, what it said), so a rating never disappears unseen.
    audit(user.id, "rating_deleted", auditTarget(rating, label), [
      { field: "score", from: scoreText(rating.score) },
      { field: "reason_type", from: rating.reason_type },
      { field: "reason", from: rating.reason.slice(0, 200) },
      { field: "rater", from: db.users.find((u) => u.id === rating.rater_id)?.name ?? "-" },
    ]);
    db.ratings = db.ratings.filter((r) => r.id !== rating.id);
    commit();
    return wait(undefined);
  },
};
