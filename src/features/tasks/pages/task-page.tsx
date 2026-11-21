import { Pencil } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { AttachmentsPanel } from "@/features/attachments";
import { authApi } from "@/features/auth";
import { GithubPanel } from "@/features/github";
import { canManageProject, lateDays, projectsApi, type Project, type Sprint } from "@/features/projects";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today as todayIso } from "@/shared/lib/utils";
import { useRouteParam } from "@/shared/lib/route-param";
import { Avatar, Button, ErrorBox, Field, LoadingBlock, PriorityPill, Select, Skeleton, StatusPill } from "@/shared/ui";
import { tasksApi } from "../api";
import { ApprovalBanner } from "../components/approval-banner";
import { Comments } from "../components/comments";
import { Dependencies } from "../components/dependencies";
import { History } from "../components/history";
import { TaskForm } from "../components/task-form";
import { useMoveTask } from "../hooks/use-move-task";
import { canApprove, canComment, canManageTasks, canMoveTask, statusOf } from "../rules";
import type { Task, TaskComment, TaskEvent } from "../types";

interface Loaded {
  task: Task;
  project: Project;
  users: User[];
  sprints: Sprint[];
  comments: TaskComment[];
  history: TaskEvent[];
  /** Every task of the project (for dependencies). */
  projectTasks: Task[];
}

/** One task: what it is, its status (with the brief's rules), the approval, the details, comments and history. */
export function TaskPage() {
  const id = Number(useRouteParam("tasks"));
  const load = useLoad<Loaded>(async () => {
    // The task first: it says which project to load.
    const task = await tasksApi.task(id);
    const [project, users, sprints, comments, history, projectTasks] = await Promise.all([
      projectsApi.project(task.project_id),
      authApi.users(),
      projectsApi.sprints(task.project_id),
      tasksApi.comments(id),
      tasksApi.history(id),
      tasksApi.tasks(task.project_id),
    ]);
    return { task, project, users, sprints, comments, history, projectTasks };
  }, [id]);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  return <TaskView {...load.state.data} reload={load.reload} />;
}

function TaskView({ task, project, users, sprints, comments, history, projectTasks, reload }: Loaded & { reload: () => void }) {
  const fmt = useFmt();
  const { tr, lang, day, due } = fmt;
  const user = useUser();
  const { move, dialog } = useMoveTask(user, project, reload);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"comments" | "history">("comments");

  const people = new Map(users.map((u) => [u.id, u]));
  const members = users.filter((u) => project.member_ids.includes(u.id));
  const status = statusOf(project, task.status);
  const assignee = task.assignee_id ? people.get(task.assignee_id) : undefined;
  const creator = task.created_by ? people.get(task.created_by) : undefined;
  const sprint = sprints.find((s) => s.id === task.sprint_id);
  const phase = project.phases.find((ph) => ph.id === task.phase_id);
  const today = todayIso();
  const late = lateDays(project, task, today);
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");
  const projectName = lang === "en" && project.name_en ? project.name_en : project.name;
  usePageTitle(task.title);
  const mayMove = canMoveTask(user, project, task);
  const mayApprove = canApprove(user, project);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
          <Link href="/" className="hover:text-text hover:underline">
            {tr("المشاريع", "Projects")}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/projects/${project.id}`} className="hover:text-text hover:underline">
            {projectName}
          </Link>
          <span aria-hidden="true"> / </span>
          <span dir="ltr">{task.code}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-3xl text-2xl leading-snug font-semibold">{task.title}</h1>
          {canManageTasks(user, project) && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" />
              {tr("تعديل", "Edit")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status && <StatusPill status={status} />}
          <PriorityPill priority={task.priority} />
          {late > 0 && <span className="text-[13px] font-medium text-danger">{due(-late)}</span>}
        </div>
      </div>

      <ApprovalBanner task={task} people={people} canDecide={mayApprove} onDone={reload} />

      {task.blocked_reason && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <b>{tr("سبب التوقف:", "Blocked:")}</b> {task.blocked_reason}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="desc-title" className="rounded-xl border border-line bg-card p-4">
            <h2 id="desc-title" className="mb-2 text-sm font-semibold text-muted">
              {tr("الوصف والمطلوب", "Description")}
            </h2>
            {task.description ? (
              <p className="leading-relaxed whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-sm text-faint">{tr("لا يوجد وصف.", "No description.")}</p>
            )}
          </section>

          <Dependencies task={task} project={project} tasks={projectTasks} canEdit={canManageTasks(user, project)} onSaved={reload} />

          <GithubPanel owner={{ type: "task", id: task.id }} />

          <section aria-labelledby="files-title" className="rounded-xl border border-line bg-card p-4">
            <h2 id="files-title" className="mb-3 text-sm font-semibold text-muted">
              {tr("المرفقات", "Attachments")}
            </h2>
            <AttachmentsPanel owner={{ type: "task", id: task.id }} canAdd={canComment(user, project)} canManage={canManageProject(user, project)} />
          </section>

          <section className="rounded-xl border border-line bg-card">
            <div role="tablist" aria-label={tr("التعليقات والسجل", "Comments and history")} className="flex gap-6 border-b border-line px-4">
              {(["comments", "history"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-controls={`panel-${key}`}
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn("-mb-px border-b-2 py-3 text-sm", tab === key ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text")}
                >
                  {key === "comments" ? tr(`التعليقات (${comments.length})`, `Comments (${comments.length})`) : tr("سجل التحديثات", "History")}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-4">
              {tab === "comments" ? (
                <Comments taskId={task.id} comments={comments} people={people} canWrite={canComment(user, project)} onAdded={reload} />
              ) : (
                <History events={history} project={project} people={people} />
              )}
            </div>
          </section>
        </div>

        {/* On a phone the status and details come first (above the comments); on a computer they sit on the side. */}
        <aside className="order-first flex flex-col gap-4 rounded-xl border border-line bg-card p-4 lg:order-none">
          {mayMove ? (
            <Field
              label={tr("الحالة", "Status")}
              htmlFor="task-status"
              hint={
                !mayApprove && project.statuses.some((s) => s.tone === "done")
                  ? tr("اختيار حالة الإكمال يرسل طلب اعتماد إلى مدير المشروع.", "Choosing a done status sends it for approval.")
                  : undefined
              }
            >
              <Select id="task-status" value={task.status} onChange={(e) => move(task, e.target.value)}>
                {project.statuses.map((s) => (
                  <option key={s.key} value={s.key}>
                    {lang === "en" ? s.name_en : s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted">{tr("المسؤول", "Assignee")}</dt>
            <dd className="flex items-center gap-2">
              {assignee ? (
                <>
                  <Avatar user={assignee} size="sm" /> {nameOf(assignee)}
                </>
              ) : (
                <span className="text-faint">{tr("غير مُسندة", "Unassigned")}</span>
              )}
            </dd>
            <dt className="text-muted">{tr("المشروع", "Project")}</dt>
            <dd>
              <Link href={`/projects/${project.id}`} className="text-accent hover:underline">
                {projectName}
              </Link>
            </dd>
            {phase && (
              <>
                <dt className="text-muted">{tr("المرحلة", "Phase")}</dt>
                <dd>{phase.name}</dd>
              </>
            )}
            {sprint && (
              <>
                <dt className="text-muted">{tr("الدورة", "Sprint")}</dt>
                <dd>{sprint.name}</dd>
              </>
            )}
            <dt className="text-muted">{tr("البدء", "Start")}</dt>
            <dd>{day(task.start)}</dd>
            <dt className="text-muted">{tr("التسليم", "Due")}</dt>
            <dd className={late > 0 ? "font-medium text-danger" : undefined}>{day(task.due)}</dd>
            <dt className="text-muted">{tr("أنشأها", "Created by")}</dt>
            <dd>{nameOf(creator)}</dd>
            <dt className="text-muted">{tr("آخر تحديث", "Updated")}</dt>
            <dd>{fmt.ago(task.updated_at)}</dd>
          </dl>
        </aside>
      </div>

      {dialog}
      <TaskForm
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
        project={project}
        members={members}
        sprints={sprints}
        task={task}
      />
    </div>
  );
}
