import { Archive, Check, Inbox, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, matches } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, Field, Input, LoadingBlock, PrintButton, Select, Skeleton, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NoteCard } from "../components/note-card";
import { KIND } from "../components/note-dialog";
import { canUseCeoInbox, NOTE_LIMITS as L } from "../rules";
import type { MonitorNote, NoteKind } from "../types";

type Show = "open" | "done" | "all";
const SHOW_KEYS = ["open", "done", "all"] as const;
const KIND_KEYS = ["report", "feedback", "problem", "request"] as const;

/**
 * The CEO's inbox: everything monitoring sent (reports, feedback, problems) and everyone's requests. "To handle" is
 * what is new or opened; marking one done moves it to "Done", the archive, where it can be read again any time (and
 * opened again). Opening one marks it seen; the CEO can answer (the writer is told).
 */
export function CeoInboxPage() {
  const { tr, num, lang } = useFmt();
  usePageTitle(tr("الوارد", "Inbox"));
  const user = useUser();
  const toast = useToast();
  const allowed = canUseCeoInbox(user);
  const load = useLoad(() => (allowed ? Promise.all([monitoringApi.inbox(), authApi.users()]) : Promise.resolve(null)), [allowed]);
  const [changed, setChanged] = useState<Map<number, MonitorNote>>(new Map());
  const [openId, setOpenId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  // In the address, so a link (a notification, the dashboard) can open the archive: /inbox?show=done.
  const [show, setShow] = useQueryParam<Show>("show", "open", SHOW_KEYS);
  const [kind, setKind] = useQueryParam<NoteKind | "">("kind", "", ["", ...KIND_KEYS]);
  const [q, setQ] = useState("");

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

  const answer = async (note: MonitorNote, state: "seen" | "done", text?: string, reopen?: boolean) => {
    setBusy(true);
    try {
      const saved = await monitoringApi.answer(note.id, { state, reply: text, ...(reopen ? { reopen } : {}) });
      setChanged((m) => new Map(m).set(saved.id, saved));
      if (text) {
        setReply("");
        toast(tr("أُرسل الرد.", "Your answer was sent."));
      }
      if (state === "done") {
        setOpenId(null);
        toast(tr("نُقلت إلى «المنجزة»: تجدها هناك متى أردت قراءتها مرة أخرى.", 'Moved to "Done": find it there whenever you want to read it again.'));
      }
      if (reopen) toast(tr("أُعيد فتحها: هي الآن في «للمتابعة».", 'Opened again: it is back in "To handle".'));
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

  const isDone = (n: MonitorNote) => n.ceo_state === "done";
  const counts = { open: notes.filter((n) => !isDone(n)).length, done: notes.filter(isDone).length, all: notes.length };
  const waiting = notes.filter((n) => n.ceo_state === "new").length;
  const shown = notes
    .filter((n) => (show === "open" ? !isDone(n) : show === "done" ? isDone(n) : true))
    .filter((n) => !kind || n.kind === kind)
    .filter((n) => matches(q, n.title, n.body, n.subject ?? "", n.about.label ?? "", n.about.label_en ?? "", nameOf(n.author_id) ?? ""));
  const TABS: { key: Show; ar: string; en: string; icon: typeof Inbox }[] = [
    { key: "open", ar: "للمتابعة", en: "To handle", icon: Inbox },
    { key: "done", ar: "المنجزة", en: "Done", icon: Archive },
    { key: "all", ar: "الكل", en: "All", icon: Search },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Inbox size={22} aria-hidden="true" className="text-accent-ink" />
            {tr("الوارد", "Inbox")}
          </h1>
          <p className="text-sm text-muted">
            {waiting ? tr(`لم يُفتح بعد: ${num(waiting)}`, `Not opened yet: ${waiting}`) : tr("فُتح كل ما وصل.", "Everything has been opened.")}
          </p>
        </div>
        <PrintButton target={() => null} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={tr("اعرض", "Show")} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-chip p-1 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={show === t.key}
              onClick={() => setShow(t.key)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap", show === t.key ? "bg-card font-semibold shadow-card" : "text-muted hover:text-text")}
            >
              <t.icon size={14} aria-hidden="true" />
              {tr(t.ar, t.en)} <span className="num text-muted">({num(counts[t.key])})</span>
            </button>
          ))}
        </div>
        <Select aria-label={tr("النوع", "Kind")} value={kind} onChange={(e) => setKind(e.target.value as NoteKind | "")} className="h-9 w-auto">
          <option value="">{tr("كل الأنواع", "Every kind")}</option>
          {KIND_KEYS.map((k) => (
            <option key={k} value={k}>
              {tr(KIND[k].ar, KIND[k].en)}
            </option>
          ))}
        </Select>
        <span className="relative ms-auto w-full sm:w-64">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input type="search" aria-label={tr("ابحث في الوارد", "Search the inbox")} placeholder={tr("ابحث بالعنوان أو الاسم…", "Search by title or name…")} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 ps-9" />
        </span>
      </div>

      {shown.length === 0 ? (
        notes.length === 0 ? (
          <Empty title={tr("لا شيء وارد بعد", "Nothing has arrived yet")} body={tr("تقارير المتابعة وطلبات الجميع تظهر هنا حين تُرسَل.", "Monitoring's reports and everyone's requests show here when they are sent.")} />
        ) : show === "done" && !q && !kind ? (
          <Empty title={tr("لا شيء منجز بعد", "Nothing done yet")} body={tr("ما تضعه «تمّ الإنجاز» يُحفظ هنا لتقرأه متى شئت.", 'What you mark "Done" is kept here, to read again any time.')} />
        ) : (
          <Empty title={tr("لا شيء يطابق", "Nothing matches")} body={tr("جرّب كلمة أخرى أو نوعاً آخر.", "Try another word or kind.")} />
        )
      ) : (
        <>
          <h2 className="sr-only">{tr("الرسائل", "Messages")}</h2>
          <ul aria-label={tr("الوارد", "Inbox")} className="flex flex-col gap-3">
            {shown.map((n) => {
              const isOpen = openId === n.id;
              return (
                <li key={n.id} className={cn("rounded-xl", n.ceo_state === "new" && "ring-2 ring-accent/40", isDone(n) && "opacity-90")}>
                  {/* A click anywhere on the card opens it; opening marks it seen. */}
                  <NoteCard note={n} author={nameOf(n.author_id)} open={isOpen} onToggle={() => open(n)} />
                  {isOpen && (
                    <form
                      noValidate
                      className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-card p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (reply.trim()) answer(n, isDone(n) ? "done" : "seen", reply);
                      }}
                    >
                      <Field label={isDone(n) ? tr("رد إضافي", "Another answer") : tr("الرد", "Your answer")} htmlFor={`reply-${n.id}`}>
                        <Textarea id={`reply-${n.id}`} dir="auto" rows={3} maxLength={L.reply} value={reply} onChange={(e) => setReply(e.target.value)} />
                      </Field>
                      <div className="flex flex-wrap justify-end gap-2">
                        {isDone(n) ? (
                          <Button type="button" variant="secondary" pill disabled={busy} onClick={() => answer(n, "seen", undefined, true)}>
                            <RotateCcw size={15} aria-hidden="true" />
                            {tr("إعادة فتح", "Open again")}
                          </Button>
                        ) : (
                          <Button type="button" variant="secondary" pill disabled={busy} onClick={() => answer(n, "done", reply.trim() || undefined)}>
                            <Check size={15} aria-hidden="true" />
                            {reply.trim() ? tr("أرسل الرد و«تمّ الإنجاز»", "Send and mark done") : tr("تمّ الإنجاز", "Mark done")}
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
        </>
      )}
    </div>
  );
}
