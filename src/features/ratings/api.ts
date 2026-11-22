// Quick ratings (of teams and people) and the team pages. Pages call `ratingsApi`; the .env switch decides if it is the
// real server or the demo backend (./mock.ts). Both follow `RatingsApi` (docs/backend.md section 21).
import { http, lazyApi } from "@/shared/api";
import type { PersonRatingRow, Rating, RatingInput, RatingList, Subject, TeamDetail, TeamListRow } from "./types";

/** The address of a subject's ratings: /teams/3/ratings, /people/5/ratings. */
const ratingsPath = (s: Subject) => `/${s.type === "team" ? "teams" : "people"}/${s.id}/ratings`;

export interface RatingsApi {
  /** Every team this person may see, with its members count and (when they may read them) its ratings in numbers. */
  teams(): Promise<TeamListRow[]>;
  /** One team with its members (404 when this person may not see it). */
  team(id: number): Promise<TeamDetail>;
  /** The people whose ratings this person may read, each with their ratings in numbers. */
  people(): Promise<PersonRatingRow[]>;
  /** A team's or a person's ratings this person may read, newest first, and whether they may add one (403 otherwise). */
  ratings(subject: Subject): Promise<RatingList>;
  /** Rate a team or a person. The team's leader, or the person, is told unless it is private. */
  rate(subject: Subject, input: RatingInput): Promise<Rating>;
  /** Change a rating: its writer within 24 hours, or the CEO. */
  updateRating(id: number, input: RatingInput): Promise<Rating>;
  /** Remove a rating: its writer within 24 hours, or the CEO (written in the audit log). */
  deleteRating(id: number): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const ratingsHttp: RatingsApi = {
  teams: () => data(http.get<TeamListRow[]>("/teams/ratings/summary")),
  team: (id) => data(http.get<TeamDetail>(`/teams/${id}`)),
  people: () => data(http.get<PersonRatingRow[]>("/people/ratings/summary")),
  ratings: (subject) => data(http.get<RatingList>(ratingsPath(subject))),
  rate: (subject, input) => data(http.post<Rating>(ratingsPath(subject), input)),
  updateRating: (id, input) => data(http.patch<Rating>(`/ratings/${id}`, input)),
  deleteRating: (id) => data(http.delete<void>(`/ratings/${id}`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const ratingsApi: RatingsApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.ratingsMock)) : ratingsHttp;
