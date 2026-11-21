import { History, Lock, Network, UserCheck, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { StatusTone } from "@/shared/api/types";
import { roleName } from "@/shared/lib/site";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, ButtonLink, ErrorBox, LoadingBlock, MaybeLink, Pill, Skeleton, TONE_CLASS } from "@/shared/ui";
import { adminApi } from "../api";
import { ACTION_KIND, ACTION_WORDS, KIND_WORDS, targetHref } from "../audit-words";
import { isLocked } from "../rules";
import { adminOverview } from "../summary";
import type { AdminUser } from "../types";
import { ActivityChart, Sparkline } from "./charts";
import { UserDialog } from "./user-dialog";

const card = "rounded-2xl border border-line bg-card p-4 sm:p-5";
const th = "px-2 py-2 text-start text-xs font-medium whitespace-nowrap text-muted";
const td = "px-2 py-2.5";

/**
 * The top of the admin page: four soft number cards, each with a small line of the last 7 days; the audit log's
 * activity per day (this week or the week before); the newest audit lines; and the accounts that changed last.
 * Everything is counted from the users, the teams and the audit log (../summary.ts): there is no new call.
 * "This week" is the last 7 days with today; "last week" is the 7 days before them.
 */
export function AdminOverview({ me }: { me: number }) {
  const { tr, lang, num, pct, day, ago, dateTime } = useFmt();
  const load = useLoad(() => Promise.all([adminApi.users(), adminApi.teams(), adminApi.audit({})]));
  const [shown, setShown] = useState<"week" | "before">("week");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const data = load.data;
  const o = useMemo(() => (data ? adminOverview(data[0], data[1], data[2]) : null), [data]);

  if (load.state.status === "loading") {
    // Grey blocks of about the size of what comes, so the sections under them don't jump when it arrives.
    return (
      <LoadingBlock className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-37 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Skeleton className="h-89 rounded-2xl sm:h-93" />
            <Skeleton className="h-110 rounded-2xl sm:h-85" />
          </div>
          <Skeleton className="h-134 rounded-2xl lg:h-auto" />
        </div>
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!data || !o) return null;

  const [users, teams] = data;
  const people = new Map(users.map((u) => [u.id, u]));
  const nameOf = (u: { name: string; name_en?: string }) => (lang === "en" && u.name_en ? u.name_en : u.name);
  const now = new Date().toISOString();
  const list = (numbers: number[]) => tr(numbers.map(num).join("، "), numbers.join(", "));
  // "+1 this week", or that nothing is new. The sign and the number stay together in Arabic too.
  const addedNote = (n: number) =>
    n > 0 ? (
      <>
        <span dir="ltr">+{num(n)}</span> {tr("هذا الأسبوع", "this week")}
      </>
    ) : (
      tr("لا جديد هذا الأسبوع", "Nothing new this week")
    );

  const stats: { key: string; href: string; label: string; icon: LucideIcon; tone: StatusTone; value: number; note: React.ReactNode; trend: number[]; trendLabel: string }[] = [
    {
      key: "accounts",
      href: "/admin?tab=users",
      label: tr("الحسابات", "Accounts"),
      icon: Users,
      tone: "todo",
      value: o.accounts.total,
      note: addedNote(o.accounts.added),
      trend: o.accounts.trend,
      trendLabel: tr(`عدد الحسابات في آخر 7 أيام: ${list(o.accounts.trend)}`, `Accounts over the last 7 days: ${list(o.accounts.trend)}`),
    },
    {
      key: "active",
      href: "/admin?tab=users",
      label: tr("حسابات نشطة", "Active accounts"),
      icon: UserCheck,
      tone: "done",
      value: o.active.total,
      note: tr(`موقوفة ${num(o.active.stopped)} · مقفلة ${num(o.active.locked)}`, `${o.active.stopped} stopped · ${o.active.locked} locked`),
      trend: o.active.trend,
      trendLabel: tr(`عدد الحسابات النشطة في آخر 7 أيام: ${list(o.active.trend)}`, `Active accounts over the last 7 days: ${list(o.active.trend)}`),
    },
    {
      key: "teams",
      href: "/admin?tab=teams",
      label: tr("الفرق", "Teams"),
      icon: Network,
      tone: "testing",
      value: o.teams.total,
      note: addedNote(o.teams.added),
      trend: o.teams.trend,
      trendLabel: tr(`عدد الفرق في آخر 7 أيام: ${list(o.teams.trend)}`, `Teams over the last 7 days: ${list(o.teams.trend)}`),
    },
    {
      key: "lines",
      href: "/audit",
      label: tr("عمليات هذا الأسبوع", "Actions this week"),
      icon: History,
      tone: "review",
      value: o.lines.week,
      // A percent only when last week had actions to compare with.
      note:
        o.lines.ratio === null ? (
          tr("لا عمليات في الأسبوع الماضي", "No actions last week")
        ) : o.lines.ratio === 0 ? (
          tr("كما في الأسبوع الماضي", "Same as last week")
        ) : (
          <>
            <span dir="ltr">
              {o.lines.ratio > 0 ? "+" : "-"}
              {pct(Math.abs(o.lines.ratio))}
            </span>{" "}
            {tr("عن الأسبوع الماضي", "vs last week")}
          </>
        ),
      trend: o.perDay,
      trendLabel: tr(`عمليات كل يوم في آخر 7 أيام: ${list(o.perDay)}`, `Actions each day over the last 7 days: ${list(o.perDay)}`),
    },
  ];

  const days = shown === "week" ? o.week : o.weekBefore;
  const values = shown === "week" ? o.perDay : o.perDayBefore;
  const total = shown === "week" ? o.lines.week : o.lines.before;
  const weekName = shown === "week" ? tr("هذا الأسبوع", "This week") : tr("الأسبوع الماضي", "Last week");
  const perDayWords = days.map((d, i) => `${day(d)}: ${num(values[i])}`);

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="sr-only">
          {tr("نظرة عامة", "Overview")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            // The whole card opens its tab or page (the label is the link, stretched over the card).
            <li key={s.key} className={cn("relative flex flex-col gap-1 rounded-2xl p-4 transition-transform hover:-translate-y-0.5", TONE_CLASS[s.tone].pill)}>
              <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                <Link href={s.href} className="after:absolute after:inset-0 after:rounded-2xl hover:underline">
                  {s.label}
                </Link>
                <s.icon size={18} aria-hidden="true" className="shrink-0" />
              </span>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-3xl leading-tight font-semibold text-text">{num(s.value)}</span>
                <span className="text-xs">{s.note}</span>
              </span>
              {/* At the bottom of the card, also when a neighbour's longer note makes the row taller. */}
              <div className="mt-auto pt-3">
                <Sparkline values={s.trend} label={s.trendLabel} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <section aria-labelledby="activity-title" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="activity-title" className="font-semibold">
                  {tr("النشاط", "Activity")}
                </h2>
                <p className="text-xs text-muted">{tr(`من ${day(days[0])} إلى ${day(days[6])} · العمليات: ${num(total)}`, `${day(days[0])} to ${day(days[6])} · Actions: ${total}`)}</p>
              </div>
              <div role="group" aria-label={tr("الأسبوع المعروض", "Week shown")} className="flex gap-1.5">
                {(["week", "before"] as const).map((k) => (
                  <Button key={k} size="sm" pill variant={shown === k ? "primary" : "secondary"} aria-pressed={shown === k} onClick={() => setShown(k)}>
                    {k === "week" ? tr("هذا الأسبوع", "This week") : tr("الأسبوع الماضي", "Last week")}
                  </Button>
                ))}
              </div>
            </div>
            <ActivityChart
              days={days}
              values={values}
              today={o.week[6]}
              label={tr(`ما سجّله سجل العمليات كل يوم، ${weekName}: ${perDayWords.join("، ")}`, `What the audit log recorded each day, ${weekName}: ${perDayWords.join(", ")}`)}
            />
          </section>

          <section aria-labelledby="latest-title" className={card}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="latest-title" className="font-semibold">
                {tr("آخر العمليات", "Latest actions")}
              </h2>
              <ButtonLink href="/audit" variant="secondary" size="sm" pill aria-label={tr("عرض الكل في سجل العمليات", "View all in the audit log")}>
                {tr("عرض الكل", "View all")}
              </ButtonLink>
            </div>
            {o.latest.length === 0 ? (
              <p className="text-sm text-muted">{tr("لا عمليات بعد.", "No actions yet.")}</p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{tr("آخر ما سجّله سجل العمليات", "The audit log's newest lines")}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>
                        {tr("من", "Who")}
                      </th>
                      <th scope="col" className={th}>
                        {tr("العملية", "Action")}
                      </th>
                      <th scope="col" className={cn(th, "max-sm:hidden")}>
                        {tr("الوقت", "Time")}
                      </th>
                      <th scope="col" className={cn(th, "max-sm:hidden")}>
                        {tr("النوع", "Kind")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.latest.map((e) => {
                      const actor = e.actor_id ? people.get(e.actor_id) : undefined;
                      const kind = KIND_WORDS[ACTION_KIND[e.action]];
                      const when = (
                        <time dateTime={e.at} title={dateTime(e.at)}>
                          {ago(e.at)}
                        </time>
                      );
                      const kindPill = <Pill tone={kind.tone}>{tr(kind.ar, kind.en)}</Pill>;
                      return (
                        // The whole row opens what the action was about, when it has a page.
                        <tr key={e.id} className="relative border-t border-line hover:bg-card-2">
                          {/* On a phone four columns don't fit: the time sits under the name and the kind under the
                              action, and their own columns are hidden. */}
                          <td className={td}>
                            <span className="flex items-center gap-2">
                              {/* The name is right beside the picture: screen readers hear it once. Nobody signed in
                                  (a wrong password): a plain circle keeps the names in one line. */}
                              <span aria-hidden="true" className="flex">
                                {actor ? <Avatar user={actor} size="sm" /> : <span className="inline-flex size-6 items-center justify-center rounded-full bg-chip text-[11px] font-semibold text-muted">{tr("؟", "?")}</span>}
                              </span>
                              <span className="flex flex-col">
                                <span className="font-medium whitespace-nowrap">{actor ? nameOf(actor) : e.actor_id ? "-" : tr("غير معروف", "Unknown")}</span>
                                <span className="text-xs whitespace-nowrap text-muted sm:hidden">{when}</span>
                              </span>
                            </span>
                          </td>
                          <td className={cn(td, "wrap-anywhere")}>
                            <span className="flex flex-col items-start gap-1">
                              <span>
                                {tr(ACTION_WORDS[e.action].ar, ACTION_WORDS[e.action].en)}:{" "}
                                <MaybeLink href={targetHref(e.target)} cover>
                                  <bdi>{e.target.label}</bdi>
                                </MaybeLink>
                              </span>
                              <span className="sm:hidden">{kindPill}</span>
                            </span>
                          </td>
                          <td className={cn(td, "text-xs whitespace-nowrap text-muted max-sm:hidden")}>{when}</td>
                          <td className={cn(td, "max-sm:hidden")}>{kindPill}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section aria-labelledby="people-title" className={cn(card, "flex flex-col")}>
          <h2 id="people-title" className="font-semibold">
            {tr("أحدث الحسابات", "Recent accounts")}
          </h2>
          <p className="text-xs text-muted">{tr("آخر ما أُضيف أو عُدّل", "Last added or changed")}</p>
          <ul className="mt-2 flex flex-1 flex-col divide-y divide-line">
            {o.people.map(({ user: u, at }) => (
              <li key={u.id} className="flex flex-1 py-1">
                {/* The whole row opens the account (click anywhere). */}
                <button type="button" onClick={() => setEditing(u)} className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-chip">
                  <span aria-hidden="true" className="flex">
                    <Avatar user={u} size="lg" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                    {/* A taller line than usual: a cut-off line would also cut the dots under the Arabic letters. */}
                    <span className="truncate text-xs leading-5 text-muted">
                      {roleName(u, lang)}
                      {at && ` · ${ago(at)}`}
                    </span>
                  </span>
                  {!u.active ? (
                    <Pill tone="blocked" className="shrink-0">
                      {tr("موقوف", "Stopped")}
                    </Pill>
                  ) : isLocked(u, now) ? (
                    <Pill tone="review" className="shrink-0 gap-1">
                      <Lock size={12} aria-hidden="true" />
                      {tr("مقفل", "Locked")}
                    </Pill>
                  ) : (
                    <Pill tone="done" className="shrink-0">
                      {tr("نشط", "Active")}
                    </Pill>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && <UserDialog user={editing} teams={teams} me={me} onClose={() => setEditing(null)} onSaved={load.reload} />}
    </div>
  );
}
