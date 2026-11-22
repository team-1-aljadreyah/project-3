// The demo backend for file attachments, with the rules the real server must keep (docs/backend.md, section 8).
// Only the demo build loads it. The demo keeps each file inside the browser's storage, which is small (about 5 MB for
// everything), so it allows smaller files than the real server: 1 MB each and 3 MB in all.
import { canManageProject } from "@/features/projects";
import { chatMembers } from "@/mock/chat";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import type { User } from "@/shared/api/types";
import { canSeeProject, canTakePart } from "@/shared/lib/access";
import type { AttachmentsApi } from "./api";
import { extensionOf, fileProblem, MAX_FILES } from "./rules";
import type { AttachmentOwner } from "./types";

const DEMO_MAX_FILE = 1024 * 1024;
const DEMO_MAX_TOTAL = 3 * 1024 * 1024;

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
};

/** The project behind an owner (a task's project, or the project itself), if this person may see it. */
function projectOf(user: User, owner: AttachmentOwner) {
  const db = getDb();
  const projectId =
    owner.type === "project" ? owner.id : owner.type === "task" ? db.tasks.find((t) => t.id === owner.id)?.project_id : db.bugs.find((b) => b.id === owner.id)?.project_id;
  const project = db.projects.find((p) => p.id === projectId);
  // Not found and not allowed answer the same, so nobody learns what exists.
  if (!project || !canSeeProject(user, project)) return fail(404, "NOT_FOUND", "لم يُعثر على المطلوب.", "Not found.");
  return project;
}

/**
 * What this person may do with an owner's files: see them (else 404), add, and remove anyone's. A chat message's files
 * follow the chat (its members see them; only the message's writer adds them); the rest follow the project.
 */
function access(user: User, owner: AttachmentOwner) {
  if (owner.type === "message") {
    const message = getDb().messages.find((m) => m.id === owner.id);
    const members = message && chatMembers(message.chat);
    if (!message || !members?.includes(user.id)) return fail(404, "NOT_FOUND", "لم يُعثر على المطلوب.", "Not found.");
    return { canAdd: message.author_id === user.id, canRemoveAny: false };
  }
  const project = projectOf(user, owner);
  return { canAdd: canTakePart(user, project), canRemoveAny: canManageProject(user, project) };
}

/** Writes the add / remove into the task's, bug's or project's history (nobody can hide it, the brief). Not for chat. */
function log(owner: AttachmentOwner, actorId: number, kind: "attachment_added" | "attachment_removed", name: string) {
  const db = getDb();
  const side = kind === "attachment_added" ? { to: name } : { from: name };
  if (owner.type === "message") return;
  if (owner.type === "task") db.events.push({ id: ++db.seq.event, task_id: owner.id, actor_id: actorId, kind, ...side, at: nowIso() });
  else if (owner.type === "bug") db.bug_events.push({ id: ++db.seq.bug_event, bug_id: owner.id, actor_id: actorId, kind, ...side, at: nowIso() });
  else db.project_events.push({ id: ++db.seq.project_event, project_id: owner.id, actor_id: actorId, kind, ...side, at: nowIso() });
}

/** The file as a "data:" link (its bytes written as text), so the demo can keep it in the browser's storage. */
async function toDataUrl(file: File, mime: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(text)}`;
}

export const attachmentsMock: AttachmentsApi = {
  async list(owner) {
    access(currentUser(), owner);
    return wait(getDb().attachments.filter((a) => a.owner_type === owner.type && a.owner_id === owner.id));
  },

  async upload(owner, file) {
    const user = currentUser();
    if (!access(user, owner).canAdd) return fail(403, "FORBIDDEN", "لا يحق لك إرفاق ملفات هنا.", "You can't attach files here.");
    const db = getDb();
    const problem = fileProblem(file, DEMO_MAX_FILE);
    if (problem === "type") invalid("file", "هذا النوع من الملفات غير مسموح.", "This type of file isn't allowed.");
    if (problem === "empty") invalid("file", "الملف فارغ.", "The file is empty.");
    if (problem === "size") invalid("file", "الملف أكبر من 1 م.ب (حد النسخة التجريبية).", "The file is over 1 MB (the demo's limit).");
    if (db.attachments.filter((a) => a.owner_type === owner.type && a.owner_id === owner.id).length >= MAX_FILES) {
      invalid("file", `الحد الأعلى ${MAX_FILES} ملفاً.`, `At most ${MAX_FILES} files.`);
    }
    if (db.attachments.reduce((sum, a) => sum + a.size, 0) + file.size > DEMO_MAX_TOTAL) {
      invalid("file", "امتلأت مساحة الملفات في النسخة التجريبية. احذف ملفاً أولاً.", "The demo's file space is full. Remove a file first.");
    }
    const mime = MIME[extensionOf(file.name)] ?? (file.type || "application/octet-stream");
    const attachment = {
      id: ++db.seq.attachment,
      owner_type: owner.type,
      owner_id: owner.id,
      name: file.name.slice(0, 200),
      size: file.size,
      mime,
      url: await toDataUrl(file, mime),
      uploaded_by: user.id,
      at: nowIso(),
    };
    db.attachments.push(attachment);
    log(owner, user.id, "attachment_added", attachment.name);
    commit();
    return wait(attachment);
  },

  async remove(id) {
    const user = currentUser();
    const db = getDb();
    const a = db.attachments.find((x) => x.id === id);
    if (!a) return fail(404, "NOT_FOUND", "لم يُعثر على الملف.", "File not found.");
    const owner = { type: a.owner_type, id: a.owner_id };
    // The person who added it, or the project's PM or the CEO (a chat file: only the person who sent it).
    if (a.uploaded_by !== user.id && !access(user, owner).canRemoveAny) {
      return fail(403, "FORBIDDEN", "يحذف الملفَ من أضافه، أو مدير القسم.", "Only the person who added it or the department manager can remove it.");
    }
    db.attachments = db.attachments.filter((x) => x.id !== id);
    log(owner, user.id, "attachment_removed", a.name);
    commit();
    return wait(undefined);
  },
};
