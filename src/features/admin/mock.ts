// The demo backend for the administration and the audit log, with the rules the real server must keep
// (docs/backend.md, section 14). Only the demo build loads it.
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { browserSessionId, currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import type { Team, User } from "@/shared/api/types";
import { matches } from "@/shared/lib/utils";
import type { AdminApi } from "./api";
import { deviceWords, ipMatches, parseUserAgent, searchText, shortSession } from "./audit-detail";
import { ACTION_KIND, ACTION_WORDS } from "./audit-words";
import { checkImportRows, IMPORT_LIMIT, roleFromText, teamFromText } from "./csv-import";
import { ADMIN_LIMITS as L, canAdminister, canManageSessions, canSeeAudit, isEmail, isLocked, RELATED_LIMIT, ROLE_KEYS, settingsProblem } from "./rules";
import { activeSessions, endSessionProblem, securitySummary, sessionsToEnd, type SessionRecord } from "./security";
import { dayOf } from "./summary";
import type { AdminUser, AuditEntry, ImportCheck, TeamInput, UserInput, UserPatch } from "./types";

function admin() {
  const user = currentUser();
  if (!canAdminister(user)) return fail(403, "FORBIDDEN", "هذه الصفحة لمسؤول النظام والمدير التنفيذي.", "This page is for the system admin and the CEO.");
  return user;
}

const teamName = (id?: number) => getDb().teams.find((t) => t.id === id)?.name;
/** A custom role's name, for the audit log. */
const roleLabel = (key?: string) => (key ? (getDb().advanced?.roles?.find((r) => r.key === key)?.name ?? key) : undefined);

/** Checks a user's fields (all of them when creating, the given ones when changing). */
function checkUser(input: Partial<UserInput>, selfId?: number) {
  const db = getDb();
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > L.name)) invalid("name", "اكتب الاسم.", "Enter the name.");
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!isEmail(email)) invalid("email", "اكتب بريداً إلكترونياً صحيحاً.", "Enter a valid email.");
    if (db.users.some((u) => u.email === email && u.id !== selfId)) invalid("email", "هذا البريد مستعمل لحساب آخر.", "Another account uses this email.");
  }
  if (input.role !== undefined && !ROLE_KEYS.includes(input.role)) invalid("role", "دور غير معروف.", "Unknown role.");
  if (input.title !== undefined && input.title.length > L.title) invalid("title", "المسمى أطول من المسموح.", "The title is too long.");
  if (input.team_id !== undefined && input.team_id !== null && !db.teams.some((t) => t.id === input.team_id)) invalid("team_id", "الفريق غير موجود.", "The team doesn't exist.");
}

/**
 * A job the CEO made: it must exist, and the account's base job becomes the one the role starts like (every rule of
 * the platform keeps working from it). null clears it. Returns the base job to use, if a role was chosen.
 */
function customRole(input: Partial<UserInput>) {
  if (input.custom_role === undefined || input.custom_role === null) return undefined;
  const role = getDb().advanced?.roles?.find((r) => r.key === input.custom_role);
  if (!role) return invalid("role", "هذا الدور غير موجود.", "That role doesn't exist.");
  return role.base;
}

/** A person who manages projects that aren't done can't stop being a PM (or be stopped) before they get a new PM. */
function managesOpenProjects(userId: number) {
  return getDb().projects.filter((p) => p.pm_id === userId && p.state !== "done");
}

function checkTeam(input: TeamInput, selfId?: number) {
  const db = getDb();
  const name = input.name.trim();
  if (!name || name.length > L.teamName) invalid("name", "اكتب اسم الفريق.", "Enter the team's name.");
  if (db.teams.some((t) => t.name === name && t.id !== selfId)) invalid("name", "يوجد فريق بهذا الاسم.", "A team with this name exists.");
  if (input.lead_id !== undefined && input.lead_id !== null) {
    const lead = db.users.find((u) => u.id === input.lead_id);
    if (!lead || !lead.active || lead.role !== "lead") invalid("lead_id", "اختر قائد فريق (دوره «قائد فريق»).", "Choose a team leader (role: team leader).");
  }
  return name;
}

/** The leader joins the team; they are told (the brief: a new team is logged and the right people are told). */
function joinLead(team: Team, leadId: number | null | undefined, actorId: number) {
  if (!leadId) return;
  const lead = getDb().users.find((u) => u.id === leadId)!;
  if (lead.team_id !== team.id) {
    lead.team_id = team.id;
    notify([lead.id], "team_joined", { actor_id: actorId, data: { note: team.name } });
  }
}

export const adminMock: AdminApi = {
  async users() {
    admin();
    return wait(adminUsers());
  },

  async createUser(input) {
    const actor = admin();
    const base = customRole(input);
    if (base) input = { ...input, role: base };
    checkUser({ ...input, name: input.name ?? "", email: input.email ?? "", role: input.role ?? ("" as never) });
    const db = getDb();
    const user: User = {
      ...(base && input.custom_role ? { custom_role: input.custom_role } : {}),
      id: Math.max(...db.users.map((u) => u.id)) + 1,
      name: input.name.trim(),
      name_en: input.name_en?.trim() || undefined,
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      role: input.role,
      title: input.title.trim(),
      team_id: input.team_id ?? undefined,
      active: true,
    };
    db.users.push(user);
    audit(actor.id, "user_created", { type: "user", id: user.id, label: user.name }, [
      { field: "role", to: user.role },
      ...(user.custom_role ? [{ field: "custom_role", to: roleLabel(user.custom_role) }] : []),
      ...(user.team_id ? [{ field: "team", to: teamName(user.team_id) }] : []),
    ]);
    if (user.team_id) notify([user.id], "team_joined", { actor_id: actor.id, data: { note: teamName(user.team_id) } });
    commit();
    return wait(user);
  },

  async updateUser(id, patch: UserPatch) {
    const actor = admin();
    const db = getDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) return fail(404, "NOT_FOUND", "لم يُعثر على المستخدم.", "User not found.");
    const base = customRole(patch);
    if (base) patch = { ...patch, role: base };
    checkUser(patch, id);
    const self = id === actor.id;
    const roleChanges = (patch.role !== undefined && patch.role !== user.role) || (patch.custom_role !== undefined && (patch.custom_role ?? undefined) !== user.custom_role);
    if (self && (roleChanges || patch.active === false)) {
      return fail(409, "BAD_STATE", "لا تغيّر دورك ولا توقف حسابك بنفسك: يفعل ذلك مسؤول آخر.", "Don't change your own role or stop your own account: another admin does.");
    }
    const losesAdmin = user.role === "admin" && ((patch.role !== undefined && patch.role !== "admin") || patch.active === false);
    if (losesAdmin && db.users.filter((u) => u.role === "admin" && u.active).length <= 1) {
      return fail(409, "BAD_STATE", "يجب أن يبقى مسؤول نظام واحد على الأقل.", "At least one system admin must stay.");
    }
    const losesPm = user.role === "pm" && ((patch.role !== undefined && patch.role !== "pm") || patch.active === false);
    const open = losesPm ? managesOpenProjects(id) : [];
    if (open.length) {
      return fail(409, "BAD_STATE", `يدير مشاريع لم تنتهِ (${open.map((p) => p.code).join("، ")}): غيّر مديرها أولاً.`, `Manages unfinished projects (${open.map((p) => p.code).join(", ")}): change their PM first.`);
    }

    const changes: NonNullable<AuditEntry["changes"]> = [];
    const set = <K extends keyof User>(field: K, value: User[K] | undefined, label = String(field), show = (v: unknown) => (v === undefined ? undefined : String(v))) => {
      if (value === undefined || value === user[field]) return;
      changes.push({ field: label, from: show(user[field]), to: show(value) });
      user[field] = value;
    };
    set("name", patch.name?.trim());
    set("name_en", patch.name_en?.trim());
    set("email", patch.email?.trim().toLowerCase());
    set("phone", patch.phone?.trim());
    set("title", patch.title?.trim());
    set("role", patch.role);
    // The CEO's custom role: set or cleared; a role that no longer fits the base job is cleared too.
    const nextCustom = patch.custom_role !== undefined ? (patch.custom_role ?? undefined) : user.custom_role;
    const fits = !nextCustom || db.advanced?.roles?.find((r) => r.key === nextCustom)?.base === user.role;
    const custom = fits ? nextCustom : undefined;
    if (custom !== user.custom_role) {
      changes.push({ field: "custom_role", from: roleLabel(user.custom_role), to: roleLabel(custom) });
      if (custom) user.custom_role = custom;
      else delete user.custom_role;
    }
    if (patch.team_id !== undefined && (patch.team_id ?? undefined) !== user.team_id) {
      changes.push({ field: "team", from: teamName(user.team_id), to: teamName(patch.team_id ?? undefined) });
      user.team_id = patch.team_id ?? undefined;
      if (user.team_id) notify([user.id], "team_joined", { actor_id: actor.id, data: { note: teamName(user.team_id) } });
    }
    const target = { type: "user" as const, id, label: user.name };
    if (changes.length) audit(actor.id, "user_changed", target, changes);
    if (patch.active !== undefined && patch.active !== user.active) {
      user.active = patch.active;
      audit(actor.id, patch.active ? "user_restarted" : "user_stopped", target);
      // A stopped account is signed out everywhere at once.
      if (!patch.active) endSessions(sessionsToEnd(db.sessions ?? [], id, undefined, new Date()), actor.id, "stopped");
    }
    if (patch.unlock) {
      const login = db.logins.find((l) => l.user_id === id);
      if (login?.locked_until || login?.failed) {
        login.failed = 0;
        login.locked_until = undefined;
        audit(actor.id, "user_unlocked", target);
      }
    }
    commit();
    return wait(user);
  },

  async teams() {
    currentUser();
    return wait(getDb().teams);
  },

  async createTeam(input) {
    const actor = admin();
    const name = checkTeam(input);
    const db = getDb();
    const team: Team = { id: ++db.seq.team, name, name_en: input.name_en?.trim() || undefined, lead_id: input.lead_id ?? undefined };
    db.teams.push(team);
    joinLead(team, input.lead_id, actor.id);
    audit(actor.id, "team_created", { type: "team", id: team.id, label: team.name }, team.lead_id ? [{ field: "lead", to: db.users.find((u) => u.id === team.lead_id)?.name }] : undefined);
    commit();
    return wait(team);
  },

  async updateTeam(id, patch) {
    const actor = admin();
    const db = getDb();
    const team = db.teams.find((t) => t.id === id);
    if (!team) return fail(404, "NOT_FOUND", "لم يُعثر على الفريق.", "Team not found.");
    const name = checkTeam(patch, id);
    const person = (uid?: number) => db.users.find((u) => u.id === uid)?.name;
    const changes: NonNullable<AuditEntry["changes"]> = [];
    if (name !== team.name) changes.push({ field: "name", from: team.name, to: name });
    if ((patch.lead_id ?? undefined) !== team.lead_id) changes.push({ field: "lead", from: person(team.lead_id), to: person(patch.lead_id ?? undefined) });
    team.name = name;
    team.name_en = patch.name_en?.trim() || undefined;
    team.lead_id = patch.lead_id ?? undefined;
    joinLead(team, patch.lead_id, actor.id);
    if (changes.length) audit(actor.id, "team_changed", { type: "team", id, label: team.name }, changes);
    commit();
    return wait(team);
  },

  async settings() {
    admin();
    return wait(getDb().settings);
  },

  async saveSettings(settings) {
    const actor = admin();
    const problem = settingsProblem(settings);
    if (problem) invalid(problem, "القيمة خارج الحدود المسموحة.", "The value is out of range.");
    const db = getDb();
    const changes = (Object.keys(settings) as (keyof typeof settings)[])
      .filter((k) => settings[k] !== db.settings[k])
      .map((k) => ({ field: k, from: String(db.settings[k]), to: String(settings[k]) }));
    db.settings = { due_soon_days: settings.due_soon_days, lock_after: settings.lock_after, lock_minutes: settings.lock_minutes };
    if (changes.length) audit(actor.id, "settings_changed", { type: "settings", label: "الإعدادات" }, changes);
    commit();
    return wait(db.settings);
  },

  async health() {
    admin();
    const db = getDb();
    const now = nowIso();
    return wait({
      users_active: db.users.filter((u) => u.active).length,
      users_stopped: db.users.filter((u) => !u.active).length,
      users_locked: db.logins.filter((l) => l.locked_until && l.locked_until > now).length,
      projects: db.projects.length,
      tasks: db.tasks.length,
      files: db.attachments.length,
      files_bytes: db.attachments.reduce((s, a) => s + a.size, 0),
      audit_entries: db.audit.length,
      ...demoStorage(),
    });
  },

  async audit(filter) {
    auditReader();
    const db = getDb();
    const q = filter.q?.trim();
    const list = db.audit
      .filter((e) => (!filter.action || e.action === filter.action) && (!filter.actor_id || e.actor_id === filter.actor_id))
      .filter((e) => (!filter.kind || ACTION_KIND[e.action] === filter.kind) && ipMatches(e.ip, filter.ip))
      .filter((e) => (!filter.from || e.at.slice(0, 10) >= filter.from) && (!filter.to || e.at.slice(0, 10) <= filter.to))
      .filter((e) => !q || matches(q, searchText(e, actorWords(e.actor_id), [ACTION_WORDS[e.action].ar, ACTION_WORDS[e.action].en])));
    return wait([...list].reverse());
  },

  async auditEntry(id) {
    auditReader();
    const all = getDb().audit;
    const entry = all.find((e) => e.id === id);
    if (!entry) return fail(404, "NOT_FOUND", "لم يُعثر على هذا السطر في السجل.", "This audit line was not found.");
    const newestFirst = [...all].reverse().filter((e) => e.id !== id);
    // The same person's other actions that day (the browser's day in the demo; the company's time zone on the server).
    const day = dayOf(entry.at);
    const byActor = entry.actor_id === undefined ? [] : newestFirst.filter((e) => e.actor_id === entry.actor_id && dayOf(e.at) === day);
    // The other lines about the same subject: the same kind and id, or the same label when it has no id (a sign-in by email).
    const t = entry.target;
    const sameTarget = (o: AuditEntry["target"]) =>
      o.type === t.type && (t.id !== undefined ? o.id === t.id : o.id === undefined && o.label === t.label);
    // A failed sign-in for an account and that account's lock are about the same person.
    const samePerson = (o: AuditEntry["target"]) =>
      t.id !== undefined && o.id === t.id && ((o.type === "login" && t.type === "user") || (o.type === "user" && t.type === "login"));
    const byTarget = newestFirst.filter((e) => sameTarget(e.target) || samePerson(e.target));
    return wait({ ...entry, related_by_actor: byActor.slice(0, RELATED_LIMIT), related_by_target: byTarget.slice(0, RELATED_LIMIT) });
  },

  async sessions() {
    sessionsAdmin();
    const current = browserSessionId();
    return wait(activeSessions(getDb().sessions ?? [], new Date()).map(({ id, user_id, ip, user_agent, started_at, last_seen_at }) => ({ id, user_id, ip, user_agent, started_at, last_seen_at, current: id === current })));
  },

  async endSession(id) {
    const actor = sessionsAdmin();
    const session = (getDb().sessions ?? []).find((s) => s.id === id);
    if (!session) return fail(404, "NOT_FOUND", "لم يُعثر على الجلسة.", "Session not found.");
    const problem = endSessionProblem(session, browserSessionId(), new Date());
    if (problem === "ended") return fail(404, "NOT_FOUND", "انتهت هذه الجلسة من قبل.", "This session has already ended.");
    if (problem === "current") return fail(409, "BAD_STATE", "هذه جلستك أنت: للخروج استعمل «تسجيل الخروج» من قائمة حسابك.", "This is your own session: to leave, use Sign out in your account menu.");
    endSessions([session], actor.id, "admin");
    commit();
    return wait(undefined);
  },

  async endUserSessions(userId) {
    const actor = sessionsAdmin();
    const db = getDb();
    if (!db.users.some((u) => u.id === userId)) return fail(404, "NOT_FOUND", "لم يُعثر على المستخدم.", "User not found.");
    const list = sessionsToEnd(db.sessions ?? [], userId, browserSessionId(), new Date());
    endSessions(list, actor.id, "everywhere");
    commit();
    return wait({ ended: list.length });
  },

  async unlockUser(userId) {
    const actor = admin();
    const db = getDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return fail(404, "NOT_FOUND", "لم يُعثر على المستخدم.", "User not found.");
    const login = db.logins.find((l) => l.user_id === userId);
    if (!login || !isLocked(login, nowIso())) return fail(409, "BAD_STATE", "هذا الحساب غير مقفل.", "This account isn't locked.");
    login.failed = 0;
    login.locked_until = undefined;
    audit(actor.id, "user_unlocked", { type: "user", id: userId, label: user.name });
    commit();
    return wait(adminUsers().find((u) => u.id === userId)!);
  },

  async securitySummary() {
    sessionsAdmin();
    const db = getDb();
    return wait(securitySummary(db.audit, adminUsers(), db.settings, new Date()));
  },

  async importUsers(rows, dryRun) {
    const actor = admin();
    if (!Array.isArray(rows) || rows.length === 0) invalid("rows", "لا صفوف في الملف.", "The file has no rows.");
    if (rows.length > IMPORT_LIMIT) invalid("rows", `الحد ${IMPORT_LIMIT} صف في المرة الواحدة.`, `At most ${IMPORT_LIMIT} rows at a time.`);
    const db = getDb();
    const checks: ImportCheck[] = checkImportRows(rows, { emails: db.users.map((u) => u.email), teams: db.teams });
    if (dryRun) return wait({ dry_run: true, rows: checks, created: 0, skipped: checks.filter((c) => c.problems.length).length });
    let created = 0;
    for (const check of checks) {
      if (check.problems.length) continue;
      const row = rows[check.line - 1];
      const team = teamFromText(row.team, db.teams) ?? undefined;
      const user: User = {
        id: Math.max(...db.users.map((u) => u.id)) + 1,
        name: row.name.trim(),
        name_en: row.name_en.trim() || undefined,
        email: row.email.trim().toLowerCase(),
        phone: row.phone.trim() || undefined,
        role: roleFromText(row.role)!,
        title: row.title.trim(),
        team_id: team?.id,
        active: true,
      };
      db.users.push(user);
      check.user_id = user.id;
      created++;
      audit(actor.id, "user_created", { type: "user", id: user.id, label: user.name }, [
        { field: "role", to: user.role },
        ...(team ? [{ field: "team", to: team.name }] : []),
        { field: "source", to: "import" },
      ]);
      if (team) notify([user.id], "team_joined", { actor_id: actor.id, data: { note: team.name } });
    }
    const skipped = checks.length - created;
    audit(actor.id, "users_imported", { type: "import", label: `${created} / ${checks.length}` }, [
      { field: "created", to: String(created) },
      { field: "skipped", to: String(skipped) },
    ]);
    commit();
    return wait({ dry_run: false, rows: checks, created, skipped });
  },
};

/** The users as the admin sees them: with their sign-in record and when each account was made. */
function adminUsers(): AdminUser[] {
  const db = getDb();
  // When an account was made: its "added" line in the log (the seeded people from before the log have none).
  const made = new Map(db.audit.filter((e) => e.action === "user_created" && e.target.id !== undefined).map((e) => [e.target.id!, e.at]));
  return db.users.map((u) => {
    const login = db.logins.find((l) => l.user_id === u.id);
    const created = made.get(u.id);
    return { ...u, failed_logins: login?.failed ?? 0, locked_until: login?.locked_until, last_login_at: login?.last_login_at, ...(created ? { created_at: created } : {}) };
  });
}

/** Sessions are read and ended by the admin and the CEO only. */
function sessionsAdmin() {
  const user = currentUser();
  if (!canManageSessions(user)) return fail(403, "FORBIDDEN", "الجلسات لمسؤول النظام والمدير التنفيذي.", "Sessions are for the system admin and the CEO.");
  return user;
}

/** Ends sessions and logs it: one line for one session (with its device and address), one line for "everywhere". */
function endSessions(list: SessionRecord[], actorId: number, reason: NonNullable<SessionRecord["end_reason"]>) {
  if (!list.length) return;
  const db = getDb();
  const at = nowIso();
  for (const s of list) Object.assign(s, { ended_at: at, ended_by: actorId, end_reason: reason });
  const person = db.users.find((u) => u.id === list[0].user_id);
  const target = { type: "user" as const, id: list[0].user_id, label: person?.name ?? "-" };
  const english = (_ar: string, en: string) => en;
  if (reason === "admin") {
    const s = list[0];
    audit(actorId, "session_ended", target, [
      { field: "session", to: shortSession(s.id) },
      { field: "device", to: deviceWords(parseUserAgent(s.user_agent), english) },
      ...(s.ip ? [{ field: "ip", to: s.ip }] : []),
    ]);
  } else if (reason === "everywhere") {
    audit(actorId, "sessions_ended", target, [{ field: "sessions", to: String(list.length) }]);
  }
}

/**
 * The demo's storage by kind: files (voice messages are the audio ones), profile pictures (kept as data: addresses),
 * the audit log as saved. The quota and the backup are invented here; the real server reports its own.
 */
function demoStorage() {
  const db = getDb();
  const voice = db.attachments.filter((a) => a.mime.startsWith("audio/"));
  const files = db.attachments.filter((a) => !a.mime.startsWith("audio/"));
  const pictures = db.users.filter((u) => u.avatar_url);
  // A data: address holds base64: 4 letters for 3 bytes.
  const pictureBytes = pictures.reduce((sum, u) => sum + Math.round(((u.avatar_url!.length - u.avatar_url!.indexOf(",") - 1) * 3) / 4), 0);
  const storage = {
    attachments_bytes: files.reduce((sum, a) => sum + a.size, 0),
    attachments: files.length,
    pictures_bytes: pictureBytes,
    pictures: pictures.length,
    voice_bytes: voice.reduce((sum, a) => sum + a.size, 0),
    voice: voice.length,
    audit_bytes: JSON.stringify(db.audit).length,
  };
  // The backup ran last night at 02:00 (the night before, when it is not yet 03:00).
  const backup = new Date();
  if (backup.getHours() < 3) backup.setDate(backup.getDate() - 1);
  backup.setHours(2, 0, 0, 0);
  const used = storage.attachments_bytes + storage.pictures_bytes + storage.voice_bytes + storage.audit_bytes;
  return {
    storage,
    storage_quota_bytes: 5 * 1024 ** 3,
    backup: { at: backup.toISOString(), status: "ok" as const, size_bytes: Math.round(used * 1.4 + 2_400_000), note: "nightly-backup (demo: invented)" },
    server_version: "demo",
  };
}


/** The audit log is read by the admin and the CEO only. */
function auditReader() {
  const user = currentUser();
  if (!canSeeAudit(user)) return fail(403, "FORBIDDEN", "سجل العمليات للإدارة ومسؤول النظام.", "The audit log is for management and the admin.");
  return user;
}

/** What the search box finds a person by: their names in both languages and their email. */
function actorWords(id?: number) {
  const u = id === undefined ? undefined : getDb().users.find((x) => x.id === id);
  return u ? [u.name, u.name_en ?? "", u.email] : [];
}
