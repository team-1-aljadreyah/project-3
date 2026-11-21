import { FileText, MessageSquareHeart, Plus, Send, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { adminApi } from "@/features/admin";
import { authApi } from "@/features/auth";
import { projectsApi } from "@/features/projects";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, Skeleton, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { NoteDialog } from "../components/note-dialog";
import { canSendToCeo, canWriteNotes } from "../rules";
import type { MonitorNote, NoteKind } from "../types";

type Filter = "all" | NoteKind | "unsent";

/**
 * The monitoring officer's workspace: write reports about teams and people, feedback on anyone, and problems; keep them
 * here; and send any of them to the CEO whenever she wants (the CEO answers in her inbox, and the answer shows here).
 */
export function MonitoringPage() {
  const { tr, num, lang } = useFmt();
  usePageTitle(tr("المتابعة", "Monitoring"));
  const user = useUser();
  const toast = useToast();
  const allowed = canWriteNotes(user);
  const load = useLoad(() => (allowed ? Promise.all([monitoringApi.notes(), authApi.users(), adminApi.teams(), projectsApi.projects()]) : Promise.resolve(null)), [allowed]);
  const [writing, setWriting] = useState<NoteKind | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sending, setSending] = useState<number | null>(null);
  const [extra, setExtra] = useState<MonitorNote[]>([]);

  // The loaded notes, with the ones written or sent since (newest first).
  const notes = useMemo(() => {
    const byId = new Map((load.data?.[0] ?? []).map((n) => [n.id, n]));
    for (const n of extra) byId.set(n.id, n);
    return [...byId.values()].sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at));
  }, [load.data, extra]);

  if (!allowed) return <Empty title={tr("هذه الصفحة لمسؤول المتابعة والتقييم", "This page is for the monitoring officer")} />;
  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;
  const [, people, teams, projects] = load.data;

  const send = async (note: MonitorNote) => {
    setSending(note.id);
    try {
      const sent = await monitoringApi.send(note.id);
      setExtra((x) => [...x.filter((n) => n.id !== sent.id), sent]);
      toast(tr("أُرسلت إلى المدير التنفيذي.", "Sent to the CEO."));
    } catch (e) {
      toast(errorText(e, tr));
    } finally {
      setSending(null);
    }
  };

  const shown = notes.filter((n) => (filter === "all" ? true : filter === "unsent" ? !n.sent_at : n.kind === filter));
  const count = (f: Filter) => notes.filter((n) => (f === "all" ? true : f === "unsent" ? !n.sent_at : n.kind === f)).length;
  const tabs: { key: Filter; ar: string; en: string }[] = [
    { key: "all", ar: "الكل", en: "All" },
    { key: "report", ar: "التقارير", en: "Reports" },
    { key: "feedback", ar: "الملاحظات", en: "Feedback" },
    { key: "problem", ar: "المشاكل", en: "Problems" },
    { key: "unsent", ar: "لم تُرسل", en: "Not sent" },
  ];
  const starts = [
    { kind: "report" as const, icon: FileText, ar: "تقرير عن فريق أو شخص", en: "A report on a team or a person" },
    { kind: "feedback" as const, icon: MessageSquareHeart, ar: "ملاحظة على أي شخص", en: "Feedback on anyone" },
    { kind: "problem" as const, icon: TriangleAlert, ar: "مشكلة تحتاج قراراً", en: "A problem that needs a decision" },
  ];
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const nameOf = (id: number) => {
    const p = peopleById.get(id);
    return p && (lang === "en" && p.name_en ? p.name_en : p.name);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("المتابعة", "Monitoring")}</h1>
          <p className="text-sm text-muted">{tr("اكتب تقاريرك وملاحظاتك، وأرسل ما تشائين إلى المدير التنفيذي متى شئت.", "Write your reports and feedback, and send anything to the CEO whenever you like.")}</p>
        </div>
        <Button pill onClick={() => setWriting("report")}>
          <Plus size={16} aria-hidden="true" />
          {tr("كتابة جديدة", "Write something")}
        </Button>
      </div>

      {/* Three quick ways to start, one per kind. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {starts.map((s) => (
          <button key={s.kind} type="button" onClick={() => setWriting(s.kind)} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 text-start hover:border-accent">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <s.icon size={19} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">{tr(s.ar, s.en)}</span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label={tr("اعرض", "Show")} className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={cn("rounded-full border px-3 py-1.5 text-sm", filter === t.key ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line text-muted hover:text-text")}
          >
            {tr(t.ar, t.en)} <span className="num">{num(count(t.key))}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty title={tr("لا شيء هنا بعد", "Nothing here yet")} body={tr("ما تكتبينه يظهر هنا.", "What you write shows here.")} />
      ) : (
        <ul aria-label={tr("ما كتبته", "What you wrote")} className="flex flex-col gap-3">
          {shown.map((n) => (
            <li key={n.id}>
              <NoteCard
                note={n}
                author={n.author_id !== user.id ? nameOf(n.author_id) : undefined}
                actions={
                  canSendToCeo(user, n) &&
                  n.ceo_state !== "done" && (
                    <Button size="sm" variant={n.sent_at ? "secondary" : "primary"} pill disabled={sending === n.id} onClick={() => send(n)}>
                      <Send size={14} aria-hidden="true" />
                      {n.sent_at ? tr("أرسلها مرة أخرى", "Send again") : tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
                    </Button>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <NoteDialog
        open={writing !== null}
        start={writing ?? "report"}
        onClose={() => setWriting(null)}
        onSaved={(n) => setExtra((x) => [...x, n])}
        people={people}
        teams={teams}
        projects={projects}
        me={user.id}
      />
    </div>
  );
}
