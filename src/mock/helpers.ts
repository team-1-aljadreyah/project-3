// What every feature's fake backend (features/*/mock.ts) needs: a short wait like a real network, errors shaped
// like the real server's, the signed-in person, and the project lookup that hides what someone may not see.
// Only the demo build loads these files.
import { ApiError, type ErrorCode } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { currentLocale } from "@/shared/lib/boot";
import { canSeeProject } from "@/shared/lib/access";
import { getToken } from "@/shared/lib/session";
import { getDb } from "./db";
import { PASSWORD_MIN_DEFAULT } from "@/shared/lib/password";

/** A short wait, so loading states show in the demo like on a real network. "p3.mock.latency" (ms) makes the demo
 *  server slower, so a test can see what the page shows before an answer comes. */
export const wait = <T>(value: T, ms = 150) =>
  new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), Number(globalThis.localStorage?.getItem("p3.mock.latency")) || ms));

export const msg = (ar: string, en: string) => (currentLocale() === "ar" ? ar : en);

export const fail = (status: number, code: ErrorCode, ar: string, en: string, errors?: Record<string, string>): never => {
  throw new ApiError(status, msg(ar, en), errors, code);
};

/** A form error: 422 with the message under the field. */
export const invalid = (field: string, ar: string, en: string): never => fail(422, "VALIDATION", ar, en, { [field]: msg(ar, en) });

export const nowIso = () => new Date().toISOString();

// The demo token is only "demo-<id>", so the sign-in session this browser is in is kept beside it (a real server knows
// it from the token). The admin can end it (the security page): then the next call answers 401 and the page signs out.
const SESSION_KEY = "p3.demo.session";

/** The sign-in session of this browser (set by the demo sign-in), if any. */
export function browserSessionId(): string | undefined {
  try {
    return (typeof localStorage === "undefined" ? null : localStorage.getItem(SESSION_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setBrowserSessionId(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** The shortest password allowed now (the CEO's security.password_min). */
export function passwordMin(): number {
  return getDb().advanced?.security?.password_min ?? PASSWORD_MIN_DEFAULT;
}

export function currentUser(): User {
  const token = getToken();
  const id = token?.startsWith("demo-") ? Number(token.slice(5)) : NaN;
  const db = getDb();
  const user = db.users.find((u) => u.id === id && u.active);
  if (!user) return fail(401, "UNAUTHENTICATED", "انتهت الجلسة، سجّل الدخول من جديد.", "Your session ended. Please sign in again.");
  // This browser's session: ended by an admin → signed out; else it was just used (kept in memory, saved with the next change).
  const sid = browserSessionId();
  const session = sid ? db.sessions?.find((s) => s.id === sid && s.user_id === user.id) : undefined;
  if (session?.ended_at) return fail(401, "UNAUTHENTICATED", "أنهى مسؤول النظام هذه الجلسة. سجّل الدخول من جديد.", "The system admin ended this session. Please sign in again.");
  if (session) session.last_seen_at = nowIso();
  return user;
}

export function projectFor(user: User, id: number) {
  const project = getDb().projects.find((p) => p.id === id);
  // Not found and not allowed answer the same, so nobody learns which projects exist.
  if (!project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المشروع.", "Project not found.");
  return project;
}
