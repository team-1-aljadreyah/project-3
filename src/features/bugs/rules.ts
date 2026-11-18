// The bug tracker's rules: who may do what, which status may follow which, and lateness. Pure functions: the pages
// use them to show only what a person may do; the demo backend uses the SAME functions to refuse the rest.
//
// Not decided by the client yet (written as assumptions in docs/backend.md, changed here only):
// - everyone who takes part in the project reports bugs;
// - the PM and the project's team leaders assign them and change their details;
// - the developer moves a bug through fixing and testing; the reporter or the managers close it or send it back.
import type { Project } from "@/features/projects";
import { canManageTasks } from "@/features/tasks";
import type { User } from "@/shared/api/types";
import { canTakePart } from "@/shared/lib/access";
import { daysBetween } from "@/shared/lib/utils";
import type { Bug, BugStatus, Severity } from "./types";

type P = Pick<Project, "pm_id" | "member_ids" | "statuses">;

export function canReportBug(user: User, project: P) {
  return canTakePart(user, project);
}

/** Assign, edit severity / priority / day, and do every status move: the same people who manage tasks. */
export function canManageBugs(user: User, project: P) {
  return canManageTasks(user, project);
}

/** The status moves allowed from each status, and who may make them. */
export const NEXT: Record<BugStatus, { to: BugStatus; who: "managers" | "developer" | "checker" }[]> = {
  reported: [{ to: "assigned", who: "managers" }],
  assigned: [{ to: "fixing", who: "developer" }],
  fixing: [{ to: "testing", who: "developer" }],
  testing: [
    { to: "closed", who: "checker" },
    { to: "reopened", who: "checker" },
  ],
  reopened: [{ to: "fixing", who: "developer" }],
  closed: [{ to: "reopened", who: "checker" }],
};

/**
 * The statuses this person may move the bug to now. Managers may do every move; the developer (the assignee) the
 * fixing steps; the reporter may close it after testing or send it back (they know whether it is fixed).
 */
export function movesFor(user: User, project: P, bug: Pick<Bug, "status" | "assignee_id" | "reported_by">): BugStatus[] {
  const manager = canManageBugs(user, project);
  return NEXT[bug.status]
    .filter(({ who }) => manager || (who === "developer" && bug.assignee_id === user.id) || (who === "checker" && bug.reported_by === user.id))
    .map(({ to }) => to);
}

export const isOpen = (bug: Pick<Bug, "status">) => bug.status !== "closed";

/** Days past the expected fix day (0 = not late). A closed bug, or one with no day, is never late. */
export function bugLateDays(bug: Pick<Bug, "status" | "due">, today: string) {
  if (!bug.due || !isOpen(bug)) return 0;
  return Math.max(0, daysBetween(bug.due, today));
}

/** Most severe first, for sorting. */
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const BUG_LIMITS = { title: 160, description: 5000, note: 300 };
