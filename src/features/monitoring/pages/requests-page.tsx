import { HandHelping, Inbox, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, Empty, ErrorBox, Field, Input, LoadingBlock, Skeleton, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { canSendRequests, NOTE_LIMITS as L } from "../rules";
import type { MonitorNote } from "../types";

type Tab = "mine" | "received";
const TABS = ["mine", "received"] as const;

/**
 * My requests to the CEO, and what the monitoring officer sent me. Nobody but the monitoring officer messages the CEO
 * directly: everyone sends a request about anything; it reaches the monitoring officer first, who answers it herself or
 * sends it on to the CEO (whose answer comes straight back here). "Received" holds the reports, feedback and problems
 * she chose to send me; opening one tells her I read it.
 */
export function RequestsPage() {
  const { tr, num } = useFmt();
  usePageTitle(tr("طلباتي", "My requests"));
  const user = useUser();
  const toast = useToast();
  const allowed = canSendRequests(user);
  const load = useLoad(() => (allowed ? Promise.all([monitoringApi.notes(), monitoringApi.received()]) : Promise.resolve(null)), [allowed]);
  const [tab, setTab] = useQueryParam<Tab>("tab", "mine", TABS);
  const [writing, setWriting] = useState(false);
  const [added, setAdded] = useState<MonitorNote[]>([]);
  const [opened, setOpened] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => {
    const byId = new Map((load.data?.[0] ?? []).filter((n) => n.kind === "request" && n.author_id === user.id).map((n) => [n.id, n]));
    for (const n of added) byId.set(n.id, n);
    return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [load.data, added, user.id]);
  const received = load.data?.[1] ?? [];
  const unread = received.filter((n) => !n.shared_with?.find((s) => s.id === user.id)?.seen_at).length;

  if (!allowed) return <Empty title={tr("الطلبات تصل إليك في «الوارد»", "Requests reach you in your Inbox")} />;
  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;

  const open = () => {
    setSubject("");
    setTitle("");
    setBody("");
    setErrors({});
    setWriting(true);
  };

  // The monitoring officer's own requests go straight to the CEO; everyone else's reach her first.
  const toMonitor = user.role !== "monitor";
  const send = async () => {
    const problems: Record<string, string> = {};
    if (!subject.trim()) problems.subject = tr("اكتب عن ماذا طلبك.", "Write what your request is about.");
    if (!title.trim()) problems.title = tr("اكتب عنواناً.", "Enter a title.");
    if (!body.trim()) problems.body = tr("اكتب طلبك.", "Write your request.");
    if (Object.keys(problems).length) return setErrors(problems);
    setBusy(true);
    try {
      const note = await monitoringApi.create({ kind: "request", subject, title, body, about: { type: "general" }, send: true });
      setAdded((x) => [...x, note]);
      setWriting(false);
      toast(note.triage === "pending" ? tr("أُرسل طلبك إلى مسؤول المتابعة.", "Your request was sent to the monitoring officer.") : tr("أُرسل طلبك إلى المدير التنفيذي.", "Your request was sent to the CEO."));
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else toast(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  // Opening a note sent to me: show its text, and tell its writer I read it (once).
  const read = (n: MonitorNote) => {
    setOpened(opened === n.id ? null : n.id);
    if (!n.shared_with?.find((s) => s.id === user.id)?.seen_at) monitoringApi.markSeen(n.id).catch(() => {});
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <HandHelping size={22} aria-hidden="true" className="text-accent-ink" />
            {tr("طلباتي", "My requests")}
          </h1>
          <p className="text-sm text-muted">
            {toMonitor
              ? tr("اطلب من المدير التنفيذي ما تشاء: يصل طلبك أولاً إلى مسؤول المتابعة، ويصلك الرد هنا.", "Ask the CEO for anything: your request reaches the monitoring officer first, and the answer comes back here.")
              : tr("طلباتك تصل إلى المدير التنفيذي مباشرة، ويصلك رده هنا.", "Your requests go straight to the CEO; the answer comes back here.")}
          </p>
        </div>
        <Button pill onClick={open}>
          <Plus size={16} aria-hidden="true" />
          {tr("طلب جديد", "New request")}
        </Button>
      </div>

      <div role="tablist" aria-label={tr("اعرض", "Show")} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-chip p-1 [scrollbar-width:none]">
        {(
          [
            { key: "mine", ar: "طلباتي", en: "My requests", icon: HandHelping, n: mine.length },
            { key: "received", ar: "وصلني من المتابعة", en: "Received from monitoring", icon: Inbox, n: unread },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap", tab === t.key ? "bg-card font-semibold shadow-card" : "text-muted hover:text-text")}
          >
            <t.icon size={14} aria-hidden="true" />
            {tr(t.ar, t.en)}
            <span className={cn("num", t.key === "received" && unread > 0 ? "rounded-full bg-accent px-1.5 text-on-accent" : "text-muted")}>{num(t.n)}</span>
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        mine.length === 0 ? (
          <Empty title={tr("لا طلبات بعد", "No requests yet")} body={tr("أرسل أول طلب إلى المدير التنفيذي.", "Send your first request to the CEO.")} />
        ) : (
          <ul aria-label={tr("طلباتي", "My requests")} className="flex flex-col gap-3">
            {mine.map((n) => (
              <li key={n.id}>
                <NoteCard note={n} />
              </li>
            ))}
          </ul>
        )
      ) : received.length === 0 ? (
        <Empty title={tr("لم يصلك شيء بعد", "Nothing received yet")} body={tr("التقارير والملاحظات التي يرسلها إليك مسؤول المتابعة تظهر هنا.", "Reports and notes the monitoring officer sends you show here.")} />
      ) : (
        <ul aria-label={tr("وصلني من المتابعة", "Received from monitoring")} className="flex flex-col gap-3">
          {received.map((n) => {
            const seen = !!n.shared_with?.find((s) => s.id === user.id)?.seen_at;
            return (
              <li key={n.id} className={cn("rounded-xl", !seen && "ring-2 ring-accent/40")}>
                <NoteCard note={n} open={opened === n.id} onToggle={() => read(n)} />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={writing}
        onClose={() => setWriting(false)}
        title={tr("طلب جديد", "New request")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWriting(false)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button onClick={send} disabled={busy}>
              {busy ? tr("جارٍ الإرسال…", "Sending…") : toMonitor ? tr("أرسل الطلب", "Send the request") : tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {toMonitor && <p className="rounded-lg bg-card-2 px-3 py-2 text-xs text-muted">{tr("يصل أولاً إلى مسؤول المتابعة: يجيبك بنفسه أو يرسله إلى المدير التنفيذي.", "It reaches the monitoring officer first: she answers you herself or sends it on to the CEO.")}</p>}
          <Field label={tr("عن ماذا", "What it is about")} hint={tr("أي موضوع، بكلماتك.", "Anything, in your own words.")} htmlFor="request-subject" error={errors.subject}>
            <Input id="request-subject" dir="auto" maxLength={L.subject} value={subject} invalid={!!errors.subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label={tr("العنوان", "Title")} htmlFor="request-title" error={errors.title}>
            <Input id="request-title" dir="auto" maxLength={L.title} value={title} invalid={!!errors.title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={tr("الطلب", "Your request")} htmlFor="request-body" error={errors.body}>
            <Textarea id="request-body" dir="auto" rows={5} maxLength={L.body} value={body} invalid={!!errors.body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
