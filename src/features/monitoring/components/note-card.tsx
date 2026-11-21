import { FileText, FolderKanban, HandHelping, MessageSquareHeart, Send, TriangleAlert, User, Users } from "lucide-react";
import type { StatusTone } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { useSession } from "@/shared/lib/session";
import { cn } from "@/shared/lib/utils";
import { MaybeLink, Pill } from "@/shared/ui";
import type { MonitorNote, ReportFacts } from "../types";
import { KIND } from "./note-dialog";

const KIND_ICON = { report: FileText, feedback: MessageSquareHeart, problem: TriangleAlert, request: HandHelping };
const ABOUT_ICON = { team: Users, person: User, project: FolderKanban, general: FileText };
const KIND_TONE: Record<MonitorNote["kind"], StatusTone> = { report: "testing", feedback: "done", problem: "blocked", request: "todo" };

/** Where a note stands with the CEO, in words and a colour. */
export function ceoStateOf(note: MonitorNote): { ar: string; en: string; tone: StatusTone } | null {
  if (!note.sent_at) return null;
  if (note.ceo_state === "done") return { ar: "أنجزها المدير التنفيذي", en: "Done by the CEO", tone: "done" };
  if (note.ceo_state === "seen") return { ar: "اطّلع عليها", en: "Seen", tone: "review" };
  return { ar: "أُرسلت، لم تُفتح بعد", en: "Sent, not opened yet", tone: "progress" };
}

/** A report's counted numbers, small, on its card (the monitoring officer's list and the CEO's inbox). */
function ReportFigures({ facts: f }: { facts: ReportFacts }) {
  const { tr, num, pct, day } = useFmt();
  const items: { k: string; v: string; bad?: boolean }[] = [
    { k: tr("الفترة", "Period"), v: `${day(f.period.from)} – ${day(f.period.to)}` },
    { k: tr("المنجزة", "Done"), v: `${num(f.done)}/${num(f.assigned)} (${pct(f.completion)})` },
    { k: tr("المتأخرة", "Late"), v: num(f.late), bad: f.late > 0 },
    { k: tr("المتوقفة", "Blocked"), v: num(f.blocked), bad: f.blocked > 0 },
    ...(f.planned !== null ? [{ k: tr("المتوقع حسب الخطة", "Planned"), v: pct(f.planned) }] : []),
    { k: tr("أخطاء مفتوحة", "Open bugs"), v: num(f.bugs_open) },
  ];
  return (
    <dl aria-label={tr("أرقام التقرير", "The report's numbers")} className="flex flex-wrap gap-2 text-xs">
      {items.map((i) => (
        <div key={i.k} className="flex gap-1.5 rounded-lg bg-card-2 px-2 py-1">
          <dt className="text-muted">{i.k}</dt>
          <dd className={cn("num font-medium", i.bad && "text-danger")}>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One note: its kind, what it is about, its text, where it stands with the CEO, and the CEO's answer. With `onToggle`,
 * the title is a button that opens and closes the text, and a click anywhere on the card does the same.
 */
export function NoteCard({
  note,
  author,
  actions,
  open = true,
  onToggle,
}: {
  note: MonitorNote;
  author?: string;
  actions?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { tr, lang, ago } = useFmt();
  const Icon = KIND_ICON[note.kind];
  const AboutIcon = ABOUT_ICON[note.about.type];
  const about = note.about.type === "general" ? tr("عام", "General") : lang === "en" && note.about.label_en ? note.about.label_en : note.about.label;
  const state = ceoStateOf(note);
  // Notes are read by their writer and the CEO; the CEO and M&E may open anyone's work and every project.
  const viewer = useSession()?.user;
  const opensAll = !!viewer && (isCeo(viewer) || viewer.role === "monitor");
  const aboutHref = !opensAll || !note.about.id ? undefined : note.about.type === "project" ? `/projects/${note.about.id}` : note.about.type === "person" ? `/performance/${note.about.id}` : note.about.type === "team" ? `/reports?tab=people&team=${note.about.id}` : undefined;
  // Above the card's own button (which covers the card), so these links get the click.
  const inner = "relative z-10";
  return (
    <article className={cn("relative flex flex-col gap-3 rounded-xl border border-line bg-card p-4", onToggle && "hover:border-accent")}>
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={cn("flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink")}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <Pill tone={KIND_TONE[note.kind]}>{tr(KIND[note.kind].ar, KIND[note.kind].en)}</Pill>
        {note.tone && <Pill tone={note.tone === "praise" ? "done" : "review"}>{note.tone === "praise" ? tr("ثناء", "Praise") : tr("شيء يتحسن", "To improve")}</Pill>}
        <span className="inline-flex items-center gap-1">
          <AboutIcon size={13} aria-hidden="true" />
          <MaybeLink href={aboutHref} className={inner}>
            <span dir="auto">{about}</span>
          </MaybeLink>
        </span>
        <span className="ms-auto">
          {author && `${author} · `}
          {ago(note.sent_at ?? note.created_at)}
        </span>
      </header>
      {(note.subject || note.people?.length) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {note.subject && (
            <span>
              {tr("الموضوع", "Subject")}: <b dir="auto" className="font-medium text-text">{note.subject}</b>
            </span>
          )}
          {!!note.people?.length && (
            <span>
              {tr("المعنيون", "Involved")}:{" "}
              <b className="font-medium text-text">
                {note.people.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && tr("، ", ", ")}
                    <MaybeLink href={opensAll ? `/performance/${p.id}` : undefined} className={inner}>
                      {lang === "en" && p.label_en ? p.label_en : p.label}
                    </MaybeLink>
                  </span>
                ))}
              </b>
            </span>
          )}
        </p>
      )}
      <h3 dir="auto" className="text-base font-semibold">
        {onToggle ? (
          // The button covers the whole card (click anywhere), and is what keyboards and screen readers use.
          <button type="button" aria-expanded={open} onClick={onToggle} className="text-start after:absolute after:inset-0 after:rounded-xl">
            {note.title}
          </button>
        ) : (
          note.title
        )}
      </h3>
      {note.facts && <ReportFigures facts={note.facts} />}
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
        <footer className="relative flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
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
