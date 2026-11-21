import { HandHelping, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { Button, Dialog, Empty, ErrorBox, Field, Input, LoadingBlock, Skeleton, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { canSendRequests, NOTE_LIMITS as L } from "../rules";
import type { MonitorNote } from "../types";

/**
 * Your requests to the CEO (every job but the CEO). Nobody starts a chat with the CEO: they send a request about anything,
 * and the CEO answers it in her inbox (the answer shows here, and they are told).
 */
export function RequestsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("طلباتي", "My requests"));
  const user = useUser();
  const toast = useToast();
  const allowed = canSendRequests(user);
  const load = useLoad(() => (allowed ? monitoringApi.notes() : Promise.resolve(null)), [allowed]);
  const [writing, setWriting] = useState(false);
  const [added, setAdded] = useState<MonitorNote[]>([]);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => {
    const byId = new Map((load.data ?? []).filter((n) => n.kind === "request").map((n) => [n.id, n]));
    for (const n of added) byId.set(n.id, n);
    return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [load.data, added]);

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
      toast(tr("أُرسل طلبك إلى المدير التنفيذي.", "Your request was sent to the CEO."));
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else toast(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <HandHelping size={22} aria-hidden="true" className="text-accent-ink" />
            {tr("طلباتي", "My requests")}
          </h1>
          <p className="text-sm text-muted">{tr("اطلب من المدير التنفيذي ما تشاء، وسيصلك ردّه هنا.", "Ask the CEO for anything; the answer comes back here.")}</p>
        </div>
        <Button pill onClick={open}>
          <Plus size={16} aria-hidden="true" />
          {tr("طلب جديد", "New request")}
        </Button>
      </div>

      {mine.length === 0 ? (
        <Empty title={tr("لا طلبات بعد", "No requests yet")} body={tr("أرسل أول طلب إلى المدير التنفيذي.", "Send your first request to the CEO.")} />
      ) : (
        <>
        <h2 className="sr-only">{tr("طلباتي", "My requests")}</h2>
        <ul aria-label={tr("طلباتي", "My requests")} className="flex flex-col gap-3">
          {mine.map((n) => (
            <li key={n.id}>
              <NoteCard note={n} />
            </li>
          ))}
        </ul>
        </>
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
              {busy ? tr("جارٍ الإرسال…", "Sending…") : tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
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
