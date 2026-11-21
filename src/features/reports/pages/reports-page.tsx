import { Download } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/features/auth";
import { PROJECT_STATE, projectsApi } from "@/features/projects";
import { personHref } from "@/shared/lib/access";
import { downloadCsv } from "@/shared/lib/csv";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, MaybeLink, Pill, ProgressBar, Select, Skeleton, Stat } from "@/shared/ui";
import { reportsApi } from "../api";
import { velocity } from "../compute";
import { canSeeReports } from "../rules";

type Tab = "projects" | "people" | "sprints";
const TAB_KEYS = ["projects", "people", "sprints"] as const;
const TABS: { key: Tab; ar: string; en: string }[] = [
  { key: "projects", ar: "حسب المشروع", en: "By project" },
  { key: "people", ar: "حسب الفريق والموظف", en: "By team and person" },
  { key: "sprints", ar: "حسب الدورة", en: "By sprint" },
];

const th = "px-3 py-2 text-start text-xs font-medium whitespace-nowrap text-muted";
const td = "px-3 py-2 whitespace-nowrap";

/**
 * The reports (the brief: per project, per team or employee, per sprint with planned, done, left and velocity). Each
 * table downloads as a CSV file for Excel. Every number is over the projects this person may see.
 */
export function ReportsPage() {
  const { tr, lang, num, pct, day } = useFmt();
  usePageTitle(tr("التقارير", "Reports"));
  const user = useUser();
  const allowed = canSeeReports(user);
  const load = useLoad(() => (allowed ? Promise.all([reportsApi.overview(), authApi.users(), user.role === "pm" ? projectsApi.projects() : Promise.resolve([])]) : Promise.resolve(null)), [allowed]);
  // In the address, so a link can open a tab already set: /reports?tab=people&team=1, ?tab=sprints&project=2.
  const [tab, setTab] = useQueryParam<Tab>("tab", "projects", TAB_KEYS);
  const [team, setTeam] = useQueryParam<string>("team", "");
  const [project, setProject] = useQueryParam<string>("project", "");
  const projectId = Number(project) || undefined;

  if (!allowed) return <Empty title={tr("التقارير للإدارة", "Reports are for management")} body={tr("افتح «مهامي» لترى مهامك.", 'Open "My tasks" to see your tasks.')} />;

  const o = load.data?.[0];
  const people = new Map((load.data?.[1] ?? []).map((u) => [u.id, u]));
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const projectName = (p: { name: string; name_en?: string }) => (lang === "en" && p.name_en ? p.name_en : p.name);
  const teamName = (id?: number) => {
    const t = o?.teams.find((x) => x.team_id === id);
    return t ? (lang === "en" && t.name_en ? t.name_en : t.name) : tr("بلا فريق", "No team");
  };

  // Sprints: the projects that have any, and the chosen one (the first by default).
  const sprintProjects = o ? o.projects.filter((p) => o.sprints.some((s) => s.project_id === p.id)) : [];
  const chosen = sprintProjects.find((p) => p.id === projectId) ?? sprintProjects[0];
  const sprintRows = o && chosen ? o.sprints.filter((s) => s.project_id === chosen.id) : [];
  const peopleRows = o ? o.people.filter((r) => !team || String(r.team_id ?? "none") === team) : [];
  const maxSprint = Math.max(1, ...sprintRows.map((s) => s.planned));

  const csv = () => {
    if (!o) return;
    if (tab === "projects") {
      downloadCsv("projects-report.csv", [
        [tr("الرمز", "Code"), tr("المشروع", "Project"), tr("الحالة", "State"), tr("المهام", "Tasks"), tr("المنجز", "Done"), tr("متأخرة", "Late"), tr("متوقفة", "Blocked"), tr("الإنجاز %", "Done %"), tr("المخطط %", "Planned %"), tr("الموعد", "End")],
        ...o.projects.map((p) => [p.code, projectName(p), tr(PROJECT_STATE[p.state].ar, PROJECT_STATE[p.state].en), p.total, p.done, p.late, p.blocked, Math.round(p.ratio * 100), Math.round(p.planned_ratio * 100), p.end]),
      ]);
    } else if (tab === "people") {
      downloadCsv("people-report.csv", [
        [tr("الموظف", "Person"), tr("الفريق", "Team"), tr("مفتوحة", "Open"), tr("منجزة", "Done"), tr("متأخرة", "Late"), tr("متوقفة", "Blocked"), tr("بانتظار المراجعة", "In review")],
        ...peopleRows.map((r) => [nameOf(r.user_id), teamName(r.team_id), r.open, r.done, r.late, r.blocked, r.in_review]),
      ]);
    } else if (chosen) {
      downloadCsv(`sprints-${chosen.code}.csv`, [
        [tr("الدورة", "Sprint"), tr("من", "From"), tr("إلى", "To"), tr("منتهية", "Ended"), tr("المخطط", "Planned"), tr("المنجز", "Done"), tr("المتبقي", "Left")],
        ...sprintRows.map((s) => [s.name, s.start, s.end, s.closed ? tr("نعم", "yes") : tr("لا", "no"), s.planned, s.done, s.left]),
      ]);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("التقارير", "Reports")}</h1>
          {/* The line is there from the start (empty while loading), so nothing under it moves when the numbers come. */}
          <p className="min-h-5 text-sm text-muted">{o ? tr(`حتى ${day(o.today)}، للمشاريع التي تراها.`, `Up to ${day(o.today)}, for the projects you can see.`) : " "}</p>
        </div>
        <Button variant="secondary" pill onClick={csv} disabled={!o || (tab === "sprints" && !chosen)}>
          <Download size={15} aria-hidden="true" />
          {tr("نزّل الجدول (CSV)", "Download the table (CSV)")}
        </Button>
      </div>

      <div role="tablist" aria-label={tr("نوع التقرير", "Report")} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`report-${t.key}`}
            aria-controls="report-panel"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-3 py-3 text-sm whitespace-nowrap", tab === t.key ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text")}
          >
            {tr(t.ar, t.en)}
          </button>
        ))}
      </div>

      <div id="report-panel" role="tabpanel" aria-labelledby={`report-${tab}`}>
        {load.state.status === "loading" && (
          <LoadingBlock>
            <Skeleton className="h-72" />
          </LoadingBlock>
        )}
        {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

        {o && tab === "projects" && (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">{tr("تقرير المشاريع", "Projects report")}</caption>
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>{tr("المشروع", "Project")}</th>
                  <th className={th}>{tr("الحالة", "State")}</th>
                  <th className={th}>{tr("المنجز", "Done")}</th>
                  <th className={th}>{tr("متأخرة", "Late")}</th>
                  <th className={th}>{tr("متوقفة", "Blocked")}</th>
                  <th className={th}>{tr("الإنجاز مقابل الخطة", "Done vs plan")}</th>
                  <th className={th}>{tr("الموعد", "End")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.projects.map((p) => (
                  // The whole row opens the project (its name is the link, stretched over the row).
                  <tr key={p.id} className="relative hover:bg-card-2">
                    <td className={td}>
                      <Link href={`/projects/${p.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        <span dir="auto">{projectName(p)}</span>
                      </Link>
                      <span dir="ltr" className="ms-2 text-xs text-faint">
                        {p.code}
                      </span>
                    </td>
                    <td className={td}>
                      <Pill tone={PROJECT_STATE[p.state].tone}>{tr(PROJECT_STATE[p.state].ar, PROJECT_STATE[p.state].en)}</Pill>
                    </td>
                    <td className={cn(td, "num")}>
                      {num(p.done)}/{num(p.total)}
                    </td>
                    <td className={cn(td, "num", p.late > 0 && "font-semibold text-danger")}>{num(p.late)}</td>
                    <td className={cn(td, "num")}>{num(p.blocked)}</td>
                    <td className={td}>
                      <span className="flex min-w-48 items-center gap-2">
                        <ProgressBar value={p.ratio} planned={p.planned_ratio} label={tr(`إنجاز ${projectName(p)}`, `${projectName(p)} progress`)} className="flex-1" />
                        <span className="num text-xs text-muted">
                          {pct(p.ratio)} / {pct(p.planned_ratio)}
                        </span>
                      </span>
                    </td>
                    <td className={cn(td, p.overdue && "text-danger")}>{day(p.end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {o && tab === "people" && (
          <div className="flex flex-col gap-3">
            <Select aria-label={tr("اختر الفريق", "Choose the team")} value={team} onChange={(e) => setTeam(e.target.value)} className="h-9 w-auto self-start">
              <option value="">{tr("كل الفرق", "All teams")}</option>
              {o.teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {lang === "en" && t.name_en ? t.name_en : t.name}
                </option>
              ))}
              <option value="none">{tr("بلا فريق", "No team")}</option>
            </Select>
            <div className="overflow-x-auto rounded-xl border border-line bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">{tr("تقرير الموظفين", "People report")}</caption>
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>{tr("الموظف", "Person")}</th>
                    <th className={th}>{tr("الفريق", "Team")}</th>
                    <th className={th}>{tr("مفتوحة", "Open")}</th>
                    <th className={th}>{tr("منجزة", "Done")}</th>
                    <th className={th}>{tr("متأخرة", "Late")}</th>
                    <th className={th}>{tr("متوقفة", "Blocked")}</th>
                    <th className={th}>{tr("بانتظار المراجعة", "In review")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {peopleRows.map((r) => (
                    // The whole row opens the person's performance, when this viewer may open it.
                    <tr key={r.user_id} className="relative hover:bg-card-2">
                      <td className={cn(td, "font-medium")}>
                        <MaybeLink href={people.get(r.user_id) && personHref(user, people.get(r.user_id)!, load.data?.[2])} cover>
                          {nameOf(r.user_id)}
                        </MaybeLink>
                      </td>
                      <td className={td}>{teamName(r.team_id)}</td>
                      <td className={cn(td, "num")}>{num(r.open)}</td>
                      <td className={cn(td, "num")}>{num(r.done)}</td>
                      <td className={cn(td, "num", r.late > 0 && "font-semibold text-danger")}>{num(r.late)}</td>
                      <td className={cn(td, "num")}>{num(r.blocked)}</td>
                      <td className={cn(td, "num")}>{num(r.in_review)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {peopleRows.length === 0 && <p className="p-6 text-center text-sm text-muted">{tr("لا أحد هنا.", "Nobody here.")}</p>}
            </div>
            <p className="text-xs text-faint">{tr("تُحسب مهام كل شخص في المشاريع التي تراها فقط. تقييم الأداء في جزء لاحق، ولا يعتمد على عدد المهام وحده.", "Each person's tasks count only in the projects you can see. Performance reviews come later and don't rest on task counts alone.")}</p>
          </div>
        )}

        {o && tab === "sprints" &&
          (!chosen ? (
            <Empty title={tr("لا توجد دورات", "No sprints")} body={tr("لا يعمل أي من مشاريعك بالدورات بعد.", "None of your projects works in sprints yet.")} />
          ) : (
            <div className="flex flex-col gap-4">
              <Select aria-label={tr("المشروع", "Project")} value={chosen.id} onChange={(e) => setProject(e.target.value)} className="h-9 w-auto self-start">
                {sprintProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {projectName(p)}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={tr("السرعة", "Velocity")} value={num(Math.round(velocity(sprintRows) * 10) / 10)} note={tr("مهام منجزة لكل دورة منتهية (آخر 3)", "tasks done per ended sprint (last 3)")} />
                <Stat label={tr("الدورات", "Sprints")} value={num(sprintRows.length)} note={tr(`منتهية ${num(sprintRows.filter((s) => s.closed).length)}`, `${sprintRows.filter((s) => s.closed).length} ended`)} />
              </div>
              <ul aria-label={tr("الدورات: المخطط والمنجز", "Sprints: planned and done")} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
                {sprintRows.map((s) => (
                  // Each sprint opens its project's board.
                  <li key={s.sprint_id} className="relative flex flex-col gap-1.5 rounded-lg p-1 hover:bg-card-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <Link href={`/projects/${chosen.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {s.name} {s.closed && <span className="text-xs text-faint">{tr("(منتهية)", "(ended)")}</span>}
                      </Link>
                      <span className="text-xs text-muted">
                        {tr(`المخطط ${num(s.planned)} · المنجز ${num(s.done)} · المتبقي ${num(s.left)}`, `${s.planned} planned · ${s.done} done · ${s.left} left`)}
                      </span>
                    </div>
                    {/* Two bars on one scale: planned (light) and done (strong). */}
                    <div aria-hidden="true" className="relative h-3 rounded-full bg-chip">
                      <div className="absolute inset-y-0 start-0 rounded-full bg-accent-soft" style={{ width: `${(s.planned / maxSprint) * 100}%` }} />
                      <div className="absolute inset-y-0 start-0 rounded-full bg-accent" style={{ width: `${(s.done / maxSprint) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
