// Who may set up projects, and the limits the form and the server share. Pure functions: the pages use them to show
// only what a person may do, the demo backend uses the SAME functions to refuse the rest (docs/backend.md).
//
// Not decided by the client yet (written as assumptions in docs/backend.md, easy to change here):
// - the CEO and project managers create projects; a PM who creates one manages it;
// - a project's setup is changed by its PM or the CEO; only the CEO hands a project to another PM.
import type { User } from "@/shared/api/types";
import { canManageProjectSetup } from "@/shared/lib/access";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";

export function canCreateProject(user: Pick<User, "role">) {
  return user.role === "ceo" || user.role === "pm";
}

/** Change a project's details, members, statuses, phases, sprints and GitHub (the rule lives in shared/lib/access.ts). */
export const canManageProject = canManageProjectSetup;

/** Give the project to another project manager. */
export function canChangePm(user: Pick<User, "role">) {
  return user.role === "ceo";
}

/** The seven base statuses (the brief): every project keeps them; they can't be renamed or removed. */
export const BASE_STATUS_KEYS = new Set(DEFAULT_STATUSES.map((s) => s.key));
export const isBaseStatus = (key: string | undefined) => !!key && BASE_STATUS_KEYS.has(key);

export const PROJECT_LIMITS = {
  name: 120,
  description: 5000,
  note: 300,
  statusName: 40,
  statuses: 15,
  phaseName: 80,
  phases: 20,
  sprintName: 60,
  templateName: 80,
  templateTasks: 200,
};

/** Templates are made and used by the people who create projects (CEO, PM). Removed by who made it, or the CEO. */
export const canUseTemplates = canCreateProject;
export function canRemoveTemplate(user: Pick<User, "id" | "role">, template: { created_by: number }) {
  return user.role === "ceo" || template.created_by === user.id;
}
