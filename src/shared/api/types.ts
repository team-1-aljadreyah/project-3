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
  /**
   * A job the CEO made (advanced settings): its key. `role` then holds the job it starts like, so every rule keeps
   * working from it; the custom role can only take away (docs/backend.md section 17).
   */
  custom_role?: string;
  /** Job title shown under the name, e.g. "مطورة واجهات". */
  title: string;
  team_id?: number;
  active: boolean;
  /**
   * The person's profile picture (square, 256×256), or none: then their initial on a colour shows instead. The real
   * server gives a URL; the demo keeps the picture itself as a "data:" link. Only the person sets it (docs/backend.md §18).
   */
  avatar_url?: string;
}

/**
 * A team of people (the brief: team chats, team reports). Its members are the people with this `team_id`.
 * Not decided by the client yet (BRIEF question 6): for now a team is fixed, not made per project.
 */
export interface Team {
  id: number;
  name: string;
  name_en?: string;
  lead_id?: number;
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
