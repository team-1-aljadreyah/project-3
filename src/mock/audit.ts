// The demo server's audit log: every backend that does something important adds one line here (the brief: who did it,
// what kind of action, what data changed and when). There is no call to change or remove a line. Kept in the demo layer
// because many features write to it; the admin feature only reads it.
import type { AuditAction, AuditEntry } from "@/features/admin";
import { getDb } from "./db";
import { nowIso } from "./helpers";

export function audit(actorId: number | undefined, action: AuditAction, target: AuditEntry["target"], changes?: AuditEntry["changes"]) {
  const db = getDb();
  db.audit.push({ id: ++db.seq.audit, actor_id: actorId, action, target, changes: changes?.length ? changes : undefined, at: nowIso() });
}
