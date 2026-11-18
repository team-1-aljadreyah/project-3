import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { AttachmentsPanel } from "@/features/attachments";
import { authApi } from "@/features/auth";
import { projectsApi, type Project } from "@/features/projects";
import { tasksApi, type Task } from "@/features/tasks";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { useFmt, type Fmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { today as todayIso } from "@/shared/lib/utils";
import { Avatar, Button, Dialog, ErrorBox, Field, LoadingBlock, Pill, PriorityPill, Skeleton, Textarea, errorText, useToast } from "@/shared/ui";
import { bugsApi } from "../api";
import { BugEditDialog } from "../components/bug-edit-dialog";
import { BUG_STATUS, MOVE_LABEL, SEVERITY } from "../labels";
import { BUG_LIMITS as L, bugLateDays, canManageBugs, canReportBug, movesFor } from "../rules";
import type { Bug, BugEvent, BugStatus } from "../types";

interface Loaded {
  bug: Bug;
  project: Project;
  task?: Task;
  people: User[];
  history: BugEvent[];
}

/** One bug: what happened, where it is in the flow (with the moves this person may make), its files and history. */
export function BugPage() {
  const id = Number(useParams().id);
  const load = useLoad<Loaded>(async () => {
    const bug = await bugsApi.bug(id);
    const [project, people, history, task] = await Promise.all([
      projectsApi.project(bug.project_id),
      authApi.users(),
      bugsApi.history(id),
      bug.task_id ? tasksApi.task(bug.task_id) : Promise.resolve(undefined),
    ]);
    return { bug, project, people, history, task };
  }, [id]);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} backHref="/bugs" onRetry={load.reload} />;
  return <BugView {...load.state.data} />;
}

/** One history line in words. */
function eventText(e: BugEvent, fmt: Fmt, people: Map<number, User>) {
  const { tr, lang, day } = fmt;
  const person = (id?: string) => {
    const u = id ? people.get(Number(id)) : undefined;
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("لا أحد", "nobody");
  };
  const status = (s?: string) => (s && s in BUG_STATUS ? tr(BUG_STATUS[s as BugStatus].ar, BUG_STATUS[s as BugStatus].en) : "-");
  switch (e.kind) {
    case "created":
      return tr("سجّل المشكلة", "reported the bug");
    case "status":
      return tr(`نقلها من «${status(e.from)}» إلى «${status(e.to)}»`, `moved it from "${status(e.from)}" to "${status(e.to)}"`);
    case "assignee":
      return tr(`حوّلها إلى ${person(e.to)}`, `gave it to ${person(e.to)}`);
    case "severity":
      return tr("غيّر درجة الخطورة", "changed the severity");
    case "priority":
      return tr("غيّر الأولوية", "changed the priority");
    case "due":
      return tr(`غيّر الموعد المتوقع إلى ${e.to ? day(e.to) : "-"}`, `set the expected day to ${e.to ? day(e.to) : "-"}`);
    case "edited":
      return tr("عدّل العنوان أو الوصف", "edited the title or description");
    case "attachment_added":
      return tr(`أرفق الملف «${e.to ?? "-"}»`, `attached "${e.to ?? "-"}"`);
    case "attachment_removed":
      return tr(`حذف الملف «${e.from ?? "-"}»`, `removed the file "${e.from ?? "-"}"`);
  }
}

function BugView({ bug, project, task, people, history }: Loaded) {
  const fmt = useFmt();
  const { tr, lang, day, due, dateTime } = fmt;
  const user = useUser();
  const toast = useToast();
  usePageTitle(bug.title);
  const [editing, setEditing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const peopleById = new Map(people.map((u) => [u.id, u]));
  const nameOf = (id?: number) => {
    const u = id ? peopleById.get(id) : undefined;
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("غير مُسندة", "Unassigned");
  };
  const projectName = lang === "en" && project.name_en ? project.name_en : project.name;
  const moves = movesFor(user, project, bug);
  const lateBy = bugLateDays(bug, todayIso());
  const phase = project.phases.find((p) => p.id === bug.phase_id);

  const move = async (to: BugStatus, why?: string) => {
    try {
      await bugsApi.move(bug.id, to, why);
      toast(tr(`صارت «${BUG_STATUS[to].ar}».`, `Now "${BUG_STATUS[to].en}".`));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.errors?.note) setNoteError(e.errors.note);
      else toast(errorText(e, tr), "danger");
      return false;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
          <Link to="/bugs" className="hover:text-text hover:underline">
            {tr("الأخطاء البرمجية", "Bugs")}
          </Link>
          <span aria-hidden="true"> / </span>
          <span dir="ltr">{bug.code}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 dir="auto" className="max-w-3xl text-2xl leading-snug font-semibold">
            {bug.title}
          </h1>
          {canManageBugs(user, project) && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" />
              {tr("تعديل", "Edit")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={BUG_STATUS[bug.status].tone}>{tr(BUG_STATUS[bug.status].ar, BUG_STATUS[bug.status].en)}</Pill>
          <Pill tone={SEVERITY[bug.severity].tone}>{tr(`الخطورة: ${SEVERITY[bug.severity].ar}`, `Severity: ${SEVERITY[bug.severity].en}`)}</Pill>
          <PriorityPill priority={bug.priority} />
          {lateBy > 0 && <span className="text-[13px] font-medium text-danger">{due(-lateBy)}</span>}
        </div>
      </div>

      {moves.length > 0 && (
        <section aria-label={tr("الخطوة التالية", "Next step")} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3">
          <span className="text-sm text-muted">{tr("الخطوة التالية:", "Next step:")}</span>
          {moves.map((to) =>
            to === "reopened" ? (
              <Button key={to} variant="secondary" onClick={() => setSendingBack(true)}>
                {tr(MOVE_LABEL[to].ar, MOVE_LABEL[to].en)}
              </Button>
            ) : (
              <Button key={to} onClick={() => move(to)} disabled={to === "assigned" && !bug.assignee_id} title={to === "assigned" && !bug.assignee_id ? tr("اختر المطور من «تعديل» أولاً", "Choose the developer in Edit first") : undefined}>
                {tr(MOVE_LABEL[to].ar, MOVE_LABEL[to].en)}
              </Button>
            ),
          )}
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="bug-desc" className="rounded-xl border border-line bg-card p-4">
            <h2 id="bug-desc" className="mb-2 text-sm font-semibold text-muted">
              {tr("ماذا حدث", "What happened")}
            </h2>
            {bug.description ? (
              <p dir="auto" className="leading-relaxed whitespace-pre-wrap">
                {bug.description}
              </p>
            ) : (
              <p className="text-sm text-faint">{tr("لا يوجد وصف.", "No description.")}</p>
            )}
          </section>
          <section aria-labelledby="bug-files" className="rounded-xl border border-line bg-card p-4">
            <h2 id="bug-files" className="mb-3 text-sm font-semibold text-muted">
              {tr("الصور والملفات", "Screenshots and files")}
            </h2>
            <AttachmentsPanel owner={{ type: "bug", id: bug.id }} canAdd={canReportBug(user, project)} canManage={canManageBugs(user, project)} />
          </section>
          <section aria-labelledby="bug-history" className="rounded-xl border border-line bg-card p-4">
            <h2 id="bug-history" className="mb-2 text-sm font-semibold text-muted">
              {tr("السجل", "History")}
            </h2>
            <ol className="flex flex-col">
              {[...history].reverse().map((e) => {
                const actor = peopleById.get(e.actor_id);
                return (
                  <li key={e.id} className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
                    {actor && <Avatar user={actor} size="sm" />}
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm">
                        <b className="font-semibold">{nameOf(e.actor_id)}</b> {eventText(e, fmt, peopleById)}
                      </p>
                      {e.note && (
                        <p className="text-[13px] text-muted">
                          {tr("السبب: ", "Reason: ")}
                          <bdi>{e.note}</bdi>
                        </p>
                      )}
                      <time dateTime={e.at} className="text-xs text-faint">
                        {dateTime(e.at)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="order-first rounded-xl border border-line bg-card p-4 lg:order-none">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted">{tr("المشروع", "Project")}</dt>
            <dd>
              <Link to={`/projects/${project.id}`} className="text-accent hover:underline">
                {projectName}
              </Link>
            </dd>
            {phase && (
              <>
                <dt className="text-muted">{tr("المرحلة", "Phase")}</dt>
                <dd>{phase.name}</dd>
              </>
            )}
            {task && (
              <>
                <dt className="text-muted">{tr("المهمة", "Task")}</dt>
                <dd>
                  <Link to={`/tasks/${task.id}`} className="text-accent hover:underline">
                    <span dir="ltr">{task.code}</span> · {task.title}
                  </Link>
                </dd>
              </>
            )}
            <dt className="text-muted">{tr("المطور", "Developer")}</dt>
            <dd>{nameOf(bug.assignee_id)}</dd>
            <dt className="text-muted">{tr("سجّلها", "Reported by")}</dt>
            <dd>{nameOf(bug.reported_by)}</dd>
            <dt className="text-muted">{tr("الإصلاح المتوقع", "Expected fix")}</dt>
            <dd className={lateBy > 0 ? "font-medium text-danger" : undefined}>{day(bug.due)}</dd>
            <dt className="text-muted">{tr("سُجّلت", "Reported")}</dt>
            <dd>{fmt.ago(bug.created_at)}</dd>
          </dl>
        </aside>
      </div>

      {canManageBugs(user, project) && (
        <BugEditDialog key={JSON.stringify(bug)} open={editing} onClose={() => setEditing(false)} bug={bug} project={project} people={people} />
      )}

      <Dialog
        open={sendingBack}
        onClose={() => setSendingBack(false)}
        title={tr(`إعادة ${bug.code} للمطور`, `Send ${bug.code} back`)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendingBack(false)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!note.trim()) return setNoteError(tr("اكتب لماذا لم تُحل المشكلة.", "Write why it isn't fixed."));
                if (await move("reopened", note)) {
                  setSendingBack(false);
                  setNote("");
                }
              }}
            >
              {tr("أعدها للمطور", "Send back")}
            </Button>
          </>
        }
      >
        <Field label={tr("ما الذي لم يُحل؟", "What isn't fixed?")} htmlFor="reopen-note" error={noteError} hint={tr("يصل إلى المطور ويُحفظ في السجل.", "The developer gets it; it stays in the history.")}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern) */}
          <Textarea id="reopen-note" autoFocus maxLength={L.note} value={note} invalid={!!noteError} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
