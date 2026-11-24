// The data shapes of trial teams: new teams the monitoring officer is trying out, their new members (people on trial,
// not accounts of the platform), and her ratings and notes about each one. Shared by the real API, the demo backend and
// the screens (docs/backend.md section 24).

export type TrialStatus = "running" | "ended";

/** Where a person on trial stands: still being judged, kept, or not kept. */
export type TrialDecision = "pending" | "accepted" | "rejected";

export interface TrialTeam {
  id: number;
  name: string;
  /** What the trial is for (optional). */
  goal?: string;
  /** The first day of the trial ("YYYY-MM-DD"). */
  started_on: string;
  status: TrialStatus;
  /** The day it was ended. */
  ended_on?: string;
  created_by: number;
  created_at: string;
}

export interface TrialMember {
  id: number;
  team_id: number;
  name: string;
  /** What they do: "Front-end developer", "Designer"… */
  specialty: string;
  phone?: string;
  email?: string;
  joined_on: string;
  decision: TrialDecision;
  created_at: string;
}

/** One rating, one note, or both: a score from 1 to 5 and/or a few words, about one member. */
export interface TrialEntry {
  id: number;
  member_id: number;
  score?: number;
  text?: string;
  by_id: number;
  at: string;
}

/** A member with their numbers. */
export interface TrialMemberRow extends TrialMember {
  /** The average score (1–5), when there is at least one. */
  average?: number;
  scores: number;
  notes: number;
  last_at?: string;
}

/** A trial team in the list, with its numbers. */
export interface TrialTeamRow extends TrialTeam {
  members: number;
  /** The average of every score in the team. */
  average?: number;
  entries: number;
  accepted: number;
}

/** One trial team with its members and every entry, newest first. */
export interface TrialTeamDetail {
  team: TrialTeam;
  members: TrialMemberRow[];
  entries: TrialEntry[];
}

export interface TrialTeamInput {
  name: string;
  goal?: string;
  started_on: string;
}

export interface TrialTeamPatch extends Partial<TrialTeamInput> {
  status?: TrialStatus;
}

export interface TrialMemberInput {
  name: string;
  specialty: string;
  phone?: string;
  email?: string;
  joined_on?: string;
}

export interface TrialMemberPatch extends Partial<TrialMemberInput> {
  decision?: TrialDecision;
}

export interface TrialEntryInput {
  score?: number;
  text?: string;
}

/** The demo backend's store (a real server keeps three tables the same way). */
export interface TrialStore {
  teams: TrialTeam[];
  members: TrialMember[];
  entries: TrialEntry[];
}
