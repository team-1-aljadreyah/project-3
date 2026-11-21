// The demo server's audit log: every backend that does something important adds one line here (the brief: who did it,
// what kind of action, what data changed, when, and from where). There is no call to change or remove a line. Kept in
// the demo layer because many features write to it; the admin feature only reads it.
//
// From where: the demo has no network, so each demo person gets a fixed address from the ranges set aside for examples
// (RFC 5737: 192.0.2.x, 198.51.100.x, 203.0.113.x; the admin is on the office's private 10.x network), and the device is
// this browser's own User-Agent. The real server takes both from the request (docs/backend.md section 14).
import type { AuditAction, AuditEntry } from "@/features/admin";
import { getDb } from "./db";
import { nowIso } from "./helpers";
import { demoIp, TEST_USER_AGENT } from "./seed";

export { demoIp, TEST_USER_AGENT, UNKNOWN_IP } from "./seed";

/** This browser's User-Agent, cut to 300 characters like the real server does. */
export function demoUserAgent() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  // Node has a navigator too ("Node.js/24"): that is a test, not a browser.
  return (ua && !ua.startsWith("Node") ? ua : TEST_USER_AGENT).slice(0, 300);
}

/** Short random ids like a server makes them. */
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
export const newSessionId = () => `s_${hex(16)}`;
const newRequestId = () => `req_${hex(12)}`;

/** The session of someone signed in: the one their last sign-in started (a session from before this field: one now). */
function sessionOf(userId: number) {
  const db = getDb();
  let login = db.logins.find((l) => l.user_id === userId);
  if (!login) {
    login = { user_id: userId, failed: 0 };
    db.logins.push(login);
  }
  login.session_id ??= newSessionId();
  return login.session_id;
}

/**
 * Writes one line. `from`: whose machine the request came from when nobody is signed in (a sign-in attempt for a known
 * account); by default the person who did it.
 */
export function audit(actorId: number | undefined, action: AuditAction, target: AuditEntry["target"], changes?: AuditEntry["changes"], from?: { userId?: number }) {
  const db = getDb();
  db.audit.push({
    id: ++db.seq.audit,
    actor_id: actorId,
    action,
    target,
    changes: changes?.length ? changes : undefined,
    at: nowIso(),
    ip: demoIp(actorId ?? from?.userId),
    user_agent: demoUserAgent(),
    session_id: actorId === undefined ? undefined : sessionOf(actorId),
    request_id: newRequestId(),
  });
}
