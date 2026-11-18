import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { authApi } from "@/features/auth";
import { projectsApi, type ProjectSummary } from "@/features/projects";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today as todayIso } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, Pill, PriorityPill, Select, Skeleton, Stat } from "@/shared/ui";
import { bugsApi } from "../api";
import { ReportBugDialog } from "../components/report-bug-dialog";
import { BUG_STATUS, SEVERITY } from "../labels";
import { bugLateDays, canReportBug, isOpen, SEVERITY_ORDER } from "../rules";
import type { Bug, Severity } from "../types";

type Show = "open" | "late" | "closed" | "all";

/** The bug tracker: the brief's reports (open, late, closed; by project and by developer), filters, and the list. */
export function BugsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الأخطاء البرمجية", "Bugs"));
  const load = useLoad(() => Promise.all([bugsApi.bugs(), projectsApi.projects(), authApi.users()]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-3">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && <Bugs bugs={load.data[0]} projects={load.data[1]} people={load.data[2]} />}
    </div>
  );
}

function Bugs({ bugs, projects, people }: { bugs: Bug[]; projects: ProjectSummary[]; people: User[] }) {
  const { tr, lang, num, due } = useFmt();
  const user = useUser();
  const day = todayIso();
  const [show, setShow] = useState<Show>("open");
  const [projectId, setProjectId] = useState("");
  const [severity, setSeverity] = useState("");
  const [reporting, setReporting] = useState(false);
  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const personOf = new Map(people.map((u) => [u.id, u]));
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("غير مُسندة", "Unassigned"));
  const projectName = (id: number) => {
    const p = projectOf.get(id);
    return p ? (lang === "en" && p.name_en ? p.name_en : p.name) : "";
  };
  const reportable = projects.filter((p) => canReportBug(user, p));

  const late = (b: Bug) => bugLateDays(b, day) > 0;
  const counts = { open: bugs.filter(isOpen).length, late: bugs.filter(late).length, closed: bugs.filter((b) => !isOpen(b)).length };

  const shown = bugs
    .filter((b) => (show === "open" ? isOpen(b) : show === "late" ? late(b) : show === "closed" ? !isOpen(b) : true))
    .filter((b) => !projectId || b.project_id === Number(projectId))
    .filter((b) => !severity || b.severity === severity)
    // The most severe first, then the nearest fix day.
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));

  // The reports by project and by developer (the brief: "حسب المشروع والفريق"; teams wait for the client's answer).
  const byProject = projects
    .map((p) => {
      const mine = bugs.filter((b) => b.project_id === p.id);
      return { id: p.id, name: projectName(p.id), open: mine.filter(isOpen).length, late: mine.filter(late).length, closed: mine.filter((b) => !isOpen(b)).length };
    })
    .filter((r) => r.open + r.closed > 0);
  const byDeveloper = [...new Set(bugs.filter(isOpen).map((b) => b.assignee_id ?? 0))].map((id) => {
    const mine = bugs.filter((b) => isOpen(b) && (b.assignee_id ?? 0) === id);
    return { id, name: nameOf(personOf.get(id)), open: mine.length, late: mine.filter(late).length };
  });

  const SHOWS: { key: Show; ar: string; en: string; n: number }[] = [
    { key: "open", ar: "المفتوحة", en: "Open", n: counts.open },
    { key: "late", ar: "المتأخرة", en: "Late", n: counts.late },
    { key: "closed", ar: "المغلقة", en: "Closed", n: counts.closed },
    { key: "all", ar: "الكل", en: "All", n: bugs.length },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{tr("الأخطاء البرمجية", "Bugs")}</h1>
        {reportable.length > 0 && (
          <Button pill onClick={() => setReporting(true)}>
            <Plus size={16} aria-hidden="true" />
            {tr("سجّل مشكلة", "Report a bug")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={tr("مفتوحة", "Open")} value={num(counts.open)} note={tr("لم تُغلق بعد", "Not closed yet")} />
        <Stat label={tr("متأخرة", "Late")} value={num(counts.late)} danger={counts.late > 0} note={tr("تجاوزت الموعد المتوقع", "Past the expected day")} />
        <Stat label={tr("مغلقة", "Closed")} value={num(counts.closed)} note={tr("أُصلحت وتأكدنا منها", "Fixed and checked")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="by-project" className="rounded-xl border border-line bg-card p-4">
          <h2 id="by-project" className="mb-2 font-semibold">
            {tr("حسب المشروع", "By project")}
          </h2>
          <table className="w-full text-sm">
            <thead className="text-start text-xs text-muted">
              <tr>
                <th className="py-1.5 text-start font-medium">{tr("المشروع", "Project")}</th>
                <th className="py-1.5 font-medium">{tr("مفتوحة", "Open")}</th>
                <th className="py-1.5 font-medium">{tr("متأخرة", "Late")}</th>
                <th className="py-1.5 font-medium">{tr("مغلقة", "Closed")}</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2">{r.name}</td>
                  <td className="num py-2 text-center">{num(r.open)}</td>
                  <td className={cn("num py-2 text-center", r.late > 0 && "font-semibold text-danger")}>{num(r.late)}</td>
                  <td className="num py-2 text-center">{num(r.closed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section aria-labelledby="by-developer" className="rounded-xl border border-line bg-card p-4">
          <h2 id="by-developer" className="mb-2 font-semibold">
            {tr("المفتوحة حسب المطور", "Open, by developer")}
          </h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 text-start font-medium">{tr("المطور", "Developer")}</th>
                <th className="py-1.5 font-medium">{tr("مفتوحة", "Open")}</th>
                <th className="py-1.5 font-medium">{tr("متأخرة", "Late")}</th>
              </tr>
            </thead>
            <tbody>
              {byDeveloper.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2">{r.name}</td>
                  <td className="num py-2 text-center">{num(r.open)}</td>
                  <td className={cn("num py-2 text-center", r.late > 0 && "font-semibold text-danger")}>{num(r.late)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-labelledby="bug-list" className="flex flex-col gap-3">
        <h2 id="bug-list" className="sr-only">
          {tr("القائمة", "The list")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={tr("عرض", "Show")} className="flex flex-wrap gap-1 rounded-full bg-chip p-1">
            {SHOWS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={show === s.key}
                onClick={() => setShow(s.key)}
                className={cn("rounded-full px-3 py-1.5 text-sm", show === s.key ? "bg-card font-semibold shadow-card" : "text-muted hover:text-text")}
              >
                {tr(s.ar, s.en)} <span className="num text-muted">({num(s.n)})</span>
              </button>
            ))}
          </div>
          <Select aria-label={tr("المشروع", "Project")} value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-auto">
            <option value="">{tr("كل المشاريع", "All projects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {projectName(p.id)}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("درجة الخطورة", "Severity")} value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 w-auto">
            <option value="">{tr("كل الدرجات", "Any severity")}</option>
            {SEVERITY_ORDER.map((s: Severity) => (
              <option key={s} value={s}>
                {tr(SEVERITY[s].ar, SEVERITY[s].en)}
              </option>
            ))}
          </Select>
        </div>

        {shown.length === 0 ? (
          <Empty title={tr("لا توجد مشكلات هنا", "No bugs here")} body={tr("جرّب عرضاً آخر أو مشروعاً آخر.", "Try another view or project.")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((b) => {
              const lateBy = bugLateDays(b, day);
              return (
                <li key={b.id}>
                  {/* The whole row opens the bug (click anywhere). */}
                  <Link to={`/bugs/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-accent">
                    <span className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                      <span className="text-xs text-muted">
                        <span dir="ltr">{b.code}</span> · {projectName(b.project_id)} · {nameOf(b.assignee_id ? personOf.get(b.assignee_id) : undefined)}
                      </span>
                      <span dir="auto" className="font-medium">
                        {b.title}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Pill tone={SEVERITY[b.severity].tone}>{tr(SEVERITY[b.severity].ar, SEVERITY[b.severity].en)}</Pill>
                      <PriorityPill priority={b.priority} />
                      <Pill tone={BUG_STATUS[b.status].tone}>{tr(BUG_STATUS[b.status].ar, BUG_STATUS[b.status].en)}</Pill>
                      {lateBy > 0 && <span className="text-[13px] font-medium text-danger">{due(-lateBy)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reportable.length > 0 && <ReportBugDialog open={reporting} onClose={() => setReporting(false)} projects={reportable} user={user} people={people} />}
    </>
  );
}
