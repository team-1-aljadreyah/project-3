// What the CEO's advanced settings change in the other demo backends: a switched-off feature is refused, the codes of
// new records take the chosen prefix, and the notification matrix decides who is told. The settings are kept as "only
// what differs from the defaults" (db.advanced), so a missing value here is always the default.
// Read-only mode is enforced in commit() (./db.ts). Only the demo build loads this file.
import type { CodeKind } from "@/features/advanced";
import type { NotificationKind } from "@/shared/api/notification-kinds";
import { REQUIRED_NOTIFICATIONS } from "@/shared/api/notification-kinds";
import type { Role, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { ActionKey, FeatureKey } from "@/shared/lib/site";
import { getDb } from "./db";
import { fail } from "./helpers";

const DEFAULT_PREFIX: Record<CodeKind, string> = { task: "TSK", project: "PRJ", bug: "BUG" };

/** Is the feature on? (all are, until the CEO switches one off) */
export const featureIsOn = (key: FeatureKey) => getDb().advanced?.features?.[key] !== false;

/** Refuses a switched-off feature with 403 FEATURE_OFF. The CEO always may (the CEO rule). */
export function requireFeature(user: Pick<User, "role">, key: FeatureKey) {
  if (isCeo(user) || featureIsOn(key)) return;
  fail(403, "FEATURE_OFF", "أوقفت الإدارة هذه الميزة الآن.", "The management has switched this feature off for now.");
}

/** The code of a new record: the CEO's prefix (or the default) and its number: "TSK-1042". */
export const codeOf = (kind: CodeKind, n: number | string) => `${getDb().advanced?.names?.[kind] || DEFAULT_PREFIX[kind]}-${n}`;

/** The person's custom role, if they have one that still exists. */
export const customRoleOf = (user: Pick<User, "custom_role">) => (user.custom_role ? getDb().advanced?.roles?.find((r) => r.key === user.custom_role) : undefined);

/**
 * A custom role's tick (advanced settings, «Jobs and roles»): someone whose role has this action off is refused with
 * 403, even when their base job may. The CEO always may; people without a custom role are left to the feature's rules.
 */
export function roleMay(user: Pick<User, "role" | "custom_role">, action: ActionKey) {
  if (isCeo(user)) return true;
  const role = customRoleOf(user);
  return !role || role.actions.includes(action);
}

export function requireAction(user: Pick<User, "role" | "custom_role">, action: ActionKey) {
  if (roleMay(user, action)) return;
  const role = customRoleOf(user)!;
  fail(403, "FORBIDDEN", `دورك «${role.name}» لا يسمح بهذا العمل.`, `Your role "${role.name_en || role.name}" doesn't allow this.`);
}

/** Does this job get this kind of notification? Required kinds always; the rest as the CEO's table says (all by default). */
export function jobGets(role: Role, kind: NotificationKind) {
  if (REQUIRED_NOTIFICATIONS.has(kind)) return true;
  const row = getDb().advanced?.notify?.[kind];
  return !row || row.includes(role);
}
