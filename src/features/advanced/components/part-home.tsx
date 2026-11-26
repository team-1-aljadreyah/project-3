// The home of the advanced settings: a greeting, the health of the work and the accounts (from the data the platform
// already has), the settings counts, and a "Needs a look" list where each line opens what it is about.
import { arN, W } from "@/shared/lib/count-words";
import { AlertTriangle, ArrowLeft, Bug, CalendarClock, CheckCircle2, FolderKanban, Megaphone, Settings2, ToggleRight, UserX } from "lucide-react";
import Link from "next/link";
import { adminApi } from "@/features/admin";
import { bugsApi, isOpen } from "@/features/bugs";
import { reportsApi } from "@/features/reports";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today } from "@/shared/lib/utils";
import { ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { changedCount, FEATURES, workDaysBetween } from "../rules";
import type { AdvancedRules } from "../types";
import { firstName, partHref } from "./part-links";

/** A ring filled to `ratio` (0–1), with the number in the middle. */
function Ring({ ratio, label, tone }: { ratio: number; label: string; tone: "good" | "mid" | "bad" }) {
  const r = 34;
  const len = 2 * Math.PI * r;
  const color = tone === "good" ? "var(--st-done-ink)" : tone === "mid" ? "var(--st-review-ink)" : "var(--st-blocked-ink)";
  return (
    <svg viewBox="0 0 84 84" className="size-24 shrink-0" role="img" aria-label={label}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--chip)" strokeWidth="9" />
      <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * Math.max(0, Math.min(1, ratio))} ${len}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" className="num fill-(--text) text-[17px] font-semibold">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  );
}

/** A labelled bar: how many of how many. */
function Bar({ label, n, of, danger }: { label: string; n: number; of: number; danger?: boolean }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2 text-[13px]">
        <span className="text-muted">{label}</span>
        <b className={cn("num font-semibold", danger && n > 0 && "text-danger")}>{n}</b>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-chip">
        <span className={cn("block h-full rounded-full", danger && n > 0 ? "bg-(--st-blocked-ink)" : "bg-accent")} style={{ width: `${of ? Math.max(n ? 6 : 0, (n / of) * 100) : 0}%` }} />
      </span>
    </li>
  );
}

/** One health card: a title, a warning mark when something needs a look, the picture, a sentence and a link. */
function HealthCard({ title, sub, warn, children, note, href, linkText }: { title: string; sub: string; warn?: boolean; children: React.ReactNode; note: string; href: string; linkText: string }) {
  const { tr } = useFmt();
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted">{sub}</p>
        </div>
        {warn ? (
          <span className="rounded-lg bg-(--st-review) p-1.5 text-(--st-review-ink)" title={tr("يحتاج إلى مراجعة", "Needs a look")}>
            <AlertTriangle size={15} aria-label={tr("يحتاج إلى مراجعة", "Needs a look")} />
          </span>
        ) : (
          <span className="rounded-lg bg-(--st-done) p-1.5 text-(--st-done-ink)" title={tr("سليم", "Fine")}>
            <CheckCircle2 size={15} aria-label={tr("سليم", "Fine")} />
          </span>
        )}
      </header>
      <div className="flex-1">{children}</div>
      <p className="text-[13px] leading-relaxed text-muted">{note}</p>
      <Link href={href} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium hover:border-accent hover:text-accent">
        {linkText}
        <ArrowLeft size={14} aria-hidden="true" className="ltr:rotate-180" />
      </Link>
    </article>
  );
}

/** A count card that opens its part (click anywhere). */
function CountCard({ href, icon, label, value, note, warn }: { href: string; icon: React.ReactNode; label: string; value: React.ReactNode; note: string; warn?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col gap-1 rounded-2xl border border-line bg-card px-5 py-4 shadow-card transition-colors hover:border-accent">
      <span className="flex items-center gap-2 text-[13px] text-muted">
        {icon}
        {label}
      </span>
      <span className={cn("num text-3xl font-semibold", warn && "text-accent")}>{value}</span>
      <span className="text-xs text-muted">{note}</span>
    </Link>
  );
}

export function HomePart({ saved }: { saved: AdvancedRules }) {
  const { tr, lang, num } = useFmt();
  const me = useUser();
  const load = useLoad(() => Promise.all([reportsApi.overview(), bugsApi.bugs(), adminApi.users()]));
  const name = lang === "en" && me.name_en ? me.name_en : me.name;
  const changed = changedCount(saved);
  const off = FEATURES.filter((f) => !saved.features[f.key]);

  const head = (
    <div className="flex flex-col items-center gap-1 py-2 text-center">
      <h2 className="text-2xl font-semibold">{tr(`أهلاً، ${firstName(name)}`, `Welcome, ${firstName(name)}`)}</h2>
      <p className="max-w-xl text-sm text-muted">{tr("من هنا تضبط قواعد الشركة كلها بنفسك: الدوام، والصلاحيات، والإشعارات، والميزات. يصل كل تغيير إلى الجميع فور حفظه.", "From here you set every company rule yourself: working time, rights, notifications and features. Each change reaches everyone as soon as you save it.")}</p>
    </div>
  );

  const counts = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <CountCard href={partHref("history")} icon={<Settings2 size={15} aria-hidden="true" />} label={tr("إعدادات معدَّلة", "Changed settings")} value={num(changed)} note={tr("عن الافتراضي · السجل والملف", "From the defaults · history and file")} warn={changed > 0} />
      <CountCard href={partHref("features")} icon={<ToggleRight size={15} aria-hidden="true" />} label={tr("ميزات متوقفة", "Features off")} value={num(off.length)} note={tr(`من ${FEATURES.length} ميزات`, `Of ${FEATURES.length} features`)} warn={off.length > 0} />
      <CountCard href={partHref("announce")} icon={<Megaphone size={15} aria-hidden="true" />} label={tr("الإعلان", "Banner")} value={saved.banner ? tr("ظاهر", "On") : tr("لا", "None")} note={tr("أعلى كل الصفحات", "On top of every page")} warn={!!saved.banner} />
      <CountCard href={partHref("announce")} icon={<CalendarClock size={15} aria-hidden="true" />} label={tr("وضع القراءة فقط", "Read-only mode")} value={saved.read_only.on ? tr("مفعّل", "On") : tr("متوقف", "Off")} note={tr("للجميع غيرك", "For everyone but you")} warn={saved.read_only.on} />
    </div>
  );

  if (load.state.status === "loading") {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <LoadingBlock className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </LoadingBlock>
        {counts}
      </div>
    );
  }
  if (load.state.status === "error") {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <ErrorBox error={load.state.error} onRetry={load.reload} />
        {counts}
      </div>
    );
  }

  const [overview, bugs, users] = load.state.data;
  const day = today();
  const projects = overview.projects;
  const total = projects.reduce((s, p) => s + p.total, 0);
  const done = projects.reduce((s, p) => s + p.done, 0);
  const late = projects.reduce((s, p) => s + p.late, 0);
  const open = total - done;
  const onTime = open ? (open - late) / open : 1;
  const pastEnd = projects.filter((p) => p.overdue);
  const behind = projects.filter((p) => p.behind && !p.overdue);
  const openBugs = bugs.filter(isOpen);
  const overTarget = openBugs.filter((b) => workDaysBetween(saved, b.created_at.slice(0, 10), day) > saved.fix_days[b.severity]);
  const critical = openBugs.filter((b) => b.severity === "critical");
  const active = users.filter((u) => u.active);
  const never = active.filter((u) => !u.last_login_at && u.id !== me.id);
  const stopped = users.filter((u) => !u.active);
  const locked = users.filter((u) => u.locked_until && u.locked_until > new Date().toISOString());
  const pName = (p: { name: string; name_en?: string }) => (lang === "en" && p.name_en ? p.name_en : p.name);

  const looks: { key: string; href: string; text: string; warn?: boolean }[] = [
    ...pastEnd.map((p) => ({ key: `p${p.id}`, href: `/projects/${p.id}`, text: tr(`«${pName(p)}» تجاوز موعد نهايته ولم يكتمل`, `"${pName(p)}" is past its end date and not done`), warn: true })),
    ...overTarget.slice(0, 5).map((b) => ({ key: `b${b.id}`, href: `/bugs/${b.id}`, text: tr(`${b.code} مفتوحة أكثر من مهلة إصلاحها (${saved.fix_days[b.severity]} يوم عمل)`, `${b.code} is open past its fix target (${saved.fix_days[b.severity]} work days)`), warn: true })),
    ...(never.length ? [{ key: "never", href: "/admin", text: tr(`حسابات لم يدخل أصحابها المنصة بعد: ${never.length}`, `${never.length} accounts have never signed in`) }] : []),
    ...(locked.length ? [{ key: "locked", href: "/admin", text: tr(`حسابات مقفلة الآن بعد محاولات خاطئة: ${locked.length}`, `${locked.length} accounts are locked after wrong passwords`), warn: true }] : []),
    ...(saved.read_only.on ? [{ key: "ro", href: partHref("announce"), text: tr("وضع القراءة فقط مفعّل: لا أحد غيرك يستطيع التعديل", "Read-only mode is on: nobody but you can change anything"), warn: true }] : []),
    ...off.map((f) => ({ key: `f${f.key}`, href: partHref("features"), text: tr(`ميزة «${f.ar}» متوقفة`, `"${f.en}" is off`) })),
  ];
  const warnings = [late > 0, pastEnd.length > 0, overTarget.length > 0, never.length + locked.length > 0].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      {head}
      <section aria-labelledby="adv-health" className="flex flex-col gap-3">
        <h2 id="adv-health" className="text-lg font-semibold">
          {tr("صحة العمل والحسابات", "Work and accounts health")}
        </h2>
        {warnings > 0 && (
          <p className="rounded-xl border-s-4 border-(--st-review-ink) bg-card px-4 py-2.5 text-[13px]">
            <b>{tr("تنبيه:", "Heads-up:")}</b> {tr(`${warnings} من 4 مؤشرات تحتاج إلى مراجعة.`, `${warnings} of 4 signs need a look.`)}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            title={tr("المهام في موعدها", "Tasks on time")}
            sub={tr("المهام المفتوحة في كل المشاريع", "Open tasks in every project")}
            warn={late > 0}
            note={tr(`${num(late)} متأخرة من ${num(open)} مفتوحة`, `${num(late)} late of ${num(open)} open`)}
            href="/reports"
            linkText={tr("التقارير", "Reports")}
          >
            <div className="flex justify-center">
              <Ring ratio={onTime} tone={onTime >= 0.85 ? "good" : onTime >= 0.6 ? "mid" : "bad"} label={tr(`${Math.round(onTime * 100)}% من المهام المفتوحة في موعدها`, `${Math.round(onTime * 100)}% of open tasks on time`)} />
            </div>
          </HealthCard>
          <HealthCard
            title={tr("المشاريع", "Projects")}
            sub={tr(`${arN(projects.length, W.project)}`, `${num(projects.length)} projects`)}
            warn={pastEnd.length > 0}
            note={pastEnd.length ? tr(`${num(pastEnd.length)} تجاوز موعد نهايته`, `${num(pastEnd.length)} past the end date`) : tr("لا مشروع تجاوز موعد نهايته", "No project is past its end date")}
            href="/"
            linkText={tr("المشاريع", "Projects")}
          >
            <ul className="flex flex-col gap-3">
              <Bar label={tr("نشطة", "Active")} n={projects.filter((p) => p.state === "active").length} of={projects.length} />
              <Bar label={tr("متأخرة عن خطتها", "Behind the plan")} n={behind.length} of={projects.length} danger />
              <Bar label={tr("تجاوزت موعد نهايتها", "Past the end date")} n={pastEnd.length} of={projects.length} danger />
            </ul>
          </HealthCard>
          <HealthCard
            title={tr("الأخطاء البرمجية", "Bugs")}
            sub={tr(`${num(openBugs.length)} مفتوحة`, `${num(openBugs.length)} open`)}
            warn={overTarget.length > 0}
            note={tr(`${num(overTarget.length)} تجاوزت مهلة إصلاحها بأيام العمل`, `${num(overTarget.length)} past their fix target in work days`)}
            href="/bugs"
            linkText={tr("المشكلات", "Bugs")}
          >
            <ul className="flex flex-col gap-3">
              <Bar label={tr("مفتوحة", "Open")} n={openBugs.length} of={bugs.length} />
              <Bar label={tr("حرجة مفتوحة", "Critical, open")} n={critical.length} of={Math.max(openBugs.length, 1)} danger />
              <Bar label={tr("تجاوزت المهلة", "Past the target")} n={overTarget.length} of={Math.max(openBugs.length, 1)} danger />
            </ul>
          </HealthCard>
          <HealthCard
            title={tr("الحسابات", "Accounts")}
            sub={tr(`الحسابات النشطة: ${num(active.length)}`, `${num(active.length)} active`)}
            warn={never.length + locked.length > 0}
            note={tr("أوقف الحسابات التي لا تُستعمل، وتابع من لم يدخل بعد.", "Stop accounts nobody uses, and follow up on people who never signed in.")}
            href="/admin"
            linkText={tr("إدارة النظام", "Administration")}
          >
            <ul className="flex flex-col gap-3">
              <Bar label={tr("لم يدخلوا أبداً", "Never signed in")} n={never.length} of={active.length} danger />
              <Bar label={tr("مقفلة الآن", "Locked now")} n={locked.length} of={active.length} danger />
              <Bar label={tr("موقوفة", "Stopped")} n={stopped.length} of={users.length} />
            </ul>
          </HealthCard>
        </div>
      </section>

      {counts}

      <section aria-labelledby="adv-look" className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 id="adv-look" className="mb-3 text-lg font-semibold">
          {tr("يحتاج إلى مراجعة", "Needs a look")}
        </h2>
        {looks.length ? (
          <ul className="flex flex-col gap-2">
            {looks.map((l) => (
              <li key={l.key}>
                {/* The whole line opens what it is about. */}
                <Link href={l.href} className="flex items-center gap-3 rounded-xl bg-card-2 px-4 py-3 text-sm transition-colors hover:bg-chip/60">
                  {l.key.startsWith("b") ? (
                    <Bug size={16} aria-hidden="true" className="shrink-0 text-danger" />
                  ) : l.key.startsWith("p") ? (
                    <FolderKanban size={16} aria-hidden="true" className="shrink-0 text-danger" />
                  ) : l.key === "never" || l.key === "locked" ? (
                    <UserX size={16} aria-hidden="true" className={cn("shrink-0", l.warn ? "text-danger" : "text-muted")} />
                  ) : (
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", l.warn ? "bg-danger" : "bg-line-strong")} />
                  )}
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <ArrowLeft size={15} aria-hidden="true" className="shrink-0 text-faint ltr:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-card-2 px-4 py-3 text-sm text-muted">{tr("كل شيء مرتب.", "Everything is in order.")}</p>
        )}
      </section>
    </div>
  );
}
