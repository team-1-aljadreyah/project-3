// Performance: counted numbers per person and team, the review criteria, and the reviews. Pages call `performanceApi`;
// the .env switch decides if it is the real server or the demo backend (./mock.ts). Both follow `PerformanceApi`.
import { http, lazyApi } from "@/shared/api";
import type { Criteria, Criterion, Period, PersonDetail, PersonPerf, Review, ReviewInput, TeamPerf } from "./types";

export interface PerformanceApi {
  /** The people this person may see, and the teams, counted over the period. */
  overview(period: Period): Promise<{ people: PersonPerf[]; teams: TeamPerf[] }>;
  /** One person: counted numbers, blocked tasks with reasons, and the reviews this person may see. */
  person(userId: number, period: Period): Promise<PersonDetail>;
  criteria(): Promise<Criteria>;
  /** Replaces the criteria (CEO). Clears the approval. */
  saveCriteria(items: Criterion[]): Promise<Criteria>;
  /** The management approves the criteria: from then on reviews can be made final. */
  approveCriteria(): Promise<Criteria>;
  /** A new draft review, or changes to a draft (with `id`). */
  saveReview(input: ReviewInput, id?: number): Promise<Review>;
  /** Makes a draft final: it can't change any more, and the person is told. */
  finalizeReview(id: number): Promise<Review>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const performanceHttp: PerformanceApi = {
  overview: (period) => data(http.get<{ people: PersonPerf[]; teams: TeamPerf[] }>("/performance", { params: period })),
  person: (userId, period) => data(http.get<PersonDetail>(`/performance/people/${userId}`, { params: period })),
  criteria: () => data(http.get<Criteria>("/performance/criteria")),
  saveCriteria: (items) => data(http.put<Criteria>("/performance/criteria", { items })),
  approveCriteria: () => data(http.post<Criteria>("/performance/criteria/approve")),
  saveReview: (input, id) => data(id ? http.patch<Review>(`/reviews/${id}`, input) : http.post<Review>("/reviews", input)),
  finalizeReview: (id) => data(http.post<Review>(`/reviews/${id}/finalize`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const performanceApi: PerformanceApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.performanceMock)) : performanceHttp;
