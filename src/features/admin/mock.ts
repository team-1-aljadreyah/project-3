// The demo backend for the administration and the audit log, with the rules the real server must keep
// (docs/backend.md, section 14). Only the demo build loads it.
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import type { Team, User } from "@/shared/api/types";
import type { AdminApi } from "./api";
import { ADMIN_LIMITS as L, canAdminister, canSeeAudit, isEmail, ROLE_KEYS, settingsProblem } from "./rules";
import type { AuditEntry, TeamInput, UserInput, UserPatch } from "./types";

function admin() {
  const user = currentUser();
  if (!canAdminister(user)) return fail(403, "FORBIDDEN", "هذه الصفحة لمسؤول النظام والمدير التنفيذي.", "This page is for the system admin and the CEO.");
  return user;
}

const teamName = (id?: number) => getDb().teams.find((t) => t.id === id)?.name;

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
    const db = getDb();
    return wait(
      db.users.map((u) => {
        const login = db.logins.find((l) => l.user_id === u.id);
        return { ...u, failed_logins: login?.failed ?? 0, locked_until: login?.locked_until, last_login_at: login?.last_login_at };
      }),
    );
  },

  async createUser(input) {
    const actor = admin();
    checkUser({ ...input, name: input.name ?? "", email: input.email ?? "", role: input.role ?? ("" as never) });
    const db = getDb();
    const user: User = {
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
    checkUser(patch, id);
    const self = id === actor.id;
    if (self && ((patch.role !== undefined && patch.role !== user.role) || patch.active === false)) {
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
    });
  },

  async audit(filter) {
    const user = currentUser();
    if (!canSeeAudit(user)) return fail(403, "FORBIDDEN", "سجل العمليات للإدارة ومسؤول النظام.", "The audit log is for management and the admin.");
    const list = getDb()
      .audit.filter((e) => (!filter.action || e.action === filter.action) && (!filter.actor_id || e.actor_id === filter.actor_id))
      .filter((e) => (!filter.from || e.at.slice(0, 10) >= filter.from) && (!filter.to || e.at.slice(0, 10) <= filter.to));
    return wait([...list].reverse());
  },
};
