import { Calculator, FileText, Forward, MessageSquareHeart, MessageSquareReply, Plus, Send, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { adminApi } from "@/features/admin";
import { authApi } from "@/features/auth";
import { projectsApi } from "@/features/projects";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, PrintButton, Skeleton, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { NoteDialog } from "../components/note-dialog";
import { RequestDialog } from "../components/request-dialog";
import { ShareDialog } from "../components/share-dialog";
import { canSendToCeo, canShareNote, canTriageRequests, canWriteNotes } from "../rules";
import type { MonitorNote, NoteKind } from "../types";

type Filter = "all" | NoteKind | "unsent" | "requests";
const FILTERS = ["all", "report", "feedback", "problem", "unsent", "requests"] as const;

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
  // In the address, so her notification opens the requests waiting for her: /monitoring?show=requests.
  const [filter, setFilter] = useQueryParam<Filter>("show", "all", FILTERS);
  const [handling, setHandling] = useState<{ note: MonitorNote; mode: "forward" | "answer" } | null>(null);
  const [sharing, setSharing] = useState<MonitorNote | null>(null);
  const list = useRef<HTMLUListElement>(null);
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

  // Her own notes, and the requests that reached her (others' requests; hers go straight to the CEO).
  const own = notes.filter((n) => n.kind !== "request");
  const requests = notes
    .filter((n) => n.kind === "request" && n.author_id !== user.id)
    .sort((a, b) => Number(b.triage === "pending") - Number(a.triage === "pending") || b.created_at.localeCompare(a.created_at));
  const pending = requests.filter((n) => n.triage === "pending").length;
  const pick = (f: Filter) => (f === "requests" ? requests : own.filter((n) => (f === "all" ? true : f === "unsent" ? !n.sent_at && !n.shared_with?.length : n.kind === f)));
  const shown = pick(filter);
  const count = (f: Filter) => (f === "requests" ? pending : pick(f).length);
  const done = (n: MonitorNote) => setExtra((x) => [...x.filter((y) => y.id !== n.id), n]);
  const tabs: { key: Filter; ar: string; en: string }[] = [
    ...(canTriageRequests(user) ? [{ key: "requests" as const, ar: "الطلبات الواردة", en: "Incoming requests" }] : []),
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
          <p className="text-sm text-muted">{tr("اكتب تقاريرك وملاحظاتك وأرسلها إلى من تشاء، وتصلك طلبات الجميع قبل المدير التنفيذي.", "Write your reports and feedback and send them to anyone; everyone's requests reach you before the CEO.")}</p>
        </div>
        <Button pill onClick={() => setWriting("report")}>
          <Plus size={16} aria-hidden="true" />
          {tr("كتابة جديدة", "Write something")}
        </Button>
      </div>

      {/* Quick ways to start: the report builder, then one per kind. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/monitoring/report" className="flex items-center gap-3 rounded-xl border border-accent bg-accent-soft p-4 text-start hover:bg-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
            <Calculator size={19} aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium">{tr("تقرير بالأرقام", "A report with the numbers")}</span>
            <span className="text-xs text-muted">{tr("صانع التقارير", "Report builder")}</span>
          </span>
        </Link>
        {starts.map((s) => (
          <button key={s.kind} type="button" onClick={() => setWriting(s.kind)} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 text-start hover:border-accent">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <s.icon size={19} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">{tr(s.ar, s.en)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
            {tr(t.ar, t.en)} <span className={cn("num", t.key === "requests" && pending > 0 && "rounded-full bg-accent px-1.5 text-on-accent")}>{num(count(t.key))}</span>
          </button>
        ))}
      </div>
        {/* Next to the tabs, not among them: a tab list holds only tabs. */}
        {shown.length > 0 && <PrintButton target={() => list.current} label={tr("اطبع القائمة أو احفظها PDF", "Print the list or save as PDF")} className="ms-auto" />}
      </div>

      {shown.length === 0 ? (
        filter === "requests" ? (
          <Empty title={tr("لا طلبات تنتظرك", "No requests waiting for you")} body={tr("طلبات الجميع إلى المدير التنفيذي تصل إليك هنا أولاً.", "Everyone's requests to the CEO reach you here first.")} />
        ) : (
          <Empty title={tr("لا شيء هنا بعد", "Nothing here yet")} body={tr("ما تكتبينه يظهر هنا.", "What you write shows here.")} />
        )
      ) : (
        <>
        <h2 className="sr-only">{filter === "requests" ? tr("الطلبات الواردة", "Incoming requests") : tr("ما كتبته", "What you wrote")}</h2>
        <ul ref={list} aria-label={filter === "requests" ? tr("الطلبات الواردة", "Incoming requests") : tr("ما كتبته", "What you wrote")} className="flex flex-col gap-3">
          {shown.map((n) => (
            <li key={n.id}>
              <NoteCard
                note={n}
                author={n.author_id !== user.id ? nameOf(n.author_id) : undefined}
                actions={
                  n.kind === "request" ? (
                    // A request waiting for her: send it on to the CEO, or answer it herself.
                    n.triage === "pending" &&
                    canTriageRequests(user) && (
                      <>
                        <Button size="sm" variant="secondary" pill onClick={() => setHandling({ note: n, mode: "answer" })}>
                          <MessageSquareReply size={14} aria-hidden="true" />
                          {tr("أجب بنفسك", "Answer yourself")}
                        </Button>
                        <Button size="sm" pill onClick={() => setHandling({ note: n, mode: "forward" })}>
                          <Forward size={14} aria-hidden="true" className="rtl:-scale-x-100" />
                          {tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      {canShareNote(user, n) && (
                        <Button size="sm" variant="secondary" pill onClick={() => setSharing(n)}>
                          <Users size={14} aria-hidden="true" />
                          {tr("أرسل إلى آخرين", "Send to others")}
                        </Button>
                      )}
                      {canSendToCeo(user, n) && n.ceo_state !== "done" && (
                        <Button size="sm" variant={n.sent_at ? "secondary" : "primary"} pill disabled={sending === n.id} onClick={() => send(n)}>
                          <Send size={14} aria-hidden="true" />
                          {n.sent_at ? tr("أرسلها مرة أخرى", "Send again") : tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
                        </Button>
                      )}
                    </>
                  )
                }
              />
            </li>
          ))}
        </ul>
        </>
      )}

      <RequestDialog note={handling?.note ?? null} mode={handling?.mode ?? "forward"} onClose={() => setHandling(null)} onDone={done} />
      <ShareDialog note={sharing} people={people} me={user.id} onClose={() => setSharing(null)} onDone={done} />

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
