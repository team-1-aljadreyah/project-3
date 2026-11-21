import { Check, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, Field, LoadingBlock, Skeleton, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { canUseCeoInbox, NOTE_LIMITS as L } from "../rules";
import type { MonitorNote } from "../types";

/**
 * The CEO's inbox: everything monitoring sent (reports, feedback, problems), the new ones first. Opening one marks it
 * seen; the CEO can answer (the writer is told) and mark it done.
 */
export function CeoInboxPage() {
  const { tr, num, lang } = useFmt();
  usePageTitle(tr("الوارد من المتابعة", "From monitoring"));
  const user = useUser();
  const toast = useToast();
  const allowed = canUseCeoInbox(user);
  const load = useLoad(() => (allowed ? Promise.all([monitoringApi.inbox(), authApi.users()]) : Promise.resolve(null)), [allowed]);
  const [changed, setChanged] = useState<Map<number, MonitorNote>>(new Map());
  const [openId, setOpenId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const notes = useMemo(() => {
    const list = (load.data?.[0] ?? []).map((n) => changed.get(n.id) ?? n);
    const rank = (n: MonitorNote) => (n.ceo_state === "new" ? 0 : n.ceo_state === "seen" ? 1 : 2);
    return list.sort((a, b) => rank(a) - rank(b) || (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
  }, [load.data, changed]);

  if (!allowed) return <Empty title={tr("هذا الوارد للمدير التنفيذي", "This inbox is the CEO's")} />;
  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;
  const people = new Map(load.data[1].map((p) => [p.id, p]));
  const nameOf = (id: number) => {
    const p = people.get(id);
    return p && (lang === "en" && p.name_en ? p.name_en : p.name);
  };

  const answer = async (note: MonitorNote, state: "seen" | "done", text?: string) => {
    setBusy(true);
    try {
      const saved = await monitoringApi.answer(note.id, { state, reply: text });
      setChanged((m) => new Map(m).set(saved.id, saved));
      if (text) {
        setReply("");
        toast(tr("أُرسل ردك.", "Your answer was sent."));
      } else if (state === "done") toast(tr("عُلّمت منجزة.", "Marked done."));
    } catch (e) {
      toast(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const open = (note: MonitorNote) => {
    setOpenId(openId === note.id ? null : note.id);
    setReply("");
    if (note.ceo_state === "new") answer(note, "seen");
  };

  const waiting = notes.filter((n) => n.ceo_state === "new").length;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Inbox size={22} aria-hidden="true" className="text-accent-ink" />
          {tr("الوارد من المتابعة", "From monitoring")}
        </h1>
        <p className="text-sm text-muted">
          {waiting ? tr(`لم تفتحي بعد: ${num(waiting)}`, `Not opened yet: ${waiting}`) : tr("فتحتِ كل ما وصلك.", "You have opened everything.")}
        </p>
      </div>

      {notes.length === 0 ? (
        <Empty title={tr("لا شيء وارد بعد", "Nothing has arrived yet")} body={tr("حين ترسل المتابعة تقريراً أو ملاحظة أو مشكلة، تظهر هنا.", "When monitoring sends a report, feedback or a problem, it shows here.")} />
      ) : (
        <ul aria-label={tr("الوارد", "Inbox")} className="flex flex-col gap-3">
          {notes.map((n) => {
            const isOpen = openId === n.id;
            return (
              <li key={n.id} className={cn("rounded-xl", n.ceo_state === "new" && "ring-2 ring-accent/40")}>
                {/* The whole card opens it (click anywhere); opening marks it seen. */}
                <button type="button" aria-expanded={isOpen} onClick={() => open(n)} className="block w-full rounded-xl text-start">
                  <NoteCard note={n} author={nameOf(n.author_id)} open={isOpen} />
                </button>
                {isOpen && (
                  <form
                    noValidate
                    className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-card p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (reply.trim()) answer(n, n.ceo_state === "done" ? "done" : "seen", reply);
                    }}
                  >
                    <Field label={tr("ردك", "Your answer")} htmlFor={`reply-${n.id}`}>
                      <Textarea id={`reply-${n.id}`} dir="auto" rows={3} maxLength={L.reply} value={reply} onChange={(e) => setReply(e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      {n.ceo_state !== "done" && (
                        <Button type="button" variant="secondary" pill disabled={busy} onClick={() => answer(n, "done", reply.trim() || undefined)}>
                          <Check size={15} aria-hidden="true" />
                          {tr("عَلّميها منجزة", "Mark done")}
                        </Button>
                      )}
                      <Button type="submit" pill disabled={busy || !reply.trim()}>
                        {tr("أرسل الرد", "Send answer")}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
