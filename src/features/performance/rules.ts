// Who sees whose performance and who reviews whom. Pure functions: the pages show only what a person may do, and the
// demo backend refuses the rest with the SAME functions (the real server must keep them, docs/backend.md section 13).
//
// Assumptions (the brief: "the management sets the review criteria"; "the direct manager's notes"): the CEO sets and
// approves the criteria. A review is written by the person's direct manager: a team leader for the employees of their
// team, a project manager for the people in their projects, or the CEO for anyone; nobody reviews themselves. M&E sees
// everything (read only); an employee sees their own numbers and their own FINAL reviews.
import type { Project } from "@/features/projects";
import type { User } from "@/shared/api/types";
import type { Review } from "./types";

type U = Pick<User, "id" | "role" | "team_id">;

/** The people list and the team numbers: management, project managers, M&E, team leaders. */
export const canSeePeoplePerf = (user: Pick<User, "role">) => ["ceo", "pm", "monitor", "lead"].includes(user.role);

/** The review criteria and formula: set and approved by the CEO (the management). */
export const canManageCriteria = (user: Pick<User, "role">) => user.role === "ceo";

/** May `user` write a review of `subject`? */
export function canReview(user: U, subject: U, projects: Pick<Project, "pm_id" | "member_ids">[]) {
  if (user.id === subject.id || subject.role === "ceo" || subject.role === "admin") return false;
  if (user.role === "ceo") return true;
  if (user.role === "pm") return projects.some((p) => p.pm_id === user.id && p.member_ids.includes(subject.id));
  if (user.role === "lead") return !!user.team_id && subject.team_id === user.team_id && subject.role === "employee";
  return false;
}

/** May `user` open `subject`'s performance page? Themselves, the CEO, M&E, or someone who may review them. */
export function canSeePerson(user: U, subject: U, projects: Pick<Project, "pm_id" | "member_ids">[]) {
  return user.id === subject.id || user.role === "ceo" || user.role === "monitor" || canReview(user, subject, projects);
}

/** A draft is for its reviewer and the CEO; a final review also for the person and M&E (and anyone who may review them). */
export function canSeeReview(user: U, review: Pick<Review, "user_id" | "reviewer_id" | "state">, subject: U, projects: Pick<Project, "pm_id" | "member_ids">[]) {
  if (review.reviewer_id === user.id || user.role === "ceo") return true;
  if (review.state !== "final") return false;
  return canSeePerson(user, subject, projects);
}

/** The people in `user`'s performance list: everyone they may open, except themselves, the CEO and the admin. */
export function peopleFor(user: U, users: (U & { active: boolean })[], projects: Pick<Project, "pm_id" | "member_ids">[]) {
  return users.filter((u) => u.active && u.id !== user.id && u.role !== "ceo" && u.role !== "admin" && canSeePerson(user, u, projects));
}

export const REVIEW_LIMITS = { note: 3000 };
