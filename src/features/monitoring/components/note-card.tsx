import { FileText, FolderKanban, MessageSquareHeart, Send, TriangleAlert, User, Users } from "lucide-react";
import type { StatusTone } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Pill } from "@/shared/ui";
import type { MonitorNote } from "../types";
import { KIND } from "./note-dialog";

const KIND_ICON = { report: FileText, feedback: MessageSquareHeart, problem: TriangleAlert };
const ABOUT_ICON = { team: Users, person: User, project: FolderKanban, general: FileText };
const KIND_TONE: Record<MonitorNote["kind"], StatusTone> = { report: "testing", feedback: "done", problem: "blocked" };

/** Where a note stands with the CEO, in words and a colour. */
export function ceoStateOf(note: MonitorNote): { ar: string; en: string; tone: StatusTone } | null {
  if (!note.sent_at) return null;
  if (note.ceo_state === "done") return { ar: "أنجزها المدير التنفيذي", en: "Done by the CEO", tone: "done" };
  if (note.ceo_state === "seen") return { ar: "اطّلع عليها", en: "Seen", tone: "review" };
  return { ar: "أُرسلت، لم تُفتح بعد", en: "Sent, not opened yet", tone: "progress" };
}

/** One note: its kind, what it is about, its text, where it stands with the CEO, and the CEO's answer. */
export function NoteCard({ note, author, actions, open = true }: { note: MonitorNote; author?: string; actions?: React.ReactNode; open?: boolean }) {
  const { tr, lang, ago } = useFmt();
  const Icon = KIND_ICON[note.kind];
  const AboutIcon = ABOUT_ICON[note.about.type];
  const about = note.about.type === "general" ? tr("عام", "General") : lang === "en" && note.about.label_en ? note.about.label_en : note.about.label;
  const state = ceoStateOf(note);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={cn("flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink")}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <Pill tone={KIND_TONE[note.kind]}>{tr(KIND[note.kind].ar, KIND[note.kind].en)}</Pill>
        {note.tone && <Pill tone={note.tone === "praise" ? "done" : "review"}>{note.tone === "praise" ? tr("ثناء", "Praise") : tr("شيء يتحسن", "To improve")}</Pill>}
        <span className="inline-flex items-center gap-1">
          <AboutIcon size={13} aria-hidden="true" />
          <span dir="auto">{about}</span>
        </span>
        <span className="ms-auto">
          {author && `${author} · `}
          {ago(note.sent_at ?? note.created_at)}
        </span>
      </header>
      <h3 dir="auto" className="text-base font-semibold">
        {note.title}
      </h3>
      {open && (
        <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line text-muted">
          {note.body}
        </p>
      )}
      {note.ceo_reply && (
        <div className="rounded-lg border-s-4 border-accent bg-card-2 px-3 py-2 text-sm">
          <b className="text-xs font-medium text-accent-ink">{tr("رد المدير التنفيذي", "The CEO's answer")}</b>
          <p dir="auto" className="mt-1 whitespace-pre-line">
            {note.ceo_reply}
          </p>
        </div>
      )}
      {(state || actions) && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
          {state ? (
            <span className="inline-flex items-center gap-1.5">
              <Send size={13} aria-hidden="true" className="text-muted" />
              <Pill tone={state.tone}>{tr(state.ar, state.en)}</Pill>
            </span>
          ) : (
            <span className="text-muted">{tr("لم تُرسل بعد", "Not sent yet")}</span>
          )}
          <span className="ms-auto flex gap-2">{actions}</span>
        </footer>
      )}
    </article>
  );
}
