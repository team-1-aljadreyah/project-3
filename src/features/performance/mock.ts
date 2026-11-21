// The demo backend for performance, with the rules the real server must keep (docs/backend.md, section 13): the
// numbers come from ./metrics.ts, the permissions from ./rules.ts. Only the demo build loads it.
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import { requireAction, requireFeature, roleMay } from "@/mock/site";
import type { User } from "@/shared/api/types";
import { canSeeProject } from "@/shared/lib/access";
import { today } from "@/shared/lib/utils";
import type { PerformanceApi } from "./api";
import { blockedTasks, criteriaProblem, personPerf, scoreReview, teamPerf } from "./metrics";
import { canManageCriteria, canReview, canSeePeoplePerf, canSeePerson, canSeeReview, peopleFor, REVIEW_LIMITS } from "./rules";
import type { Criterion, Period, Review, ReviewInput } from "./types";

const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function checkPeriod(period: Period) {
  if (!isDay(period?.from) || !isDay(period?.to)) invalid("period", "اختر بداية الفترة ونهايتها.", "Choose the period's start and end.");
  if (period.from > period.to) invalid("period", "بداية الفترة بعد نهايتها.", "The period starts after it ends.");
}

/** The numbers count in the projects the asking person may see (the CEO and M&E: all). */
const visibleProjects = (user: User) => getDb().projects.filter((p) => canSeeProject(user, p));

function subjectFor(user: User, userId: number) {
  const subject = getDb().users.find((u) => u.id === userId);
  // Not found and not allowed answer the same, so nobody learns who exists.
  if (!subject || !canSeePerson(user, subject, getDb().projects)) return fail(404, "NOT_FOUND", "لم يُعثر على المطلوب.", "Not found.");
  return subject;
}

function perfOf(user: User, subject: User, period: Period) {
  return personPerf(subject.id, subject.team_id, getDb().tasks, visibleProjects(user), period, today());
}

const MESSAGES: Record<NonNullable<ReturnType<typeof criteriaProblem>>, [string, string]> = {
  empty: ["أضف معياراً واحداً على الأقل.", "Add at least one criterion."],
  name: ["لكل معيار اسم بالعربية والإنجليزية.", "Every criterion needs an Arabic and an English name."],
  weight: ["الأوزان أعداد صحيحة أكبر من صفر.", "Weights are whole numbers above zero."],
  sum: ["مجموع الأوزان يجب أن يكون 100.", "The weights must add up to 100."],
  metric: ["اختر المقياس لكل معيار محسوب.", "Choose the measure of every counted criterion."],
  only_auto: ["أضف معياراً يقيّمه المسؤول (مثل جودة العمل): لا يُبنى التقييم على عدد المهام وحده.", "Add a criterion the reviewer scores (like work quality): a review can't rest on task numbers alone."],
};

export const performanceMock: PerformanceApi = {
  async overview(period) {
    const user = currentUser();
    if (!canSeePeoplePerf(user)) return fail(403, "FORBIDDEN", "هذه الصفحة للإدارة ومديري المشاريع والمتابعة وقادة الفرق.", "This page is for management, PMs, M&E and team leaders.");
    checkPeriod(period);
    const db = getDb();
    const projects = visibleProjects(user);
    const people = peopleFor(user, db.users, db.projects).map((u) => personPerf(u.id, u.team_id, db.tasks, projects, period, today()));
    const teams = db.teams
      .map((t) => teamPerf(t, db.users, people, projects, db.tasks, period))
      .filter((t) => t.assigned > 0);
    return wait({ people, teams });
  },

  async person(userId, period) {
    const user = currentUser();
    checkPeriod(period);
    const db = getDb();
    const subject = subjectFor(user, userId);
    const reviews = db.reviews
      .filter((r) => r.user_id === userId && canSeeReview(user, r, subject, db.projects))
      .sort((a, b) => b.period.to.localeCompare(a.period.to));
    return wait({
      perf: perfOf(user, subject, period),
      blocked: blockedTasks(userId, db.tasks, visibleProjects(user)),
      reviews,
      can_review: canReview(user, subject, db.projects) && roleMay(user, "write_reviews"),
    });
  },

  async criteria() {
    return wait(getDb().criteria);
  },

  async saveCriteria(items) {
    const user = currentUser();
    if (!canManageCriteria(user)) return fail(403, "FORBIDDEN", "تحدد الإدارة معايير التقييم.", "The management sets the review criteria.");
    const clean: Criterion[] = items.map((c, i) => ({
      id: c.id || `c${Date.now().toString(36)}${i}`,
      name: c.name.trim(),
      name_en: c.name_en.trim(),
      kind: c.kind === "auto" ? "auto" : "manual",
      metric: c.kind === "auto" ? c.metric : undefined,
      weight: c.weight,
    }));
    const problem = criteriaProblem(clean);
    if (problem) invalid("items", ...MESSAGES[problem]);
    const db = getDb();
    // A change needs a new approval (the brief: approved by the management before it is applied).
    audit(user.id, "criteria_changed", { type: "criteria", label: "معايير التقييم" }, [
      { field: "items", from: db.criteria.items.map((c) => `${c.name} ${c.weight}`).join("، "), to: clean.map((c) => `${c.name} ${c.weight}`).join("، ") },
    ]);
    db.criteria = { items: clean, updated_at: nowIso() };
    commit();
    return wait(db.criteria);
  },

  async approveCriteria() {
    const user = currentUser();
    if (!canManageCriteria(user)) return fail(403, "FORBIDDEN", "تعتمد الإدارة معايير التقييم.", "The management approves the review criteria.");
    const db = getDb();
    if (criteriaProblem(db.criteria.items)) invalid("items", "أصلح المعايير قبل اعتمادها.", "Fix the criteria before approving them.");
    db.criteria = { ...db.criteria, approved_by: user.id, approved_at: nowIso() };
    audit(user.id, "criteria_approved", { type: "criteria", label: "معايير التقييم" });
    commit();
    return wait(db.criteria);
  },

  async saveReview(input: ReviewInput, id?: number) {
    const user = currentUser();
    requireFeature(user, "reviews");
    requireAction(user, "write_reviews");
    const db = getDb();
    const subject = db.users.find((u) => u.id === input.user_id);
    if (!subject || !canReview(user, subject, db.projects)) return fail(403, "FORBIDDEN", "لا يحق لك تقييم هذا الشخص.", "You can't review this person.");
    checkPeriod(input.period);
    if (input.period.to > today()) invalid("period", "لا تقيّم فترة لم تنتهِ بعد.", "Don't review a period that hasn't ended yet.");
    const note = input.note.trim();
    if (note.length > REVIEW_LIMITS.note) invalid("note", "الملاحظات أطول من المسموح.", "The notes are too long.");
    const criteria = db.criteria.items;
    for (const c of criteria) {
      const s = input.stars[c.id];
      if (c.kind === "manual" && s !== undefined && (!Number.isInteger(s) || s < 1 || s > 5)) invalid(`stars.${c.id}`, "اختر من 1 إلى 5.", "Choose 1 to 5.");
    }
    const perf = perfOf(user, subject, input.period);
    const { scores, total } = scoreReview(criteria, perf, input.stars);
    if (id !== undefined) {
      const review = db.reviews.find((r) => r.id === id);
      if (!review || review.reviewer_id !== user.id) return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Review not found.");
      if (review.state === "final") return fail(409, "BAD_STATE", "التقييم نهائي ولا يتغير.", "The review is final and can't change.");
      Object.assign(review, { period: input.period, scores, total, note, perf, criteria: structuredClone(criteria) });
      commit();
      return wait(review);
    }
    const review: Review = {
      id: ++db.seq.review, user_id: subject.id, reviewer_id: user.id, period: input.period, scores, criteria: structuredClone(criteria),
      total, note, perf, state: "draft", created_at: nowIso(),
    };
    db.reviews.push(review);
    commit();
    return wait(review);
  },

  async finalizeReview(id) {
    const user = currentUser();
    requireFeature(user, "reviews");
    const db = getDb();
    const review = db.reviews.find((r) => r.id === id);
    if (!review || review.reviewer_id !== user.id) return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Review not found.");
    if (review.state === "final") return fail(409, "BAD_STATE", "التقييم نهائي من قبل.", "The review is already final.");
    if (!db.criteria.approved_at) return fail(409, "BAD_STATE", "لم تعتمد الإدارة معايير التقييم بعد.", "The management hasn't approved the criteria yet.");
    // Every criterion the reviewer scores needs its stars before the review is final.
    if (review.criteria.some((c) => c.kind === "manual" && !review.scores[c.id])) invalid("stars", "قيّم كل المعايير قبل اعتماد التقييم.", "Score every criterion before making the review final.");
    review.state = "final";
    audit(user.id, "review_finalized", { type: "review", id, label: db.users.find((u) => u.id === review.user_id)?.name ?? "-" }, [{ field: "total", to: String(review.total) }]);
    review.finalized_at = nowIso();
    notify([review.user_id], "review_final", { actor_id: user.id, data: { note: `${review.period.from} → ${review.period.to}` } });
    commit();
    return wait(review);
  },
};
