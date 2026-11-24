// Who may use trial teams, the limits, and the numbers. Pure functions used by the screens and by the demo backend; the
// real server keeps the same (docs/backend.md section 24).
import type { User } from "@/shared/api/types";
import type { TrialDecision, TrialEntry, TrialMember, TrialMemberRow } from "./types";

/**
 * Trial teams are the monitoring officer's own working space: "usually it's just for the monitor, no one else can see
 * it" (the client, 24 November 2026). So, unlike every other rule, not even the CEO: she gets what the monitoring
 * officer sends her (a report in her inbox, or a PDF). The agreed exception in tests/unit/ceo-rule.test.ts.
 */
export const canUseTrials = (user: Pick<User, "role">) => user.role === "monitor";

export const TRIAL_LIMITS = { name: 80, goal: 500, member: 120, specialty: 80, phone: 30, text: 1000, members: 50 };

/** A monitoring note's longest text (the CEO's inbox; monitoring NOTE_LIMITS.body): the report is cut to it. */
export const NOTE_BODY_MAX = 5000;

export const DECISIONS: TrialDecision[] = ["pending", "accepted", "rejected"];

export const DECISION_WORDS: Record<TrialDecision, { ar: string; en: string; tone: "review" | "done" | "blocked" }> = {
  pending: { ar: "قيد التقييم", en: "Being assessed", tone: "review" },
  accepted: { ar: "مقبول", en: "Kept", tone: "done" },
  rejected: { ar: "غير مقبول", en: "Not kept", tone: "blocked" },
};

/** The words of each score (the stars' names). */
export const SCORE_NAMES: Record<number, { ar: string; en: string }> = {
  1: { ar: "ضعيف", en: "Weak" },
  2: { ar: "متوسط", en: "Fair" },
  3: { ar: "جيد", en: "Good" },
  4: { ar: "جيد جداً", en: "Very good" },
  5: { ar: "ممتاز", en: "Excellent" },
};

/** A score or an average as people read it: one decimal when there is one ("4.5", "4"). */
export const scoreText = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/.0$/, "");

/** The average of the scores, to one decimal; undefined when there is none. */
export function averageOf(scores: number[]) {
  if (!scores.length) return undefined;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** A member with their numbers, from all the entries. */
export function memberRow(member: TrialMember, entries: TrialEntry[]): TrialMemberRow {
  const mine = entries.filter((e) => e.member_id === member.id);
  const scores = mine.flatMap((e) => (e.score ? [e.score] : []));
  return {
    ...member,
    average: averageOf(scores),
    scores: scores.length,
    notes: mine.filter((e) => e.text).length,
    last_at: mine.reduce<string | undefined>((last, e) => (!last || e.at > last ? e.at : last), undefined),
  };
}
