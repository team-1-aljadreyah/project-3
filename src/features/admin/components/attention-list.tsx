import { ChevronLeft, ChevronRight, CircleCheck, DatabaseBackup, HardDrive, Lock, UserX, Users, UserRoundX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { LoadingBlock, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { needsAttention, type Attention, type AttentionKey } from "../health";
import { NEVER_SIGNED_IN_DAYS } from "../security";

const ICON: Record<AttentionKey, LucideIcon> = { locked: Lock, storage: HardDrive, backup: DatabaseBackup, never: UserRoundX, no_leader: UserX, no_team: Users };

/** Each item in words: what it is and what the link does. */
function words(a: Attention, tr: (ar: string, en: string) => string, num: (n: number) => string, pct: (r: number) => string) {
  switch (a.key) {
    case "locked":
      return { text: tr(`${num(a.count)} حساب مقفل الآن بعد محاولات خاطئة`, `${a.count} ${a.count === 1 ? "account is" : "accounts are"} locked after wrong passwords`), fix: tr("افتحها", "Unlock") };
    case "storage":
      return { text: tr(`المساحة المستعملة ${pct(a.count)} من المتاح`, `Storage is ${pct(a.count)} full`), fix: tr("انظر التفاصيل", "See the details") };
    case "backup":
      return { text: tr("آخر نسخة احتياطية فشلت أو مضى عليها أكثر من يومين", "The last backup failed or is more than two days old"), fix: tr("انظر الحالة", "See the status") };
    case "never":
      return {
        text: tr(`${num(a.count)} حساب لم يدخل صاحبه منذ أكثر من ${num(NEVER_SIGNED_IN_DAYS)} أيام`, `${a.count} ${a.count === 1 ? "account" : "accounts"} older than ${NEVER_SIGNED_IN_DAYS} days never signed in`),
        fix: tr("راجعها", "Review"),
      };
    case "no_leader":
      return { text: tr(`${num(a.count)} فريق بلا قائد`, `${a.count} ${a.count === 1 ? "team has" : "teams have"} no leader`), fix: tr("عيّن قائداً", "Set a leader") };
    case "no_team":
      return { text: tr(`${num(a.count)} موظف أو قائد بلا فريق`, `${a.count} ${a.count === 1 ? "person is" : "people are"} in no team`), fix: tr("عيّن فريقاً", "Assign a team") };
  }
}

/** The list itself: one row per item, the whole row a link to the page that fixes it. */
export function AttentionRows({ items, className }: { items: Attention[]; className?: string }) {
  const { tr, num, pct, lang } = useFmt();
  const Chevron = lang === "ar" ? ChevronLeft : ChevronRight;
  if (!items.length) {
    return (
      <p className={cn("flex items-center gap-2 px-4 py-3 text-sm text-muted", className)}>
        <CircleCheck size={16} aria-hidden="true" className="text-success" />
        {tr("لا شيء يحتاج إلى انتباهك الآن.", "Nothing needs your attention now.")}
      </p>
    );
  }
  return (
    <ul aria-label={tr("ما يحتاج إلى انتباه", "Needs attention")} className={cn("flex flex-col divide-y divide-line", className)}>
      {items.map((a) => {
        const w = words(a, tr, num, pct);
        const Icon = ICON[a.key];
        return (
          <li key={a.key} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-card-2">
            <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", a.level === "high" ? "bg-danger-soft text-danger" : "bg-chip text-muted")}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <Link href={a.href} className="min-w-0 flex-1 text-sm after:absolute after:inset-0">
              {w.text}
            </Link>
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-accent">
              {w.fix}
              <Chevron size={14} aria-hidden="true" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Needs attention" at the top of /admin: it loads what it needs by itself (users, teams, health). */
export function AdminAttention() {
  const { tr } = useFmt();
  const load = useLoad(() => Promise.all([adminApi.users(), adminApi.teams(), adminApi.health()]));
  const items = useMemo(() => (load.data ? needsAttention({ users: load.data[0], teams: load.data[1], health: load.data[2], now: new Date() }) : null), [load.data]);
  if (load.state.status === "loading") {
    return (
      <LoadingBlock>
        <Skeleton className="h-12 rounded-2xl" />
      </LoadingBlock>
    );
  }
  // A failed load here says nothing: the rest of the page shows the error.
  if (!items) return null;
  return (
    <section aria-labelledby="attention-title" className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-card-2 px-4 py-2">
        <h2 id="attention-title" className="text-sm font-semibold">
          {tr("يحتاج إلى انتباه", "Needs attention")}
        </h2>
        <Link href="/admin/health" className="text-xs font-medium text-accent underline-offset-4 hover:underline">
          {tr("صحة النظام", "System health")}
        </Link>
      </div>
      <AttentionRows items={items} />
    </section>
  );
}
