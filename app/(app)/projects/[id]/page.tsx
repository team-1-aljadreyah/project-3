"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Kanban } from "@/components/board/kanban";
import { PROJECT_STATE } from "@/components/projects/project-card";
import { AvatarStack, ErrorBox, LoadingBlock, Pill, ProgressBar, Skeleton, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { useFmt } from "@/lib/i18n";
import { countTasks } from "@/lib/tasks";
import { today as todayIso } from "@/lib/utils";
import { useLoad } from "@/lib/use-load";

/** One project: its header, the sprint against the plan, what needs attention, the numbers, and the board. */
export default function ProjectBoardPage() {
  const { tr, lang, pct, num, day } = useFmt();
  const id = Number(useParams<{ id: string }>().id);
  const load = useLoad(() => Promise.all([api.project(id), api.tasks(id), api.users(), api.sprints(id)]), [id]);
  const today = todayIso();

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="flex flex-col gap-4">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-24" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-[260px] shrink-0 rounded-xl" />
          ))}
        </div>
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;

  const [project, tasks, users, sprints] = load.state.data;
  const counts = countTasks(project, tasks, today);
  // The sprint running today, if the project works in sprints.
  const sprint = project.uses_sprints ? sprints.find((s) => s.start <= today && today <= s.end) : undefined;
  const sprintTasks = sprint ? tasks.filter((t) => t.sprint_id === sprint.id) : [];
  const sprintCounts = countTasks(project, sprintTasks, today);
  const members = users.filter((u) => project.member_ids.includes(u.id));
  const name = lang === "en" && project.name_en ? project.name_en : project.name;
  const state = PROJECT_STATE[project.state];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
            <Link href="/" className="hover:text-text hover:underline">
              {tr("المشاريع", "Projects")}
            </Link>
            <span aria-hidden="true"> / </span>
            <span dir="ltr">{project.code}</span>
          </nav>
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold">
            {name}
            <Pill tone={state.tone}>{tr(state.ar, state.en)}</Pill>
          </h1>
        </div>

        {sprint ? (
          <div className="flex w-full flex-col gap-2 sm:w-[320px]">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-muted">
                {sprint.name} · {tr(`ينتهي ${day(sprint.end)}`, `ends ${day(sprint.end)}`)}
              </span>
              <span>
                <b className="num">{pct(sprintCounts.ratio)}</b>{" "}
                <span className="text-muted">{tr(`من ${pct(sprint.planned_ratio)} المخطط`, `of ${pct(sprint.planned_ratio)} planned`)}</span>
              </span>
            </div>
            <ProgressBar value={sprintCounts.ratio} planned={sprint.planned_ratio} label={tr(`إنجاز ${sprint.name}`, `${sprint.name} progress`)} />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:w-[320px]">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-muted">{tr(`ينتهي المشروع ${day(project.end)}`, `Project ends ${day(project.end)}`)}</span>
              <b className="num">{pct(counts.ratio)}</b>
            </div>
            <ProgressBar value={counts.ratio} label={tr(`إنجاز ${name}`, `${name} progress`)} />
          </div>
        )}
      </div>

      {(counts.late > 0 || counts.blocked > 0) && (
        <p role="status" className="rounded-lg bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
          <b>{tr("تحتاج إلى قرار:", "Needs a decision:")}</b>{" "}
          {tr(
            `مهام متأخرة: ${num(counts.late)}، ومهام متوقفة: ${num(counts.blocked)}.`,
            `${counts.late} late and ${counts.blocked} blocked in this project.`,
          )}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("مهام مفتوحة", "Open tasks")} value={num(counts.total - counts.done)} note={tr(`من أصل ${num(counts.total)}`, `of ${counts.total} tasks`)} />
        <Stat label={tr("متأخرة", "Late")} value={num(counts.late)} danger={counts.late > 0} note={counts.late > 0 ? tr("تحتاج متابعة", "Need follow-up") : tr("لا شيء متأخر", "Nothing late")} />
        <Stat label={tr("متوقفة", "Blocked")} value={num(counts.blocked)} danger={counts.blocked > 0} note={tr("لكل منها سبب مسجّل", "Each has a reason")} />
        <Stat label={tr("بانتظار المراجعة", "In review")} value={num(counts.inReview)} note={tr(`المنجز ${pct(counts.ratio)}`, `${pct(counts.ratio)} done`)} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{tr("لوحة المهام", "Task board")}</h2>
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="hidden sm:inline">{tr("الفريق", "Team")}</span>
          <AvatarStack users={members} />
        </div>
      </div>

      <Kanban project={project} tasks={tasks} users={users} today={today} />
    </div>
  );
}
