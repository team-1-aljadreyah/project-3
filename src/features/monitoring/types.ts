// The monitoring and evaluation officer's notes: written reports about teams and people, feedback on anyone, and
// problems she raises. Any of them can be sent to the CEO, who reads them in her inbox, answers, and marks them done.

/** A written report, feedback on a person, or a problem. */
export type NoteKind = "report" | "feedback" | "problem";

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
  author_id: number;
  created_at: string;
  /** When it was sent to the CEO (missing: not sent). */
  sent_at?: string;
  ceo_state?: CeoState;
  /** The CEO's answer, and when. */
  ceo_reply?: string;
  replied_at?: string;
}

export interface NoteInput {
  kind: NoteKind;
  title: string;
  body: string;
  about: Pick<NoteAbout, "type" | "id">;
  tone?: "praise" | "improve";
  /** Send it to the CEO at once. */
  send?: boolean;
}

/** The CEO's answer: a reply (optional) and the new state. */
export interface NoteAnswer {
  reply?: string;
  state: "seen" | "done";
}
