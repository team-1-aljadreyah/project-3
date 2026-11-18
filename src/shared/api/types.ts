// The words the whole app speaks: people, jobs, priorities and status colours. They are here (not in a feature)
// because the design system and the top bar use them too, and shared/ never imports a feature.
// Dates are ISO 8601; days are "YYYY-MM-DD".

/** The six jobs in the client's brief. HR may be added later. */
export type Role = "ceo" | "pm" | "monitor" | "lead" | "employee" | "admin";

export interface User {
  id: number;
  name: string;
  name_en?: string;
  email: string;
  phone?: string;
  role: Role;
  /** Job title shown under the name, e.g. "مطورة واجهات". */
  title: string;
  team_id?: number;
  active: boolean;
}

export interface Session {
  token: string;
  user: User;
}

/**
 * The colour family of a status. Projects may add their own statuses (the brief), so the board never
 * hard-codes the seven: each status says which family it belongs to, and the family picks the colour.
 */
export type StatusTone = "new" | "todo" | "progress" | "review" | "testing" | "done" | "blocked";

export interface TaskStatus {
  key: string;
  name: string;
  name_en: string;
  tone: StatusTone;
}

export type Priority = "high" | "medium" | "low";
