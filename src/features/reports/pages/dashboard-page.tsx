import { AlertTriangle, ChevronLeft, Inbox, Megaphone } from "lucide-react";
import Link from "next/link";
import { announcementsApi } from "@/features/announcements";
import { authApi } from "@/features/auth";
import { monitoringApi } from "@/features/monitoring";
import { PROJECT_STATE, projectsApi } from "@/features/projects";
import { personHref } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { Avatar, ButtonLink, Empty, ErrorBox, LoadingBlock, MaybeLink, Pill, ProgressBar, Skeleton, Stat } from "@/shared/ui";
import { reportsApi } from "../api";
import { CeoHero } from "../components/ceo-hero";
import { LeadSphere } from "../components/lead-sphere";
import { MonitorSummary } from "../components/monitor-summary";
import { PmPlan } from "../components/pm-plan";
import { teamShares, totals } from "../compute";
import { canSeeReports } from "../rules";

/**
 * The executive dashboard (the brief, CEO): projects (active, done, stopped), overall progress, the projects that need a
 * decision, tasks (done, left, late), team levels, a staff summary, open and late bugs, and the latest announcements.
 * Each person sees it over the projects they may see.
 */
export function DashboardPage() {
  const { tr, lang, num, pct, day } = useFmt();
  usePageTitle(tr("لوحة القيادة", "Dashboard"));
  const user = useUser();
  const allowed = canSeeReports(user);
  const load = useLoad(
    () => (allowed ? Promise.all([
            reportsApi.overview(),
            authApi.users(),
            announcementsApi.announcements(),
            // A PM's person links need the projects they run (personHref).
            user.role === "pm" ? projectsApi.projects() : Promise.resolve([]),
            // The CEO: what waits in the inbox (requests, reports, problems) shows at the top.
            user.role === "ceo" ? monitoringApi.inbox().catch(() => []) : Promise.resolve([]),
          ]) : Promise.resolve(null)),
    [allowed],
  );

  if (!allowed) return <Empty title={tr("لوحة القيادة للإدارة", "The dashboard is for management")} body={tr("افتح «مهامي» لترى مهامك.", 'Open "My tasks" to see your tasks.')} />;
  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;

  const [o, users, announcements, projectsForLinks, inbox] = load.data;
  const waiting = inbox.filter((n) => n.ceo_state === "new");
  const requests = waiting.filter((n) => n.kind === "request").length;
  const t = totals(o);
  const monitor = user.role === "monitor";
  const people = new Map(users.map((u) => [u.id, u]));
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const projectName = (p: { name: string; name_en?: string }) => (lang === "en" && p.name_en ? p.name_en : p.name);
  const ownTeam = o.teams.find((team) => team.team_id === user.team_id);
  const teamName = ownTeam ? (lang === "en" && ownTeam.name_en ? ownTeam.name_en : ownTeam.name) : tr("فريقك", "Your team");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Each job opens the page its own way. The CEO: a night banner with the page's name and today's numbers. */}
      {user.role === "ceo" ? (
        <CeoHero
          date={day(o.today)}
          numbers={[
            { label: tr("مشاريع نشطة", "Active"), value: num(t.projects.active), href: "/" },
            { label: tr("الإنجاز", "Progress"), value: pct(t.ratio), href: "/reports" },
            { label: tr("مهام تأخرت", "Late"), value: num(t.tasks.late), alert: t.tasks.late > 0, href: "#attention-title" },
          ]}
        />
      ) : user.role === "lead" ? (
        // The team leader: a slide with the team's tasks as spheres in a glass one.
        <LeadSphere shares={teamShares(o, user.team_id)} team={teamName} date={day(o.today)} href={user.team_id ? `/reports?tab=people&team=${user.team_id}` : "/reports"} />
      ) : monitor ? (
        // Monitoring and evaluation: a banner, the summary cards and every project against its plan.
        <MonitorSummary user={user} o={o} t={t} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{tr("لوحة القيادة", "Dashboard")}</h1>
            <p className="text-sm text-muted">{tr(`الأرقام حتى ${day(o.today)}، للمشاريع التي تراها.`, `Numbers up to ${day(o.today)}, for the projects you can see.`)}</p>
          </div>
          <ButtonLink href="/reports" variant="secondary" pill>
            {tr("كل التقارير", "All reports")}
          </ButtonLink>
        </div>
      )}

      {/* The CEO: new things in the inbox, one line that opens it. */}
      {waiting.length > 0 && (
        <Link href="/inbox" className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-ink hover:border-accent">
          <Inbox size={18} aria-hidden="true" className="shrink-0" />
          <span className="flex-1">
            <b className="font-semibold">{tr(`في الوارد ما ينتظرك: ${num(waiting.length)}`, `Waiting in your inbox: ${waiting.length}`)}</b>
            {requests > 0 && <span className="text-accent-ink/80">{tr(` · منها طلبات: ${num(requests)}`, ` · requests: ${requests}`)}</span>}
          </span>
          <ChevronLeft size={16} aria-hidden="true" className="shrink-0 ltr:rotate-180" />
        </Link>
      )}

      {!monitor && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            href="/"
            label={tr("المشاريع النشطة", "Active projects")}
            value={num(t.projects.active)}
            note={tr(`مكتملة ${num(t.projects.done)} · متوقفة ${num(t.projects.paused)} · مخطط لها ${num(t.projects.planned)}`, `${t.projects.done} done · ${t.projects.paused} paused · ${t.projects.planned} planned`)}
          />
          <Stat href="/reports" label={tr("الإنجاز الكلي", "Overall progress")} value={pct(t.ratio)} note={tr(`${num(t.tasks.done)} من ${num(t.tasks.total)} مهمة`, `${t.tasks.done} of ${t.tasks.total} tasks`)} />
          <Stat
            href="/reports"
            label={tr("مهام متأخرة", "Late tasks")}
            value={num(t.tasks.late)}
            danger={t.tasks.late > 0}
            note={tr(`المتبقي ${num(t.tasks.left)} · متوقفة ${num(t.tasks.blocked)}`, `${t.tasks.left} left · ${t.tasks.blocked} blocked`)}
          />
          <Stat
            href={o.bugs.late > 0 ? "/bugs?show=late" : "/bugs"}
            label={tr("أخطاء مفتوحة", "Open bugs")}
            value={num(o.bugs.open)}
            danger={o.bugs.late > 0}
            note={tr(`متأخرة ${num(o.bugs.late)} · حرجة ${num(o.bugs.critical_open)}`, `${o.bugs.late} late · ${o.bugs.critical_open} critical`)}
          />
        </div>
      )}

      {/* The project manager: the task calendar and the board over all their projects. */}
      {user.role === "pm" && <PmPlan today={o.today} people={people} />}

      {!monitor && (
        <section aria-labelledby="attention-title" className="rounded-xl border border-line bg-card p-4">
          <h2 id="attention-title" className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle size={17} aria-hidden="true" className="text-danger" />
            {tr("مشاريع تحتاج إلى قرار", "Projects that need a decision")}
          </h2>
          {t.attention.length === 0 ? (
            <p className="text-sm text-muted">{tr("كل المشاريع في موعدها وعلى خطتها.", "Every project is on time and on plan.")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {t.attention.map((p) => (
                <li key={p.id}>
                  {/* The whole row opens the project's board (click anywhere). */}
                  <Link href={`/projects/${p.id}`} className="flex flex-col gap-2 rounded-lg border border-line p-3 hover:border-accent sm:flex-row sm:items-center">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span dir="auto" className="font-medium">
                        {projectName(p)}
                      </span>
                      {p.overdue && <Pill tone="blocked">{tr(`تجاوز موعده ${day(p.end)}`, `Past its end, ${day(p.end)}`)}</Pill>}
                      {p.behind && <Pill tone="review">{tr("متأخر عن الخطة", "Behind the plan")}</Pill>}
                    </span>
                    <span className="flex w-full items-center gap-2 text-xs text-muted sm:w-72">
                      <ProgressBar value={p.ratio} planned={p.planned_ratio} label={tr(`إنجاز ${projectName(p)}`, `${projectName(p)} progress`)} className="flex-1" />
                      <span className="num shrink-0">
                        {pct(p.ratio)} / {pct(p.planned_ratio)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="teams-title" className="rounded-xl border border-line bg-card p-4">
          <h2 id="teams-title" className="mb-3 font-semibold">
            {tr("مستوى الفرق", "Team levels")}
          </h2>
          {o.teams.length === 0 ? (
            <p className="text-sm text-muted">{tr("لا توجد مهام لفرق بعد.", "No team tasks yet.")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {o.teams.map((team) => (
                // The whole row opens the people report of that team.
                <li key={team.team_id} className="relative -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-1 hover:bg-card-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <Link href={`/reports?tab=people&team=${team.team_id}`} dir="auto" className="font-medium after:absolute after:inset-0 hover:underline">
                      {lang === "en" && team.name_en ? team.name_en : team.name}
                    </Link>
                    <span className="text-muted">
                      {tr(`${num(team.members)} أعضاء · مفتوحة ${num(team.open)} · متأخرة ${num(team.late)}`, `${team.members} people · ${team.open} open · ${team.late} late`)}
                    </span>
                  </div>
                  <ProgressBar value={team.ratio} label={tr(`إنجاز ${team.name}`, `${team.name_en ?? team.name} done`)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="staff-title" className="rounded-xl border border-line bg-card p-4">
          <h2 id="staff-title" className="mb-3 font-semibold">
            {tr("ملخص الموظفين", "Staff summary")}
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {o.people.slice(0, 6).map((r) => {
              const u = people.get(r.user_id);
              return (
                // The whole row opens the person's performance, when this viewer may open it.
                <li key={r.user_id} className="relative flex items-center gap-2.5 py-2 text-sm">
                  {u && <Avatar user={u} size="sm" />}
                  <MaybeLink href={u && personHref(user, u, projectsForLinks)} cover className="min-w-0 flex-1 truncate">
                    {nameOf(r.user_id)}
                  </MaybeLink>
                  <span className="text-xs text-muted">{tr(`مفتوحة ${num(r.open)} · منجزة ${num(r.done)}`, `${r.open} open · ${r.done} done`)}</span>
                  {r.late > 0 && <Pill tone="blocked">{tr(`متأخرة ${num(r.late)}`, `${r.late} late`)}</Pill>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section aria-labelledby="news-title" className="rounded-xl border border-line bg-card p-4">
        <h2 id="news-title" className="mb-3 flex items-center gap-2 font-semibold">
          <Megaphone size={17} aria-hidden="true" className="text-muted" />
          {tr("آخر الإعلانات", "Latest announcements")}
        </h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted">{tr("لا إعلانات بعد.", "No announcements yet.")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {announcements.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link href={`/announcements/${a.id}`} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-chip">
                  {a.important && <Pill tone="progress">{tr("مهم", "Important")}</Pill>}
                  <span dir="auto" className="min-w-0 flex-1 truncate font-medium">
                    {a.title}
                  </span>
                  <span className="text-xs text-muted">{tr(`شاهده ${num(a.seen_count)} من ${num(a.audience_count)}`, `seen by ${a.seen_count} of ${a.audience_count}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-faint">
        {tr(
          `«متأخر عن الخطة»: مشروع نشط إنجازه أقل من الخطة بأكثر من 15 نقطة (الخطة = الأيام المنقضية من مدته). حالات المشاريع: ${PROJECT_STATE.active.ar}، ${PROJECT_STATE.done.ar}، ${PROJECT_STATE.paused.ar}، ${PROJECT_STATE.planned.ar}.`,
          '"Behind the plan": an active project more than 15 points behind (the plan = the share of its days gone).',
        )}
      </p>
    </div>
  );
}
