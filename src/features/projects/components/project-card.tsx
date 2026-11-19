import Link from "next/link";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { daysBetween, today } from "@/shared/lib/utils";
import { Avatar, Pill, PriorityPill, ProgressBar } from "@/shared/ui";
import { PROJECT_STATE } from "../project-state";
import type { ProjectSummary } from "../types";

/** One project in the list. The whole card is one link to the project (click anywhere). */
export function ProjectCard({ project, pm }: { project: ProjectSummary; pm?: User }) {
  const { tr, lang, pct, day, num } = useFmt();
  const ratio = project.tasks_total ? project.tasks_done / project.tasks_total : 0;
  const state = PROJECT_STATE[project.state];
  const daysLeft = daysBetween(today(), project.end);
  const name = lang === "en" && project.name_en ? project.name_en : project.name;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex w-full flex-col gap-4 rounded-xl border border-line bg-card p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted" dir="ltr">
            {project.code}
          </span>
          <h2 className="text-base leading-snug font-semibold group-hover:text-accent-ink">{name}</h2>
        </div>
        <Pill tone={state.tone}>{tr(state.ar, state.en)}</Pill>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{tr("الإنجاز", "Progress")}</span>
          <span className="num font-semibold">{pct(ratio)}</span>
        </div>
        <ProgressBar value={ratio} label={tr(`إنجاز ${name}`, `${name} progress`)} />
        <span className="text-xs text-muted">
          {tr(`المهام المكتملة: ${num(project.tasks_done)} من أصل ${num(project.tasks_total)}`, `${project.tasks_done} of ${project.tasks_total} tasks done`)}
        </span>
      </div>

      {(project.tasks_late > 0 || project.tasks_blocked > 0) && (
        <div className="flex flex-wrap gap-2">
          {project.tasks_late > 0 && <Pill tone="blocked">{tr(`${project.tasks_late} متأخرة`, `${project.tasks_late} late`)}</Pill>}
          {project.tasks_blocked > 0 && <Pill tone="blocked">{tr(`${project.tasks_blocked} متوقفة`, `${project.tasks_blocked} blocked`)}</Pill>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-muted">
          {pm && <Avatar user={pm} size="sm" />}
          <span className="truncate">{pm ? (lang === "en" && pm.name_en ? pm.name_en : pm.name) : "-"}</span>
        </span>
        <span className="flex items-center gap-2">
          <PriorityPill priority={project.priority} />
          <span className={daysLeft < 0 && project.state !== "done" ? "text-danger" : "text-muted"} title={tr("التاريخ المتوقع للإنجاز", "Expected end")}>
            {day(project.end)}
          </span>
        </span>
      </div>
    </Link>
  );
}
