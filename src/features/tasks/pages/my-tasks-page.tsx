import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isDone, lateDays, projectsApi, type ProjectSummary } from "@/features/projects";
import { useFmt } from "@/shared/lib/i18n";
import { isCeo } from "@/shared/lib/access";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { daysBetween, today as todayIso } from "@/shared/lib/utils";
import { Empty, ErrorBox, LoadingBlock, PriorityPill, Skeleton, StatusPill } from "@/shared/ui";
import { tasksApi } from "../api";
import { MySummary, MySummarySkeleton, type ListPlace } from "../components/my-summary";
import { statusOf } from "../rules";
import type { Task } from "../types";

/** The groups, most urgent first. A task is in the first group it fits. */
const GROUPS = [
  { key: "late", ar: "متأخرة", en: "Late" },
  { key: "soon", ar: "خلال 3 أيام", en: "In the next 3 days" },
  { key: "later", ar: "لاحقاً", en: "Later" },
  { key: "none", ar: "بلا موعد تسليم", en: "No due date" },
  { key: "done", ar: "مكتملة", en: "Done" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

/** Everything assigned to me, in every project, grouped by how urgent it is (the brief: "see the tasks assigned to me"). */
export function MyTasksPage() {
  const { tr } = useFmt();
  usePageTitle(tr("مهامي", "My tasks"));
  const user = useUser();
  const router = useRouter();
  // Nobody gives the CEO tasks (the page is not in their menu): an old link takes them to their dashboard.
  const ceo = isCeo(user);
  useEffect(() => {
    if (ceo) router.replace("/dashboard");
  }, [ceo, router]);
  const load = useLoad(() => (ceo ? new Promise<never>(() => {}) : Promise.all([tasksApi.myTasks(), projectsApi.projects()])), [ceo]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{tr("مهامي", "My tasks")}</h1>
      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-6">
          {/* The summary's place first, then the rows of the list. */}
          <MySummarySkeleton />
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && <MyTasks tasks={load.data[0]} projects={load.data[1]} />}
    </div>
  );
}

function MyTasks({ tasks, projects }: { tasks: Task[]; projects: ProjectSummary[] }) {
  const { tr, lang, due } = useFmt();
  const [showDone, setShowDone] = useState(false);
  const day = todayIso();
  const projectOf = new Map(projects.map((p) => [p.id, p]));

  const groupOf = (t: Task): GroupKey => {
    const p = projectOf.get(t.project_id);
    if (p && isDone(p, t)) return "done";
    if (!t.due) return "none";
    if (p && lateDays(p, t, day) > 0) return "late";
    return daysBetween(day, t.due) <= 3 ? "soon" : "later";
  };
  // Inside a group: the nearest due date first, then by code.
  const sorted = [...tasks].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.code.localeCompare(b.code));
  const open = tasks.filter((t) => groupOf(t) !== "done").length;

  /** A summary tile was pressed: bring that group into view (showing the done ones first if needed). */
  const show = (place: ListPlace) => {
    if (place === "done") setShowDone(true);
    // After the done group is drawn; a group with no tasks falls back to the top of the list.
    requestAnimationFrame(() => {
      const target = (place !== "top" && document.getElementById(`group-${place}`)) || document.getElementById("my-list-top");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (tasks.length === 0) {
    return <Empty title={tr("لا توجد مهام مسندة إليك", "No tasks assigned to you")} body={tr("حين يسند إليك مدير القسم مهمة، تظهر هنا.", "When a department manager gives you a task, it shows here.")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The summary first: my numbers, my projects, my statuses and how much is done. The list under it is unchanged. */}
      <MySummary tasks={tasks} projects={projects} today={day} onShow={show} />

      <div id="my-list-top" className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{tr(`مهام مفتوحة: ${open}`, `Open tasks: ${open}`)}</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          {tr("اعرض المكتملة", "Show done tasks")}
        </label>
      </div>

      {GROUPS.filter((g) => g.key !== "done" || showDone).map((g) => {
        const list = sorted.filter((t) => groupOf(t) === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} aria-labelledby={`group-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`group-${g.key}`} className={g.key === "late" ? "scroll-mt-24 font-semibold text-danger" : "scroll-mt-24 font-semibold"}>
              {tr(g.ar, g.en)} <span className="num text-sm font-normal text-muted">({list.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((t) => {
                const p = projectOf.get(t.project_id);
                const status = p ? statusOf(p, t.status) : undefined;
                const left = t.due ? daysBetween(day, t.due) : undefined;
                return (
                  <li key={t.id}>
                    {/* The whole row is one link to the task (click anywhere). */}
                    <Link
                      href={`/tasks/${t.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-accent"
                    >
                      <span className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                        <span className="text-xs text-muted">
                          <span dir="ltr">{t.code}</span> · {p ? (lang === "en" && p.name_en ? p.name_en : p.name) : ""}
                        </span>
                        <span className="font-medium">{t.title}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {status && <StatusPill status={status} />}
                        <PriorityPill priority={t.priority} />
                        {left !== undefined && g.key !== "done" && (
                          <span className={g.key === "late" ? "text-[13px] font-medium text-danger" : "text-[13px] text-muted"}>{due(left)}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
