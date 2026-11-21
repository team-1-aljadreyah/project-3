// The data shapes of the CEO's advanced settings: every rule of the company in one object, its history, and what each
// signed-in person gets of it (SiteLive, in shared/lib/site.ts).
import type { Severity } from "@/features/bugs";
import type { NotificationKind } from "@/shared/api/notification-kinds";
import type { Priority, Role } from "@/shared/api/types";
import type { Banner, FeatureKey, ReadOnlyMode } from "@/shared/lib/site";

export type { Banner, FeatureKey, ReadOnlyMode, SiteLive } from "@/shared/lib/site";

/** A day off for the whole company. */
export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  name_en?: string;
}

/** Who approves a task as done: the project's manager, a team leader in the project, or either of them (today). */
export type Approver = "pm" | "lead" | "either";

/** The actions of «who may do what». The CEO may always do all of them (the CEO rule). */
export type ActionKey =
  | "create_project"
  | "close_project"
  | "delete_task"
  | "reassign_task"
  | "change_due"
  | "approve_done"
  | "post_announcement"
  | "create_group_chat"
  | "see_scores"
  | "write_reviews"
  | "see_reports"
  | "export_csv"
  | "report_bugs"
  | "bug_severity";

/** The jobs the table can tick (everyone but the CEO). */
export type StaffRole = Exclude<Role, "ceo">;

/** The prefixes of the record codes (TSK-1042, PRJ-4, BUG-12). New records only. */
export type CodeKind = "task" | "project" | "bug";

/**
 * Every rule of the company. The server keeps only what differs from the defaults (rules.ts, DEFAULT_RULES), and
 * answers with the defaults merged in, so a setting added later needs no data change: absent = default = old behaviour.
 */
export interface AdvancedRules {
  /** Working days (0 = Sunday … 6 = Saturday, like JavaScript), hours, and the company's holidays. */
  work: { days: number[]; from: string; to: string; holidays: Holiday[] };
  /** A new task's due date, in working days, by its priority. */
  due_days: Record<Priority, number>;
  /** "Fix within N working days" for a new bug, by its severity. */
  fix_days: Record<Severity, number>;
  tasks: {
    approver: Approver;
    /** May an employee move their own finished task back to work? */
    employee_reopen: boolean;
    /** A reason is needed to change a due date. */
    due_reason: boolean;
    /** The most tasks in progress per person at once (0 = no limit). */
    wip_limit: number;
  };
  /** Who may do each action, besides the CEO. */
  permissions: Record<ActionKey, StaffRole[]>;
  /** Which jobs get each kind of notification. Required kinds always go to every job. */
  notify: Record<NotificationKind, Role[]>;
  features: Record<FeatureKey, boolean>;
  /**
   * Sign-in and security. The first three are the same data as the administration's settings (GET/PUT /admin/settings):
   * changing them here changes them there.
   */
  security: { due_soon_days: number; lock_after: number; lock_minutes: number; password_min: number };
  /** Prefixes of the codes of new records. */
  names: Record<CodeKind, string>;
  banner: Banner | null;
  read_only: ReadOnlyMode;
}

/** The answer of GET /ceo/advanced: the rules in force (defaults merged), and when and by whom they last changed. */
export interface AdvancedData {
  rules: AdvancedRules;
  updated_at?: string;
  updated_by?: { id: number; name: string };
}

/** How a save was made: an import from a file, or everything back to the defaults. */
export type SaveHow = "import" | "reset";

/** One save in the history: who, when, and each setting that really changed, from → to. */
export interface SettingsChange {
  id: number;
  at: string;
  by: { id: number; name: string; name_en?: string };
  how?: SaveHow;
  changes: { key: string; from: unknown; to: unknown }[];
}

/** The settings file (export and import). */
export interface SettingsFile {
  kind: "p3-advanced-settings";
  version: 1;
  exported_at: string;
  rules: Partial<AdvancedRules>;
}
