import { ArrowDown, ArrowUp, Users } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/features/auth";
import { CelebrateButton } from "@/features/celebrations";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { AvatarStack, Empty, ErrorBox, LoadingBlock, PersonName, Skeleton, Stat } from "@/shared/ui";
import { ratingsApi } from "../api";
import { AverageMark, RateButton } from "../components/rate-button";
import { reasonWords, SCORE_WORDS, trendOf } from "../rules";
import type { TeamListRow } from "../types";

/** A team "waits for a rating" when nobody rated it in the last 30 days. */
const WAIT_DAYS = 30;
const waiting = (row: TeamListRow, now: Date) => !!row.ratings && (!row.ratings.last || now.getTime() - new Date(row.ratings.last.created_at).getTime() > WAIT_DAYS * 86_400_000);

/**
 * /teams: every team this person may see, each with its leader, its people, its average quick rating and trend, and the
 * last rating; the whole row opens the team's page, and "Rate" opens the rating window at once. The number boxes on top
 * filter the list (kept in the address: /teams?show=waiting).
 */
export function TeamsPage() {
  const { tr, lang, num, ago } = useFmt();
  usePageTitle(tr("الفرق", "Teams"));
  const me = useUser();
  const load = useLoad(() => Promise.all([ratingsApi.teams(), authApi.users()]));
  const [show, setShow] = useQueryParam<"all" | "waiting">("show", "all", ["all", "waiting"]);

  if (load.state.status === "loading" && !load.data) {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;
  const [rows, users] = load.data;
  const now = new Date();
  const people = new Map(users.map((u) => [u.id, u]));
  const recent = rows.reduce((n, r) => n + (r.ratings?.recent.count ?? 0), 0);
  const waitingRows = rows.filter((r) => waiting(r, now));
  const shown = show === "waiting" ? waitingRows : rows;
  const nameOf = (t: { name: string; name_en?: string }) => (lang === "en" && t.name_en ? t.name_en : t.name);
  const rater = rows.some((r) => r.can_rate);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{tr("الفرق", "Teams")}</h1>
          {/* The monitoring officer (and the CEO) choose a team and celebrate it. */}
          <CelebrateButton teams={rows.map((r) => r.team)} />
        </div>
        <p className="text-sm text-muted">
          {me.role === "pm"
            ? tr("تقيّم الفرق العاملة في مشاريعك تقييماً سريعاً: درجة وسبب بكلماتك.", "You give quick ratings to the teams in your projects: a score and a reason in your words.")
            : rater
              ? tr("قيّم أي فريق في أي وقت ولأي سبب: درجة وسبب بكلماتك، ظاهر للفريق أو خاص.", "Rate any team, any time, for any reason: a score and your reason, visible to the team or private.")
              : tr("فريقك وتقييماته.", "Your team and its ratings.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={tr("الفرق", "Teams")} value={num(rows.length)} note={tr(`${num(users.filter((u) => u.active && u.team_id).length)} شخصاً فيها`, `${users.filter((u) => u.active && u.team_id).length} people in them`)} onClick={() => setShow("all")} />
        <Stat label={tr("تقييمات آخر 90 يوماً", "Ratings, last 90 days")} value={num(recent)} note={tr("مما تراه أنت", "of the ones you can see")} />
        <Stat
          label={tr("تنتظر تقييماً", "Waiting for a rating")}
          value={num(waitingRows.length)}
          note={tr(`لم تُقيَّم منذ ${WAIT_DAYS} يوماً`, `Not rated for ${WAIT_DAYS} days`)}
          danger={waitingRows.length > 0}
          onClick={() => setShow(show === "waiting" ? "all" : "waiting")}
          className={cn("col-span-2 md:col-span-1", show === "waiting" && "border-accent")}
        />
      </div>

      {show === "waiting" && (
        <p className="flex items-center gap-2 text-sm">
          {tr("تظهر الفرق التي تنتظر تقييماً فقط.", "Showing the teams waiting for a rating only.")}
          <button type="button" onClick={() => setShow("all")} className="font-medium text-accent underline underline-offset-4">
            {tr("اعرض الكل", "Show all")}
          </button>
        </p>
      )}

      {shown.length === 0 ? (
        <Empty title={show === "waiting" ? tr("كل الفرق مُقيَّمة حديثاً", "Every team was rated lately") : tr("لا توجد فرق", "No teams")} body={tr("تُنشأ الفرق من صفحة إدارة النظام.", "Teams are made on the administration page.")} />
      ) : (
        <ul aria-label={tr("قائمة الفرق", "The teams")} className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
          <li aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_5.5rem] gap-4 border-b border-line px-4 py-2.5 text-xs text-muted md:grid">
            <span>{tr("الفريق والقائد", "Team and leader")}</span>
            <span>{tr("الأعضاء", "People")}</span>
            <span>{tr("متوسط التقييم", "Average rating")}</span>
            <span>{tr("آخر تقييم", "Last rating")}</span>
            <span />
          </li>
          {shown.map((row) => {
            const lead = row.team.lead_id ? people.get(row.team.lead_id) : undefined;
            const members = users.filter((u) => u.active && u.team_id === row.team.id);
            const delta = row.ratings ? trendOf(row.ratings) : null;
            const last = row.ratings?.last;
            return (
              <li key={row.team.id} className="relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 last:border-0 hover:bg-card-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_5.5rem]">
                <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                    <Users size={18} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {/* The team's name is the row's link, stretched over the whole row. */}
                    <Link href={`/teams/${row.team.id}`} dir="auto" className="truncate font-semibold after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
                      {nameOf(row.team)}
                    </Link>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      {lead ? (
                        <>
                          {tr("القائد:", "Leader:")} <PersonName person={lead} className="relative z-10" />
                        </>
                      ) : (
                        tr("بلا قائد", "No leader")
                      )}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {members.length > 0 && <AvatarStack users={members} max={4} />}
                  <span className="text-xs text-muted">{tr(`${num(row.member_count)} أعضاء`, `${row.member_count} people`)}</span>
                </div>
                <div className="flex items-center gap-2 justify-self-end md:justify-self-start">
                  {row.ratings ? <AverageMark summary={row.ratings} /> : <span className="text-xs text-faint">{tr("لا تراها", "Not yours to see")}</span>}
                  {delta !== null && delta !== 0 && (
                    <span className={cn("inline-flex items-center text-xs font-semibold", delta > 0 ? "text-success" : "text-danger")}>
                      {delta > 0 ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
                      <span className="num">{`${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}</span>
                      <span className="sr-only">{tr(" عن قبل 90 يوماً", " against before the last 90 days")}</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {last ? (
                    <span className="flex flex-wrap items-center gap-x-1.5">
                      <b className="font-medium text-text">{tr(SCORE_WORDS[last.score].ar, SCORE_WORDS[last.score].en)}</b>
                      <span>· {tr(reasonWords(last.reason_type).ar, reasonWords(last.reason_type).en)}</span>
                      <span>· {ago(last.created_at, now)}</span>
                    </span>
                  ) : row.ratings ? (
                    tr("لم يُقيَّم بعد", "Not rated yet")
                  ) : null}
                  {waiting(row, now) && row.can_rate && <span className="block text-danger">{tr("ينتظر تقييماً", "Waiting for a rating")}</span>}
                </div>
                <div className="justify-self-end">
                  {row.can_rate && <RateButton target={{ subject: { type: "team", id: row.team.id }, name: nameOf(row.team), memberIds: members.map((m) => m.id) }} onSaved={load.reload} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
