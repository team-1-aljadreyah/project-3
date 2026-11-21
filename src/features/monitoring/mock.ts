// The demo backend for monitoring notes and the CEO's inbox, with the rules the real server must keep
// (docs/backend.md, section 17). Only the demo build loads it (see ./api.ts).
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import type { MonitoringApi } from "./api";
import { canSeeNote, canSendToCeo, canUseCeoInbox, canWriteNotes, NOTE_LIMITS as L } from "./rules";
import type { MonitorNote, NoteAbout } from "./types";

const newestFirst = (a: MonitorNote, b: MonitorNote) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at);
const ceos = () => getDb().users.filter((u) => u.active && u.role === "ceo").map((u) => u.id);

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
    if (!canWriteNotes(user)) return fail(403, "FORBIDDEN", "كتابة ملاحظات المتابعة لمسؤول المتابعة والتقييم.", "Monitoring notes are for the monitoring officer.");
    const title = input.title.trim();
    const body = input.body.trim();
    if (!["report", "feedback", "problem"].includes(input.kind)) invalid("kind", "نوع غير معروف.", "Unknown kind.");
    if (!title) invalid("title", "اكتب عنواناً.", "Enter a title.");
    if (title.length > L.title) invalid("title", "العنوان أطول من المسموح.", "The title is too long.");
    if (!body) invalid("body", "اكتب النص.", "Enter the text.");
    if (body.length > L.body) invalid("body", "النص أطول من المسموح.", "The text is too long.");
    if (input.kind === "feedback" && input.about.type !== "person") invalid("about", "الملاحظة تكون على شخص.", "Feedback is about a person.");
    if (input.kind === "feedback" && input.about.id === user.id) invalid("about", "اختر شخصاً غيرك.", "Choose someone other than yourself.");
    const db = getDb();
    const note: MonitorNote = {
      id: ++db.seq.note,
      kind: input.kind,
      title,
      body,
      about: aboutOf(input.about),
      ...(input.kind === "feedback" ? { tone: input.tone === "praise" ? "praise" : "improve" } : {}),
      author_id: user.id,
      created_at: nowIso(),
    };
    if (input.send) sendNow(note, user.id);
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

  async inbox() {
    const user = currentUser();
    if (!canUseCeoInbox(user)) return fail(403, "FORBIDDEN", "هذا الوارد للمدير التنفيذي.", "This inbox is the CEO's.");
    return wait(getDb().monitor_notes.filter((n) => n.sent_at).sort(newestFirst));
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
    note.ceo_state = note.ceo_state === "done" && answer.state === "seen" && !reply ? "done" : answer.state;
    if (reply) {
      note.ceo_reply = reply;
      note.replied_at = nowIso();
      notify([note.author_id], "note_answered", { actor_id: user.id, data: { title: note.title, note: reply } });
    }
    commit();
    return wait(note);
  },
};
