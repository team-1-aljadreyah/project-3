// The demo backend for signing in and people. Only the demo build loads it (see ./api.ts).
// Wrong passwords: after the admin's `lock_after` in a row, the account locks for `lock_minutes`, the admins are told,
// and the audit log records it (the brief: "a user who can't sign in for a while"; docs/backend.md section 14).
import { audit, demoIp, demoUserAgent, newSessionId } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { browserSessionId, currentUser, fail, nowIso, setBrowserSessionId, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import { DEMO_PASSWORD } from "@/mock/seed";
import { birthdayView } from "@/shared/lib/birthday";
import type { AuthApi } from "./api";

export const authMock: AuthApi = {
  async login(identifier, password) {
    const db = getDb();
    const id = identifier.trim().toLowerCase();
    const user = db.users.find((u) => u.email === id || u.phone === id);
    const now = nowIso();
    let login = user && db.logins.find((l) => l.user_id === user.id);
    if (user && !login) {
      login = { user_id: user.id, failed: 0 };
      db.logins.push(login);
    }
    // A locked account says so, even with the right password (and the lock doesn't grow while it lasts).
    if (login?.locked_until && login.locked_until > now) {
      const until = new Date(login.locked_until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return fail(429, "RATE_LIMITED", `الحساب مقفل مؤقتاً بعد محاولات خاطئة، حتى ${until}. أو اطلب من مسؤول النظام فتحه.`, `The account is locked after wrong passwords, until ${until}. Or ask the system admin to unlock it.`);
    }
    if (!user || password !== (getDb().passwords?.[user.id] ?? DEMO_PASSWORD)) {
      audit(undefined, "login_failed", { type: "login", id: user?.id, label: id.slice(0, 120) }, undefined, { userId: user?.id });
      if (user && login) {
        login.failed++;
        if (login.failed >= db.settings.lock_after) {
          login.locked_until = new Date(Date.now() + db.settings.lock_minutes * 60_000).toISOString();
          audit(undefined, "login_locked", { type: "user", id: user.id, label: user.name }, [{ field: "minutes", to: String(db.settings.lock_minutes) }], { userId: user.id });
          const admins = db.users.filter((u) => u.role === "admin" && u.active).map((u) => u.id);
          notify(admins, "account_locked", { data: { note: user.name } });
        }
      }
      commit({ own: true });
      return fail(422, "VALIDATION", "البريد أو كلمة المرور غير صحيحة.", "Wrong email or password.");
    }
    if (!user.active) return fail(403, "FORBIDDEN", "تم إيقاف هذا الحساب.", "This account is stopped.");
    login!.failed = 0;
    login!.locked_until = undefined;
    login!.last_login_at = now;
    // A new session: the audit log writes it on everything this person does until they sign in again.
    login!.session_id = newSessionId();
    // The session the admin sees on the security page (who, on what, from where), and this browser is in it.
    db.sessions ??= [];
    db.sessions.push({ id: login!.session_id, user_id: user.id, ip: demoIp(user.id), user_agent: demoUserAgent(), started_at: now, last_seen_at: now });
    setBrowserSessionId(login!.session_id);
    commit({ own: true });
    return wait({ token: `demo-${user.id}`, user: birthdayView(user, user) });
  },

  async me() {
    const me = currentUser();
    return wait(birthdayView(me, me));
  },

  // Signing out ends this browser's session (the token itself is only "demo-<id>": nothing else to cancel).
  async logout() {
    const db = getDb();
    const session = db.sessions?.find((s) => s.id === browserSessionId());
    if (session && !session.ended_at) {
      session.ended_at = nowIso();
      session.end_reason = "signed_out";
      commit({ own: true });
    }
    setBrowserSessionId(null);
    return wait(undefined);
  },

  // Birthdays: colleagues get the day and month only; the year only the person, the admin and the CEO (birthdayView).
  async users() {
    const viewer = currentUser();
    return wait(getDb().users.map((u) => birthdayView(viewer, u)));
  },
};
