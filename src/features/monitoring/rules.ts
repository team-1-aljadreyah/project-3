// Who may write monitoring notes, send them to the CEO, and use the CEO's inbox. Pure functions: the pages use them to
// show only what a person may do; the demo backend uses the SAME functions to refuse the rest (docs/backend.md, 16).
import type { User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { MonitorNote } from "./types";

/** Write reports about teams and people, feedback on anyone, and problems: the monitoring officer (and the CEO). */
export const canWriteNotes = (user: Pick<User, "role">) => isCeo(user) || user.role === "monitor";

/**
 * Send the CEO a request about anything: every job (the client, 21 November 2026: "all the roles should be able to send
 * a request to the CEO"), since nobody messages the CEO directly. The one exception to THE CEO RULE: the CEO doesn't
 * send requests (the client: "who will he request?"); tests/unit/ceo-rule.test.ts lists it as the exception.
 */
export const canSendRequests = (user: Pick<User, "role">) => !isCeo(user);

/** See a note: its writer, and the CEO (who sees them all). */
export const canSeeNote = (user: Pick<User, "id" | "role">, note: Pick<MonitorNote, "author_id">) => isCeo(user) || note.author_id === user.id;

/** Send a note to the CEO, whenever she wants: its writer (and the CEO). */
export const canSendToCeo = (user: Pick<User, "id" | "role">, note: Pick<MonitorNote, "author_id">) => isCeo(user) || note.author_id === user.id;

/** The CEO's inbox of what monitoring sent: read, answer, mark done. */
export const canUseCeoInbox = (user: Pick<User, "role">) => isCeo(user);

export const NOTE_LIMITS = { title: 160, body: 5000, reply: 2000, subject: 120, people: 30 };
