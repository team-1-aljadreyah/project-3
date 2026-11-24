import { BarChart3, Users } from "lucide-react";
import Link from "next/link";
import { CelebrateButton } from "@/features/celebrations";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useRouteParam } from "@/shared/lib/route-param";
import { useRoleName } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { ButtonLink, ErrorBox, LoadingBlock, PersonName, Pill, Skeleton, Stat, Avatar } from "@/shared/ui";
import { ratingsApi } from "../api";
import { RatingsPanel } from "../components/ratings-panel";

/**
 * /teams/3: one team: its name and leader, its people, the members' tasks now (for the jobs that see the reports), and
 * its quick ratings (the average and trend, by kind of reason, the list), with "Rate this team" for those who may.
 */
export function TeamPage() {
  const { tr, lang, num } = useFmt();
  const roleName = useRoleName();
  const id = Number(useRouteParam("teams"));
  const load = useLoad(() => ratingsApi.team(id), [id]);
  const team = load.data?.team;
  const name = team ? (lang === "en" && team.name_en ? team.name_en : team.name) : "";
  usePageTitle(name || tr("الفريق", "Team"));

  if (load.state.status === "loading" && !load.data) {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} backHref="/teams" />;
  if (!load.data || !team) return null;
  const { members, tasks, can_see_ratings } = load.data;
  const lead = members.find((m) => m.id === team.lead_id);
  const report = `/reports?tab=people&team=${team.id}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
        <Link href="/teams" className="hover:text-text hover:underline">
          {tr("الفرق", "Teams")}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
            <Users size={24} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 dir="auto" className="text-2xl font-semibold">
              {name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
              {lead ? (
                <>
                  {tr("القائد:", "Leader:")} <PersonName person={lead} className="font-medium text-text" />
                </>
              ) : (
                tr("بلا قائد", "No leader")
              )}
              <span>· {tr(`${num(members.length)} أعضاء`, `${members.length} people`)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The monitoring officer (and the CEO) celebrate the team: its people see it the next time they open the platform. */}
          <CelebrateButton teams={[team]} teamId={team.id} />
          {tasks && (
            <ButtonLink href={report} variant="secondary" pill>
              <BarChart3 size={16} aria-hidden="true" />
              {tr("تقرير الفريق", "Team report")}
            </ButtonLink>
          )}
        </div>
      </div>

      {tasks && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat href={report} label={tr("مهام مفتوحة", "Open tasks")} value={num(tasks.open)} note={tr("للأعضاء الآن", "of its people, now")} />
          <Stat href={report} label={tr("متأخرة", "Late")} value={num(tasks.late)} danger={tasks.late > 0} note={tr("تجاوزت موعدها", "past their due day")} />
          <Stat href={report} label={tr("متوقفة", "Blocked")} value={num(tasks.blocked)} danger={tasks.blocked > 0} note={tr("تنتظر حلاً", "waiting for a fix")} />
          <Stat href={report} label={tr("منجزة", "Done")} value={num(tasks.done)} note={tr("في المشاريع التي تراها", "in the projects you see")} />
        </div>
      )}

      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h2 id="members-title" className="text-lg font-semibold">
          {tr("الأعضاء", "People")}
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted">{tr("لا أعضاء في الفريق بعد.", "Nobody is in the team yet.")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              // The whole card opens the person's performance, when this viewer may open it.
              <li key={m.id} className="relative flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 transition-colors focus-within:border-accent hover:border-accent">
                <Avatar user={m} size="lg" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <PersonName person={m} cover className="truncate font-medium" />
                  <span className="truncate text-xs text-muted">{m.title || roleName(m)}</span>
                </span>
                {m.id === team.lead_id && <Pill tone="progress">{tr("القائد", "Leader")}</Pill>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {can_see_ratings && (
        <RatingsPanel
          target={{ subject: { type: "team", id: team.id }, name, memberIds: members.map((m) => m.id) }}
          title={tr("تقييمات الفريق السريعة", "The team's quick ratings")}
          rateLabel={tr("قيّم الفريق", "Rate this team")}
        />
      )}
    </div>
  );
}
