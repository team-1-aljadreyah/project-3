// The monitoring and evaluation officer's notes: written reports about teams and people, feedback on anyone, and
// problems she raises. Any of them can be sent to the CEO, who reads them in her inbox, answers, and marks them done.

/** A written report, feedback on a person, or a problem (monitoring); a request to the CEO (employees). */
export type NoteKind = "report" | "feedback" | "problem" | "request";

/** What a note is about. `label` is a copy of the name when it was written (it stays right if the name changes). */
export interface NoteAbout {
  type: "team" | "person" | "project" | "general";
  id?: number;
  label?: string;
  label_en?: string;
}

/** Where a note stands with the CEO: not sent, sent and not opened, opened, or done. */
export type CeoState = "new" | "seen" | "done";

export interface MonitorNote {
  id: number;
  kind: NoteKind;
  title: string;
  body: string;
  about: NoteAbout;
  /** Feedback only: praise or something to improve. */
  tone?: "praise" | "improve";
  /** What it is about, in the writer's own words (problems: "about whatever she wants"). */
  subject?: string;
  /** The people it involves, any number, anyone in the company (names copied when written). */
  people?: { id: number; label: string; label_en?: string }[];
  author_id: number;
  created_at: string;
  /** When it was sent to the CEO (missing: not sent). */
  sent_at?: string;
  ceo_state?: CeoState;
  /** The CEO's answer, and when. */
  ceo_reply?: string;
  replied_at?: string;
  /** A report made with the report builder: the numbers the server counted when it was saved (they don't change later). */
  facts?: ReportFacts;
  /**
   * Requests only: they reach the monitoring officer first (the client, 22 November 2026). "pending": with her;
   * "forwarded": she sent it on to the CEO (then `sent_at` and the CEO's answer work as for any note); "answered": she
   * answered it herself and it did not go to the CEO. Missing: it went straight to the CEO (her own requests, or when
   * there is no monitoring officer).
   */
  triage?: "pending" | "forwarded" | "answered";
  /** Her note to the CEO when she forwards a request (the CEO and she see it, not the person who asked). */
  forward_note?: string;
  /** Her answer when she answers a request herself (the person who asked sees it). */
  monitor_reply?: string;
  triaged_by?: number;
  triaged_at?: string;
  /** Anyone else she chose to send the note to (besides the CEO), with when each one opened it. */
  shared_with?: { id: number; label: string; label_en?: string; at: string; seen_at?: string }[];
}

/** A period of days, both ends included ("YYYY-MM-DD"). */
export interface ReportPeriod {
  from: string;
  to: string;
}

/** One line of a report's table: a member (team or project report) or a project (person report). */
export interface ReportRow {
  type: "person" | "project";
  id: number;
  label: string;
  label_en?: string;
  assigned: number;
  done: number;
  late: number;
  blocked: number;
  /** done / assigned, 0–1. */
  completion: number;
}

/**
 * The numbers of a report about a team, a person or a project over a period, counted by the server the same way as the
 * performance page (docs/backend.md, sections 13 and 16).
 */
export interface ReportFacts {
  about: NoteAbout;
  period: ReportPeriod;
  /** Tasks open at some point in the period, and how many of them were finished in it. */
  assigned: number;
  done: number;
  left: number;
  late: number;
  /** Blocked now. */
  blocked: number;
  /** done / assigned, 0–1. */
  completion: number;
  /** Of the finished tasks that had a due day, the share finished on time, 0–1; null when there were none. */
  on_time: number | null;
  /** Where the work should be by the period's end by its projects' dates (time gone), 0–1; null with no project. */
  planned: number | null;
  /** Bugs reported in the period, closed in the period, and still open now. */
  bugs_reported: number;
  bugs_closed: number;
  bugs_open: number;
  rows: ReportRow[];
  /** When the numbers were counted. */
  counted_at: string;
}

export interface NoteInput {
  kind: NoteKind;
  title: string;
  body: string;
  about: Pick<NoteAbout, "type" | "id">;
  tone?: "praise" | "improve";
  subject?: string;
  people_ids?: number[];
  /** Send it to the CEO at once. */
  send?: boolean;
  /** A report from the report builder: the period of its numbers (the server counts them again and keeps them). */
  period?: ReportPeriod;
  /** Send it also to these people (any active account except the writer and the CEO, who has `send`). */
  share_ids?: number[];
}

/** The CEO's answer: a reply (optional) and the new state. */
export interface NoteAnswer {
  reply?: string;
  state: "seen" | "done";
  /** With state "seen": take a done note back to "To handle" (opening a done note doesn't, on its own). */
  reopen?: boolean;
}
