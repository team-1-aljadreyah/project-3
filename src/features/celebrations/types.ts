// The data shapes of celebrations (a team's good work or big achievement, sent by the monitoring officer), shared by the
// real API, the demo backend and the screens. Birthdays need no new data: they come from the birth dates and from the
// birthday reminders (docs/backend.md section 20).
import type { Role } from "@/shared/api/types";

/** "good": good work (confetti); "big": a big achievement (fireworks and a trophy). */
export type CelebrationKind = "good" | "big";

/** One celebration as a member of the team sees it (once: then it is marked seen). */
export interface Celebration {
  id: number;
  team_id: number;
  team_name: string;
  team_name_en?: string;
  kind: CelebrationKind;
  /** A few words from the sender (optional). */
  message?: string;
  by_id: number;
  by_name: string;
  by_name_en?: string;
  /** The sender's job (and custom role, when they have one), for the card's "from" line. */
  by_role: Role;
  by_custom_role?: string;
  created_at: string;
}

export interface CelebrationInput {
  team_id: number;
  kind: CelebrationKind;
  message?: string;
}

/** What the sender gets back: the celebration and how many people it reached. */
export interface CelebrationSent extends Celebration {
  sent_to: number;
}

/** A celebration as the demo backend keeps it: who it went to and who has seen it (a real server keeps the same). */
export interface StoredCelebration {
  id: number;
  team_id: number;
  kind: CelebrationKind;
  message?: string;
  by_id: number;
  created_at: string;
  to: number[];
  seen: number[];
}
