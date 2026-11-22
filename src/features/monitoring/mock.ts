// The demo backend for monitoring notes and the CEO's inbox, with the rules the real server must keep
// (docs/backend.md, section 16). Only the demo build loads it (see ./api.ts).
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import { requireFeature } from "@/mock/site";
import { today } from "@/shared/lib/utils";
import type { MonitoringApi } from "./api";
import { canSeeNote, canSendRequests, canSendToCeo, canShareNote, canTriageRequests, canUseCeoInbox, canWriteNotes, NOTE_LIMITS as L } from "./rules";
import { countReport } from "./report";
import type { MonitorNote, NoteAbout, ReportPeriod } from "./types";

const newestFirst = (a: MonitorNote, b: MonitorNote) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at);
const ceos = () => getDb().users.filter((u) => u.active && u.role === "ceo").map((u) => u.id);
const monitors = () => getDb().users.filter((u) => u.active && u.role === "monitor").map((u) => u.id);

/** A request that waits for the monitoring officer (only requests that reached her and she hasn't handled). */
function waiting(id: number) {
  const note = find(id);
  if (note.kind !== "request") return fail(404, "NOT_FOUND", "لم يُعثر على الطلب.", "Request not found.");
  if (note.triage !== "pending") return fail(409, "BAD_STATE", "عولج هذا الطلب من قبل.", "This request was already handled.");
  return note;
}

/** Send a note to more people (not the writer, not the CEO who has her inbox): each is told once. */
function shareTo(note: MonitorNote, ids: number[], actorId: number) {
  const db = getDb();
  const unique = [...new Set(ids)];
  if (unique.length > L.people) invalid("share_ids", "اخترت أشخاصاً أكثر من المسموح.", "Too many people.");
  const added: number[] = [];
  for (const id of unique) {
    const u = db.users.find((x) => x.id === id && x.active);
    if (!u) return invalid("share_ids", "أحد الأشخاص غير موجود.", "One of the people doesn't exist.");
    if (u.id === note.author_id || u.role === "ceo" || note.shared_with?.some((s) => s.id === u.id)) continue;
    (note.shared_with ??= []).push({ id: u.id, label: u.name, label_en: u.name_en, at: nowIso() });
    added.push(u.id);
  }
  if (added.length) notify(added, "note_sent", { actor_id: actorId, data: { title: note.title, queue: "received" } });
}

function find(id: number) {
  const user = currentUser();
  const note = getDb().monitor_notes.find((n) => n.id === id);
  // A note you may not see answers like one that doesn't exist (nobody learns what exists).
  if (!note || !canSeeNote(user, note)) return fail(404, "NOT_FOUND", "لم يُعثر على الملاحظة.", "Note not found.");
  return note;
}

/** The name of what a note is about, copied in when it is written. */
function aboutOf(about: Pick<NoteAbout, "type" | "id">): NoteAbout {
  const db = getDb();
  if (about.type === "general") return { type: "general" };
  const found =
    about.type === "team" ? db.teams.find((t) => t.id === about.id) : about.type === "project" ? db.projects.find((p) => p.id === about.id) : db.users.find((u) => u.id === about.id && u.active);
  if (!found) return invalid("about", "اختر ما يخصّه.", "Choose what it is about.");
  return { type: about.type, id: found.id, label: found.name, label_en: found.name_en };
}

const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** A report's numbers, counted now (the period is checked first). */
function factsFor(about: NoteAbout, period: ReportPeriod) {
  if (!isDay(period?.from) || !isDay(period?.to)) invalid("period", "اختر بداية الفترة ونهايتها.", "Choose the period's start and end.");
  if (period.from > period.to) invalid("period", "بداية الفترة بعد نهايتها.", "The period starts after it ends.");
  if (about.type === "general") invalid("about", "اختر فريقاً أو شخصاً أو مشروعاً.", "Choose a team, a person or a project.");
  const db = getDb();
  return countReport({
    about,
    period: { from: period.from, to: period.to },
    today: today(),
    users: db.users.filter((u) => u.active),
    projects: db.projects,
    tasks: db.tasks,
    bugs: db.bugs,
    counted_at: nowIso(),
  });
}

function sendNow(note: MonitorNote, actorId: number) {
  note.sent_at = nowIso();
  note.ceo_state = "new";
  notify(ceos(), "note_sent", { actor_id: actorId, data: { title: note.title } });
}

export const monitoringMock: MonitoringApi = {
  async notes() {
    const user = currentUser();
    return wait(getDb().monitor_notes.filter((n) => canSeeNote(user, n)).sort(newestFirst));
  },

  async create(input) {
    const user = currentUser();
    const request = input.kind === "request";
    if (request && !canSendRequests(user)) return fail(403, "FORBIDDEN", "الطلبات تُرسَل إلى المدير التنفيذي، لا منه.", "Requests go to the CEO, not from the CEO.");
    if (request) requireFeature(user, "requests");
    if (!request && !canWriteNotes(user)) return fail(403, "FORBIDDEN", "كتابة ملاحظات المتابعة لمسؤول المتابعة والتقييم.", "Monitoring notes are for the monitoring officer.");
    const title = input.title.trim();
    const body = input.body.trim();
    if (!["report", "feedback", "problem", "request"].includes(input.kind)) invalid("kind", "نوع غير معروف.", "Unknown kind.");
    // A request is about anything, in the person's words: the subject is required, and it always goes to the CEO.
    if (request && !input.subject?.trim()) invalid("subject", "اكتب عن ماذا طلبك.", "Write what your request is about.");
    if (!title) invalid("title", "اكتب عنواناً.", "Enter a title.");
    if (title.length > L.title) invalid("title", "العنوان أطول من المسموح.", "The title is too long.");
    if (!body) invalid("body", "اكتب النص.", "Enter the text.");
    if (body.length > L.body) invalid("body", "النص أطول من المسموح.", "The text is too long.");
    if (input.kind === "feedback" && input.about.type !== "person") invalid("about", "الملاحظة تكون على شخص.", "Feedback is about a person.");
    if (input.kind === "feedback" && input.about.id === user.id) invalid("about", "اختر شخصاً غيرك.", "Choose someone other than yourself.");
    const subject = input.subject?.trim() || undefined;
    if (subject && subject.length > L.subject) invalid("subject", "الموضوع أطول من المسموح.", "The subject is too long.");
    const ids = [...new Set(input.people_ids ?? [])];
    if (ids.length > L.people) invalid("people_ids", "اخترت أشخاصاً أكثر من المسموح.", "Too many people.");
    const people = ids.map((id) => {
      const u = getDb().users.find((x) => x.id === id && x.active);
      if (!u) return invalid("people_ids", "أحد الأشخاص غير موجود.", "One of the people doesn't exist.");
      return { id: u.id, label: u.name, label_en: u.name_en };
    });
    if (input.period && input.kind !== "report") invalid("period", "الفترة للتقارير فقط.", "A period is for reports only.");
    const about = aboutOf(input.about);
    const facts = input.period ? factsFor(about, input.period) : undefined;
    const db = getDb();
    const note: MonitorNote = {
      id: ++db.seq.note,
      kind: input.kind,
      title,
      body,
      about,
      ...(input.kind === "feedback" ? { tone: input.tone === "praise" ? "praise" : "improve" } : {}),
      ...(subject ? { subject } : {}),
      ...(people.length ? { people } : {}),
      author_id: user.id,
      created_at: nowIso(),
      ...(facts ? { facts } : {}),
    };
    if (request) {
      // Requests reach the monitoring officer first (the client, 22 November 2026); hers, or any request when there is
      // no monitoring officer, go straight to the CEO.
      const firstStop = monitors().filter((id) => id !== user.id);
      if (user.role === "monitor" || !firstStop.length) sendNow(note, user.id);
      else {
        note.triage = "pending";
        notify(firstStop, "note_sent", { actor_id: user.id, data: { title: note.title, queue: "monitor" } });
      }
    } else {
      if (input.send) sendNow(note, user.id);
      if (input.share_ids?.length) shareTo(note, input.share_ids, user.id);
    }
    db.monitor_notes.push(note);
    commit();
    return wait(note);
  },

  async send(id) {
    const user = currentUser();
    const note = find(id);
    if (!canSendToCeo(user, note)) return fail(403, "FORBIDDEN", "يرسلها من كتبها.", "Only its writer sends it.");
    sendNow(note, user.id);
    commit();
    return wait(note);
  },

  async forwardRequest(id, raw) {
    const user = currentUser();
    if (!canTriageRequests(user)) return fail(403, "FORBIDDEN", "الطلبات تمر بمسؤول المتابعة.", "Requests go through the monitoring officer.");
    const note = waiting(id);
    const text = raw?.trim();
    if (text && text.length > L.reply) invalid("note", "الملاحظة أطول من المسموح.", "The note is too long.");
    note.triage = "forwarded";
    note.triaged_by = user.id;
    note.triaged_at = nowIso();
    if (text) note.forward_note = text;
    sendNow(note, user.id);
    commit();
    return wait(note);
  },

  async answerRequest(id, raw) {
    const user = currentUser();
    if (!canTriageRequests(user)) return fail(403, "FORBIDDEN", "الطلبات تمر بمسؤول المتابعة.", "Requests go through the monitoring officer.");
    const note = waiting(id);
    const reply = raw?.trim();
    if (!reply) invalid("reply", "اكتب ردك.", "Write your answer.");
    if (reply.length > L.reply) invalid("reply", "الرد أطول من المسموح.", "The reply is too long.");
    note.triage = "answered";
    note.triaged_by = user.id;
    note.triaged_at = nowIso();
    note.monitor_reply = reply;
    notify([note.author_id], "note_answered", { actor_id: user.id, data: { title: note.title, note: reply, note_kind: "request" } });
    commit();
    return wait(note);
  },

  async share(id, userIds) {
    const user = currentUser();
    const note = find(id);
    if (!canShareNote(user, note)) return fail(403, "FORBIDDEN", "يرسلها من كتبها.", "Only its writer sends it.");
    if (!Array.isArray(userIds) || !userIds.length) invalid("share_ids", "اختر شخصاً واحداً على الأقل.", "Choose at least one person.");
    shareTo(note, userIds, user.id);
    commit();
    return wait(note);
  },

  async received() {
    const user = currentUser();
    return wait(getDb().monitor_notes.filter((n) => n.shared_with?.some((s) => s.id === user.id)).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },

  async markSeen(id) {
    const user = currentUser();
    const note = find(id);
    const mine = note.shared_with?.find((s) => s.id === user.id);
    if (!mine) return fail(404, "NOT_FOUND", "لم يُعثر على الملاحظة.", "Note not found.");
    if (!mine.seen_at) {
      mine.seen_at = nowIso();
      commit({ own: true });
    }
    return wait(note);
  },

  async inbox() {
    const user = currentUser();
    if (!canUseCeoInbox(user)) return fail(403, "FORBIDDEN", "هذا الوارد للمدير التنفيذي.", "This inbox is the CEO's.");
    return wait(getDb().monitor_notes.filter((n) => n.sent_at).sort(newestFirst));
  },

  async reportFacts(about, period) {
    const user = currentUser();
    if (!canWriteNotes(user)) return fail(403, "FORBIDDEN", "التقارير لمسؤول المتابعة والتقييم.", "Reports are for the monitoring officer.");
    if (!["team", "person", "project"].includes(about?.type)) invalid("about", "اختر فريقاً أو شخصاً أو مشروعاً.", "Choose a team, a person or a project.");
    return wait(factsFor(aboutOf(about), period));
  },

  async answer(id, answer) {
    const user = currentUser();
    if (!canUseCeoInbox(user)) return fail(403, "FORBIDDEN", "هذا الوارد للمدير التنفيذي.", "This inbox is the CEO's.");
    const note = find(id);
    if (!note.sent_at) return fail(404, "NOT_FOUND", "لم يُعثر على الملاحظة.", "Note not found.");
    const reply = answer.reply?.trim();
    if (reply && reply.length > L.reply) invalid("reply", "الرد أطول من المسموح.", "The reply is too long.");
    if (answer.state !== "seen" && answer.state !== "done") invalid("state", "حالة غير معروفة.", "Unknown state.");
    // "Done" stays done when the CEO only opens it again.
    note.ceo_state = answer.reopen ? "seen" : note.ceo_state === "done" && answer.state === "seen" && !reply ? "done" : answer.state;
    if (reply) {
      note.ceo_reply = reply;
      note.replied_at = nowIso();
      notify([note.author_id], "note_answered", { actor_id: user.id, data: { title: note.title, note: reply, note_kind: note.kind } });
    }
    commit();
    return wait(note);
  },
};
