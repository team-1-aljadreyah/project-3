import { ChevronLeft, Gauge } from "lucide-react";
import Link from "next/link";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { ratingsApi } from "../api";
import { reasonWords } from "../rules";
import { AverageMark, RateButton } from "./rate-button";

/**
 * "Rate a team", for the dashboard of whoever rates teams (the monitoring officer): the teams she may rate, the oldest
 * rated first, each with its average and its last rating, a "Rate" button on each line and the way to every team.
 * Nothing shows for someone who rates no team.
 */
export function TeamsToRate() {
  const { tr, lang, ago } = useFmt();
  const load = useLoad(() => ratingsApi.teams().catch(() => []));
  const rows = (load.data ?? []).filter((r) => r.can_rate);
  if (!load.data || rows.length === 0) return null;
  // The team rated longest ago (or never) first: the one that needs her most.
  const ordered = [...rows].sort((a, b) => (a.ratings?.last?.created_at ?? "").localeCompare(b.ratings?.last?.created_at ?? ""));
  const nameOf = (t: { name: string; name_en?: string }) => (lang === "en" && t.name_en ? t.name_en : t.name);

  return (
    <section aria-labelledby="rate-teams-title" className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="rate-teams-title" className="flex items-center gap-2 font-semibold">
          <Gauge size={17} aria-hidden="true" className="text-accent" />
          {tr("قيّم فريقاً", "Rate a team")}
        </h2>
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          {tr("كل الفرق", "All teams")}
          <ChevronLeft size={15} aria-hidden="true" className="ltr:rotate-180" />
        </Link>
      </div>
      <p className="mb-3 text-[13px] text-muted">{tr("درجة وسبب بكلماتك، لأي سبب وفي أي وقت. ويصل إشعار إلى قائد الفريق إلا إن جعلته خاصاً.", "A score and your reason, any reason, any time. The team leader is told unless you make it private.")}</p>
      <ul className="flex flex-col divide-y divide-line">
        {ordered.map((row) => {
          const last = row.ratings?.last;
          return (
            // The whole line opens the team's page; "Rate" sits above that link.
            <li key={row.team.id} className="relative -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-card-2">
              <Link href={`/teams/${row.team.id}`} dir="auto" className="min-w-0 flex-1 truncate font-medium after:absolute after:inset-0 hover:underline">
                {nameOf(row.team)}
              </Link>
              {row.ratings && <AverageMark summary={row.ratings} />}
              <span className="text-xs text-muted">
                {last ? tr(`آخر تقييم ${ago(last.created_at)} · ${reasonWords(last.reason_type).ar}`, `Last ${ago(last.created_at)} · ${reasonWords(last.reason_type).en}`) : tr("لم يُقيَّم بعد", "Not rated yet")}
              </span>
              <RateButton target={{ subject: { type: "team", id: row.team.id }, name: nameOf(row.team) }} onSaved={load.reload} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
