// The data shapes of performance: what the system counts for a person or a team over a period, the review criteria
// set by the management, and the reviews. Shared by the real API, the demo backend and the pages.

/** A period, as two days ("YYYY-MM-DD"), both included. */
export interface Period {
  from: string;
  to: string;
}

/** What the system counts for one person over a period (the brief: "per employee"). */
export interface PersonPerf {
  user_id: number;
  team_id?: number;
  /** Their tasks that were open at some point in the period. */
  assigned: number;
  /** Of those, finished inside the period. */
  done: number;
  /** Not done and past due by the period's end, or finished after their due day. */
  late: number;
  /** Blocked now. */
  blocked: number;
  /** done / assigned, 0–1. */
  completion: number;
  /** Of the finished tasks that had a due day, the share finished on time, 0–1. null when there were none. */
  on_time: number | null;
}

/** One blocked task and why (the brief: "blocked tasks and why"). */
export interface BlockedTask {
  task_id: number;
  code: string;
  title: string;
  reason?: string;
  project_id: number;
}

/** What the system counts for a team (the brief: "per team"). */
export interface TeamPerf {
  team_id: number;
  name: string;
  name_en?: string;
  members: number;
  assigned: number;
  done: number;
  left: number;
  late: number;
  blocked: number;
  completion: number;
  /** The team's projects: how far they should be by the period's end (time gone), on average, 0–1. */
  planned: number;
}

/** A criterion is counted by the system from the tasks, or scored by the reviewer (quality, teamwork…). */
export type CriterionKind = "auto" | "manual";
/** The counted measures a criterion can use. */
export type Metric = "completion" | "on_time" | "not_late";

export interface Criterion {
  id: string;
  name: string;
  name_en: string;
  kind: CriterionKind;
  /** Only for "auto". */
  metric?: Metric;
  /** Its share of the total, in points; all weights add up to 100. */
  weight: number;
}

/**
 * The review criteria and formula (the brief: set and approved by the management before reviews are final). Changing
 * them clears the approval.
 */
export interface Criteria {
  items: Criterion[];
  approved_by?: number;
  approved_at?: string;
  updated_at: string;
}

export type ReviewState = "draft" | "final";

/** A review of one person over a period. A final review can't change. */
export interface Review {
  id: number;
  user_id: number;
  reviewer_id: number;
  period: Period;
  /** 0–100 per criterion id: counted ones from the tasks, the others given by the reviewer (1–5 stars × 20). */
  scores: Record<string, number>;
  /** The criteria as they were when the review was made (so an old review keeps its meaning). */
  criteria: Criterion[];
  /** The weighted total, 0–100. */
  total: number;
  /** The manager's notes (the brief). */
  note: string;
  /** The counted numbers at the time of the review. */
  perf: PersonPerf;
  state: ReviewState;
  created_at: string;
  finalized_at?: string;
}

/** Making or changing a draft review: the reviewer's scores (1–5) for the manual criteria, and the note. */
export interface ReviewInput {
  user_id: number;
  period: Period;
  stars: Record<string, number>;
  note: string;
}

/** Everything on a person's performance page. */
export interface PersonDetail {
  perf: PersonPerf;
  blocked: BlockedTask[];
  reviews: Review[];
  /** Whether the person asking may write a review of this person. */
  can_review: boolean;
}
