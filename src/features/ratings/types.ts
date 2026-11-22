// The data shapes of quick ratings (of teams and of people) and of the team pages, shared by the real API, the demo
// backend and the pages. A quick rating is not the periodic performance review (features/performance): it is a score
// with a reason, given at any time, for any reason.
import type { Team, User } from "@/shared/api/types";

/** What a rating is about: a team, or one person. */
export type SubjectType = "team" | "person";

export interface Subject {
  type: SubjectType;
  id: number;
}

/**
 * What a rating is mostly about, so they can be grouped and counted. "other" is always there: the monitoring officer
 * may rate for any reason at all (the client, 22 November 2026).
 */
export type ReasonType = "quality" | "deadlines" | "teamwork" | "attitude" | "incident" | "other";

/** A day range, both days included ("YYYY-MM-DD"). */
export interface RatingPeriod {
  from: string;
  to: string;
}

/** One quick rating: a score of 1–5 with the reason in the rater's own words, about a team or a person. */
export interface Rating {
  id: number;
  subject_type: SubjectType;
  /** The team's id or the person's user id. */
  subject_id: number;
  /** Who wrote it. */
  rater_id: number;
  /** 1 Poor, 2 Fair, 3 Good, 4 Very good, 5 Excellent. */
  score: number;
  reason_type: ReasonType;
  /** In the rater's own words (required, at most 1000 letters). */
  reason: string;
  /** Optional: the project it is about, with its name copied when it was written (so it reads right later). */
  project_id?: number;
  project_name?: string;
  project_name_en?: string;
  /** Optional: the period it is about. */
  period?: RatingPeriod;
  /** Private: only the CEO and the rater see it (the team, its leader or the person don't, and nobody is told). */
  private: boolean;
  created_at: string;
  /** The last change, and who made it when it wasn't the rater (the CEO). */
  edited_at?: string;
  edited_by?: number;
}

/** `POST /teams/:id/ratings`, `POST /people/:id/ratings` and `PATCH /ratings/:id`. */
export interface RatingInput {
  score: number;
  reason_type: ReasonType;
  reason: string;
  /** null = not about one project. */
  project_id?: number | null;
  /** null = no period. */
  period?: RatingPeriod | null;
  private?: boolean;
}

/** `GET /teams/:id/ratings`, `GET /people/:id/ratings`: the ratings this person may read, newest first. */
export interface RatingList {
  items: Rating[];
  /** May this person add one (the rules, and the CEO's custom roles)? */
  can_rate: boolean;
}

/** An average over some ratings. `average` is null when there are none. */
export interface Average {
  count: number;
  average: number | null;
}

/** Ratings in numbers, over the ones the viewer may see. */
export interface RatingSummary extends Average {
  /** The last 90 days, and everything before them: the trend. */
  recent: Average;
  before: Average;
  /** How many of each reason type. */
  by_type: Record<ReasonType, number>;
  /** How many of each score, 1 to 5 (index 0 = score 1). */
  by_score: [number, number, number, number, number];
  /** The newest one. */
  last?: Pick<Rating, "score" | "reason_type" | "created_at">;
}

/** The task numbers of a team's members now, in the projects the viewer may see. */
export interface TeamTasks {
  open: number;
  late: number;
  blocked: number;
  done: number;
}

/** `GET /teams/:id`: the team, its active members (the leader first), and what this person may see there. */
export interface TeamDetail {
  team: Team;
  members: User[];
  /** May this person read the team's ratings (`GET /teams/:id/ratings`)? */
  can_see_ratings: boolean;
  /** The members' tasks: for the jobs that see the reports (the CEO, PMs, monitoring, leaders); else null. */
  tasks: TeamTasks | null;
}

/** One line of `GET /teams/ratings/summary`: a team this person may see, with its numbers. */
export interface TeamListRow {
  team: Team;
  /** Active members (the leader included). */
  member_count: number;
  /** null when this person may not read the team's ratings. */
  ratings: RatingSummary | null;
  can_rate: boolean;
}

/** One line of `GET /people/ratings/summary`: a person whose ratings this person may read. */
export interface PersonRatingRow {
  user_id: number;
  ratings: RatingSummary;
  can_rate: boolean;
}
