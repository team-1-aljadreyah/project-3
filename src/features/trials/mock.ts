// The demo backend for trial teams, with the rules the real server must keep (docs/backend.md, section 24). Only the
// demo build loads it. Each trial team belongs to the monitoring officer who made it: nobody else sees it, not even
// another monitoring officer or the CEO (404, so nobody learns which exist).
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import type { User } from "@/shared/api/types";
import { isRealDay } from "@/shared/lib/birthday";
import { today } from "@/shared/lib/utils";
import type { TrialsApi } from "./api";
import { averageOf, canUseTrials, DECISIONS, memberRow, TRIAL_LIMITS as L } from "./rules";
import type { TrialMember, TrialStore, TrialTeam, TrialTeamRow } from "./types";

const store = (): TrialStore => (getDb().trials ??= { teams: [], members: [], entries: [] });
const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id)) + 1;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function monitor(): User {
  const user = currentUser();
  if (!canUseTrials(user)) return fail(403, "FORBIDDEN", "الفرق التجريبية لمسؤول المتابعة فقط.", "Trial teams are for the monitoring officer only.");
  return user;
}

/** Her own trial team; anyone else's answers "not found". */
function teamOf(user: User, id: number): TrialTeam {
  const team = store().teams.find((t) => t.id === id && t.created_by === user.id);
  if (!team) return fail(404, "NOT_FOUND", "لم يُعثر على الفريق التجريبي.", "Trial team not found.");
  return team;
}

function memberOf(user: User, id: number): TrialMember {
  const member = store().members.find((m) => m.id === id);
  if (!member) return fail(404, "NOT_FOUND", "لم يُعثر على العضو.", "Member not found.");
  teamOf(user, member.team_id);
  return member;
}

function checkTeam(input: { name?: string; goal?: string; started_on?: string }) {
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > L.name)) invalid("name", "اكتب اسم الفريق.", "Enter the team's name.");
  if (input.goal !== undefined && input.goal.trim().length > L.goal) invalid("goal", `الهدف أطول من ${L.goal} حرف.`, `At most ${L.goal} characters.`);
  if (input.started_on !== undefined && (!isRealDay(input.started_on) || input.started_on > today())) invalid("started_on", "اكتب يوم بدء صحيحاً، ليس في المستقبل.", "Enter a real start day, not in the future.");
}

function checkMember(input: { name?: string; specialty?: string; phone?: string; email?: string; joined_on?: string }) {
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > L.member)) invalid("name", "اكتب الاسم.", "Enter the name.");
  if (input.specialty !== undefined && (!input.specialty.trim() || input.specialty.trim().length > L.specialty)) invalid("specialty", "اكتب التخصص أو العمل.", "Enter what they do.");
  if (input.phone && input.phone.trim().length > L.phone) invalid("phone", "رقم الهاتف أطول من المسموح.", "The phone number is too long.");
  if (input.email && !isEmail(input.email.trim())) invalid("email", "اكتب بريداً إلكترونياً صحيحاً.", "Enter a valid email.");
  if (input.joined_on && (!isRealDay(input.joined_on) || input.joined_on > today())) invalid("joined_on", "اكتب يوماً صحيحاً، ليس في المستقبل.", "Enter a real day, not in the future.");
}

const optional = (s?: string) => s?.trim() || undefined;

export const trialsMock: TrialsApi = {
  async teams() {
    const user = monitor();
    const { teams, members, entries } = store();
    const rows: TrialTeamRow[] = teams
      .filter((t) => t.created_by === user.id)
      .map((t) => {
        const people = members.filter((m) => m.team_id === t.id);
        const ids = new Set(people.map((m) => m.id));
        const mine = entries.filter((e) => ids.has(e.member_id));
        return {
          ...t,
          members: people.length,
          average: averageOf(mine.flatMap((e) => (e.score ? [e.score] : []))),
          entries: mine.length,
          accepted: people.filter((m) => m.decision === "accepted").length,
        };
      })
      .sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : a.status === "running" ? -1 : 1));
    return wait(rows);
  },

  async team(id) {
    const user = monitor();
    const team = teamOf(user, id);
    const { members, entries } = store();
    const people = members.filter((m) => m.team_id === id);
    const ids = new Set(people.map((m) => m.id));
    const mine = entries.filter((e) => ids.has(e.member_id)).sort((a, b) => b.at.localeCompare(a.at));
    return wait({ team, members: people.map((m) => memberRow(m, mine)), entries: mine });
  },

  async createTeam(input) {
    const user = monitor();
    checkTeam({ ...input, name: input.name ?? "", started_on: input.started_on ?? "" });
    const s = store();
    const team: TrialTeam = {
      id: nextId(s.teams),
      name: input.name.trim(),
      ...(optional(input.goal) ? { goal: optional(input.goal) } : {}),
      started_on: input.started_on,
      status: "running",
      created_by: user.id,
      created_at: nowIso(),
    };
    s.teams.push(team);
    commit();
    return wait(team);
  },

  async updateTeam(id, patch) {
    const user = monitor();
    const team = teamOf(user, id);
    checkTeam(patch);
    if (patch.status !== undefined && !["running", "ended"].includes(patch.status)) invalid("status", "حالة غير معروفة.", "Unknown state.");
    if (patch.name !== undefined) team.name = patch.name.trim();
    if (patch.goal !== undefined) {
      if (optional(patch.goal)) team.goal = optional(patch.goal);
      else delete team.goal;
    }
    if (patch.started_on !== undefined) team.started_on = patch.started_on;
    if (patch.status && patch.status !== team.status) {
      team.status = patch.status;
      if (patch.status === "ended") team.ended_on = today();
      else delete team.ended_on;
    }
    commit();
    return wait(team);
  },

  async addMember(teamId, input) {
    const user = monitor();
    teamOf(user, teamId);
    checkMember({ ...input, name: input.name ?? "", specialty: input.specialty ?? "" });
    const s = store();
    if (s.members.filter((m) => m.team_id === teamId).length >= L.members) invalid("name", `الفريق التجريبي يتسع لـ ${L.members} عضواً.`, `A trial team holds up to ${L.members} people.`);
    const member: TrialMember = {
      id: nextId(s.members),
      team_id: teamId,
      name: input.name.trim(),
      specialty: input.specialty.trim(),
      ...(optional(input.phone) ? { phone: optional(input.phone) } : {}),
      ...(optional(input.email) ? { email: optional(input.email)!.toLowerCase() } : {}),
      joined_on: input.joined_on || today(),
      decision: "pending",
      created_at: nowIso(),
    };
    s.members.push(member);
    commit();
    return wait(member);
  },

  async updateMember(id, patch) {
    const user = monitor();
    const member = memberOf(user, id);
    checkMember(patch);
    if (patch.decision !== undefined && !DECISIONS.includes(patch.decision)) invalid("decision", "قرار غير معروف.", "Unknown decision.");
    if (patch.name !== undefined) member.name = patch.name.trim();
    if (patch.specialty !== undefined) member.specialty = patch.specialty.trim();
    for (const field of ["phone", "email"] as const) {
      if (patch[field] === undefined) continue;
      const value = optional(patch[field]);
      if (value) member[field] = field === "email" ? value.toLowerCase() : value;
      else delete member[field];
    }
    if (patch.joined_on) member.joined_on = patch.joined_on;
    if (patch.decision) member.decision = patch.decision;
    commit();
    return wait(member);
  },

  async removeMember(id) {
    const user = monitor();
    memberOf(user, id);
    const s = store();
    s.members = s.members.filter((m) => m.id !== id);
    s.entries = s.entries.filter((e) => e.member_id !== id);
    commit();
    return wait(undefined);
  },

  async addEntry(memberId, input) {
    const user = monitor();
    memberOf(user, memberId);
    const text = optional(input.text);
    if (input.score !== undefined && (!Number.isInteger(input.score) || input.score < 1 || input.score > 5)) invalid("score", "اختر درجة من 1 إلى 5.", "Choose a score from 1 to 5.");
    if (!input.score && !text) invalid("text", "اختر درجة أو اكتب ملاحظة.", "Choose a score or write a note.");
    if (text && text.length > L.text) invalid("text", `الملاحظة أطول من ${L.text} حرف.`, `At most ${L.text} characters.`);
    const s = store();
    const entry = { id: nextId(s.entries), member_id: memberId, ...(input.score ? { score: input.score } : {}), ...(text ? { text } : {}), by_id: user.id, at: nowIso() };
    s.entries.push(entry);
    commit();
    return wait(entry);
  },

  async removeEntry(id) {
    const user = monitor();
    const s = store();
    const entry = s.entries.find((e) => e.id === id);
    if (!entry) return fail(404, "NOT_FOUND", "لم يُعثر على التقييم.", "Entry not found.");
    memberOf(user, entry.member_id);
    s.entries = s.entries.filter((e) => e.id !== id);
    commit();
    return wait(undefined);
  },
};
