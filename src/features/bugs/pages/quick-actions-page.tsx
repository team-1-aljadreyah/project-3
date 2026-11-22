import { ArrowLeft, Bug as BugIcon, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { projectsApi, type ProjectSummary } from "@/features/projects";
import type { Priority, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today as todayIso } from "@/shared/lib/utils";
import { Button, ButtonLink, Dialog, Empty, ErrorBox, Field, LoadingBlock, PRIORITY, Skeleton, TONE_CLASS, Textarea, errorText, useToast } from "@/shared/ui";
import { bugsApi } from "../api";
import { BUG_STATUS, MOVE_LABEL, SEVERITY } from "../labels";
import { BUG_LIMITS as L, bugLateDays, canManageBugs, isOpen, movesFor, SEVERITY_ORDER } from "../rules";
import type { Bug, BugPatch, BugStatus, Severity } from "../types";

type Queue = "all" | "unassigned" | "late" | "severe" | "testing" | "open";
const QUEUES = ["all", "unassigned", "late", "severe", "testing", "open"] as const;
const PRIORITIES: Priority[] = ["high", "medium", "low"];

/**
 * Quick actions (the client, 22 November 2026): every bug on one line ("All", the first list, closed ones too), for the monitoring officer (and the CEO) to
 * act on without opening it: give it to a developer, change its severity, priority or fix day, and move it a step. The
 * bug tracker page stays as it is; this is the fast desk next to it. Every change is the same server call the bug's own
 * page makes, so it is in the bug's history and the people concerned are told.
 */
export function QuickActionsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("إجراءات سريعة", "Quick actions"));
  const load = useLoad(() => Promise.all([bugsApi.bugs(), projectsApi.projects(), authApi.users()]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-3">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-11 w-full max-w-xl rounded-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && <Desk bugs={load.data[0]} projects={load.data[1]} people={load.data[2]} />}
    </div>
  );
}

function Desk({ bugs: first, projects, people }: { bugs: Bug[]; projects: ProjectSummary[]; people: User[] }) {
  const { tr, lang, num, due } = useFmt();
  const user = useUser();
  const toast = useToast();
  const day = todayIso();
  const [bugs, setBugs] = useState(first);
  const [queue, setQueueRaw] = useQueryParam<Queue>("q", "all", QUEUES);
  // Rows changed here stay in view until another list is chosen, so nothing jumps away under the mouse.
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [sendingBack, setSendingBack] = useState<Bug | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const personOf = new Map(people.map((u) => [u.id, u]));
  const nameOf = (x: { name: string; name_en?: string }) => (lang === "en" && x.name_en ? x.name_en : x.name);

  // Every bug she may handle, closed ones too (they show under "All", where one can be sent back).
  const mine = bugs.filter((b) => {
    const p = projectOf.get(b.project_id);
    return p && canManageBugs(user, p);
  });
  const late = (b: Bug) => bugLateDays(b, day) > 0;
  const fits: Record<Queue, (b: Bug) => boolean> = {
    all: () => true,
    unassigned: (b) => isOpen(b) && !b.assignee_id,
    late: (b) => late(b),
    severe: (b) => isOpen(b) && (b.severity === "critical" || b.severity === "high"),
    testing: (b) => b.status === "testing",
    open: (b) => isOpen(b),
  };
  const count = (q: Queue) => mine.filter(fits[q]).length;
  const shown = mine
    .filter((b) => fits[queue](b) || touched.has(b.id))
    // Open ones first, then the most severe, then the nearest fix day.
    .sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.id - b.id);

  const setQueue = (q: Queue) => {
    setTouched(new Set());
    setQueueRaw(q);
  };

  const done = (b: Bug, what: string) => {
    setBugs((all) => all.map((x) => (x.id === b.id ? b : x)));
    setTouched((t) => new Set(t).add(b.id));
    toast(`${b.code}: ${what}`);
  };

  const change = async (b: Bug, patch: BugPatch, what: string) => {
    setBusy(b.id);
    try {
      done(await bugsApi.update(b.id, patch), what);
    } catch (e) {
      toast(errorText(e, tr));
    } finally {
      setBusy(null);
    }
  };

  const move = async (b: Bug, to: BugStatus, note?: string) => {
    if (to === "reopened" && note === undefined) {
      setReason("");
      setReasonError("");
      setSendingBack(b);
      return;
    }
    setBusy(b.id);
    try {
      done(await bugsApi.move(b.id, to, note), tr(BUG_STATUS[to].ar, BUG_STATUS[to].en));
      setSendingBack(null);
    } catch (e) {
      toast(errorText(e, tr));
    } finally {
      setBusy(null);
    }
  };

  const QUEUE_LABEL: Record<Queue, { ar: string; en: string }> = {
    all: { ar: "الكل", en: "All" },
    unassigned: { ar: "بلا مطوّر", en: "No developer" },
    late: { ar: "متأخرة", en: "Late" },
    severe: { ar: "حرجة وعالية", en: "Critical & high" },
    testing: { ar: "تنتظر الاختبار", en: "Waiting for testing" },
    open: { ar: "كل المفتوحة", en: "All open" },
  };

  const control = "h-8 rounded-lg border border-line bg-card px-2 text-[13px] text-text outline-none transition-colors hover:border-accent/60 focus-visible:border-accent disabled:opacity-60";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Zap size={22} aria-hidden="true" className="text-accent-ink" />
            {tr("إجراءات سريعة", "Quick actions")}
          </h1>
          <p className="text-sm text-muted">
            {tr("كل خطأ مفتوح في سطر واحد: أسنده، غيّر خطورته أو أولويته أو موعده، وانقله خطوة، دون أن تفتحه.", "Every open bug on one line: assign it, change its severity, priority or day, and move it a step, without opening it.")}
          </p>
        </div>
        <ButtonLink href="/bugs" variant="secondary" pill size="sm">
          <BugIcon size={15} aria-hidden="true" />
          {tr("صفحة الأخطاء البرمجية", "The bugs page")}
        </ButtonLink>
      </div>

      <div role="group" aria-label={tr("القائمة", "List")} className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {QUEUES.map((q) => {
          const n = count(q);
          const on = queue === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => setQueue(q)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors",
                on ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-card text-muted hover:border-accent/50 hover:text-text",
              )}
            >
              {tr(QUEUE_LABEL[q].ar, QUEUE_LABEL[q].en)}
              <span className={cn("num min-w-5 rounded-md px-1 text-center text-xs", n > 0 && q !== "open" && q !== "all" ? "bg-accent text-on-accent" : "bg-chip text-muted")}>{num(n)}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Empty title={tr("لا شيء ينتظرك هنا", "Nothing waiting here")} body={tr("اختر قائمة أخرى، أو افتح صفحة الأخطاء البرمجية.", "Choose another list, or open the bugs page.")} />
      ) : (
        <ul aria-label={tr(QUEUE_LABEL[queue].ar, QUEUE_LABEL[queue].en)} className="flex flex-col gap-2">
          {shown.map((b) => {
            const project = projectOf.get(b.project_id)!;
            const members = people.filter((u) => u.active && project.member_ids.includes(u.id));
            const lateBy = bugLateDays(b, day);
            // Giving it a developer is the assign step, so that move is the developer list, not a button.
            const moves = movesFor(user, project, b).filter((m) => m !== "assigned");
            const working = busy === b.id;
            const sev = SEVERITY[b.severity];
            const assignee = b.assignee_id ? personOf.get(b.assignee_id) : undefined;
            return (
              <li key={b.id}>
                <article
                  aria-label={b.title}
                  className={cn(
                    "relative flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-accent/60 lg:flex-row lg:items-center",
                    working && "opacity-70",
                  )}
                >
                  {/* How bad it is, as a strip on the start edge. */}
                  <span aria-hidden="true" className={cn("absolute inset-y-3 start-0 w-1 rounded-e-full", TONE_CLASS[sev.tone].bar)} />
                  {/* The text part opens the bug; the controls sit above that link. */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span dir="ltr" className="font-medium">
                        {b.code}
                      </span>
                      <span>·</span>
                      <span>{nameOf(project)}</span>
                      <span>·</span>
                      <span className={TONE_CLASS[BUG_STATUS[b.status].tone].text}>{tr(BUG_STATUS[b.status].ar, BUG_STATUS[b.status].en)}</span>
                      {lateBy > 0 && <span className="font-medium text-danger">· {due(-lateBy)}</span>}
                    </span>
                    <Link href={`/bugs/${b.id}`} dir="auto" className="truncate font-medium after:absolute after:inset-0 after:rounded-xl hover:underline">
                      {b.title}
                    </Link>
                  </div>

                  <div className="relative z-10 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`qa-dev-${b.id}`}>
                      {tr(`مطوّر ${b.code}`, `${b.code} developer`)}
                    </label>
                    <select
                      id={`qa-dev-${b.id}`}
                      value={b.assignee_id ?? ""}
                      disabled={working}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        const who = id ? personOf.get(id) : undefined;
                        change(b, { assignee_id: id }, who ? tr(`أُسندت إلى ${who.name}`, `assigned to ${who.name_en ?? who.name}`) : tr("بلا مطوّر", "unassigned"));
                      }}
                      className={cn(control, "max-w-40", !assignee && "border-dashed text-muted")}
                    >
                      <option value="">{tr("بلا مطوّر", "No developer")}</option>
                      {members.map((u) => (
                        <option key={u.id} value={u.id}>
                          {nameOf(u)}
                        </option>
                      ))}
                    </select>

                    <label className="sr-only" htmlFor={`qa-sev-${b.id}`}>
                      {tr(`خطورة ${b.code}`, `${b.code} severity`)}
                    </label>
                    <select
                      id={`qa-sev-${b.id}`}
                      value={b.severity}
                      disabled={working}
                      onChange={(e) => {
                        const s = e.target.value as Severity;
                        change(b, { severity: s }, tr(`الخطورة: ${SEVERITY[s].ar}`, `severity: ${SEVERITY[s].en}`));
                      }}
                      className={cn(control, TONE_CLASS[sev.tone].text, "font-medium")}
                    >
                      {SEVERITY_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {tr(SEVERITY[s].ar, SEVERITY[s].en)}
                        </option>
                      ))}
                    </select>

                    <label className="sr-only" htmlFor={`qa-pri-${b.id}`}>
                      {tr(`أولوية ${b.code}`, `${b.code} priority`)}
                    </label>
                    <select
                      id={`qa-pri-${b.id}`}
                      value={b.priority}
                      disabled={working}
                      onChange={(e) => {
                        const p = e.target.value as Priority;
                        change(b, { priority: p }, tr(`الأولوية: ${PRIORITY[p].ar}`, `priority: ${PRIORITY[p].en}`));
                      }}
                      className={control}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {tr(`أولوية ${PRIORITY[p].ar}`, `${PRIORITY[p].en} priority`)}
                        </option>
                      ))}
                    </select>

                    <label className="sr-only" htmlFor={`qa-due-${b.id}`}>
                      {tr(`موعد إصلاح ${b.code}`, `${b.code} fix day`)}
                    </label>
                    <input
                      id={`qa-due-${b.id}`}
                      type="date"
                      value={b.due ?? ""}
                      disabled={working}
                      onChange={(e) => change(b, { due: e.target.value || null }, e.target.value ? tr("تغيّر الموعد", "day changed") : tr("بلا موعد", "no day"))}
                      className={cn(control, "num w-36", lateBy > 0 && "border-danger/60 text-danger")}
                    />

                    {moves.map((to) => (
                      <Button key={to} size="sm" pill variant={to === "reopened" ? "secondary" : "primary"} disabled={working} onClick={() => move(b, to)}>
                        {tr(MOVE_LABEL[to].ar, MOVE_LABEL[to].en)}
                      </Button>
                    ))}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <ArrowLeft size={13} aria-hidden="true" className="ltr:rotate-180" />
        {tr("كل تغيير هنا يُكتب في سجل الخطأ ويُبلَّغ به المعنيون.", "Every change here goes into the bug's history and the people concerned are told.")}
      </p>

      <Dialog
        open={!!sendingBack}
        onClose={() => setSendingBack(null)}
        title={tr("أعدها للمطوّر", "Send it back")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendingBack(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() => {
                if (!sendingBack) return;
                if (!reason.trim()) return setReasonError(tr("اكتب لماذا لم تُحل المشكلة.", "Write why it isn't fixed."));
                move(sendingBack, "reopened", reason.trim());
              }}
            >
              {tr("أعدها للمطوّر", "Send it back")}
            </Button>
          </>
        }
      >
        <Field label={tr("لماذا لم تُحل؟", "Why isn't it fixed?")} htmlFor="qa-reason" error={reasonError}>
          <Textarea id="qa-reason" dir="auto" rows={3} maxLength={L.note} value={reason} invalid={!!reasonError} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </>
  );
}
