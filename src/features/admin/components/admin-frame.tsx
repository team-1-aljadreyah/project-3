import { Activity, FileUp, History, LayoutDashboard, Network, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { adminApi } from "../api";
import { canAdminister } from "../rules";
import { structureOf, structureProblems } from "../structure";

type Key = "overview" | "teams" | "structure" | "import" | "security" | "audit" | "health" | "settings";

interface Item {
  key: Key;
  href: string;
  icon: LucideIcon;
  ar: string;
  en: string;
}

/** The administration's parts, in three groups (the side menu on a computer, one row of links on a phone). */
const GROUPS: { ar: string; en: string; items: Item[] }[] = [
  {
    ar: "الحسابات والفرق",
    en: "Accounts and teams",
    items: [
      { key: "overview", href: "/admin", icon: LayoutDashboard, ar: "نظرة عامة والمستخدمون", en: "Overview and users" },
      { key: "teams", href: "/admin?tab=teams", icon: Users, ar: "الفرق", en: "Teams" },
      { key: "structure", href: "/admin/structure", icon: Network, ar: "الهيكل التنظيمي", en: "Structure" },
      { key: "import", href: "/admin/import", icon: FileUp, ar: "استيراد حسابات", en: "Import accounts" },
    ],
  },
  {
    ar: "الأمان",
    en: "Security",
    items: [
      { key: "security", href: "/admin/security", icon: ShieldCheck, ar: "الجلسات والأمان", en: "Sessions and security" },
      { key: "audit", href: "/audit", icon: History, ar: "سجل العمليات", en: "Audit log" },
    ],
  },
  {
    ar: "النظام",
    en: "System",
    items: [
      { key: "health", href: "/admin/health", icon: Activity, ar: "صحة النظام", en: "System health" },
      { key: "settings", href: "/admin?tab=settings", icon: Settings, ar: "الإعدادات", en: "Settings" },
    ],
  },
];

/** Which part the address is on. */
function activeKey(path: string, tab: string | null): Key | undefined {
  if (path === "/admin") return tab === "teams" ? "teams" : tab === "settings" ? "settings" : "overview";
  return GROUPS.flatMap((g) => g.items).find((i) => i.href !== "/admin" && !i.href.includes("?") && path.startsWith(i.href))?.key;
}

/**
 * The frame of every administration page (/admin and /admin/*): a side menu of its parts on a computer, a row of links
 * on a phone, with a small count where something waits (locked accounts, structure problems). Anyone else gets the page
 * alone (it says it is not for them).
 */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const me = useUser();
  if (!canAdminister(me)) return <>{children}</>;
  return <Framed>{children}</Framed>;
}

function Framed({ children }: { children: React.ReactNode }) {
  const { tr, num } = useFmt();
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const active = activeKey(path, tab);
  const load = useLoad(() => Promise.all([adminApi.users(), adminApi.teams()]));
  const counts = useMemo(() => {
    if (!load.data) return {} as Partial<Record<Key, number>>;
    const [users, teams] = load.data;
    const now = new Date().toISOString();
    return {
      security: users.filter((u) => u.locked_until && u.locked_until > now).length,
      structure: structureProblems(structureOf(users, teams)),
    } as Partial<Record<Key, number>>;
  }, [load.data]);

  const badge = (key: Key, className?: string) => {
    const n = counts[key];
    if (!n) return null;
    const words = key === "security" ? tr(`${num(n)} حساب مقفل`, `${n} locked`) : tr(`${num(n)} بحاجة إلى إصلاح`, `${n} to fix`);
    return (
      <span className={cn("num ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold", key === "security" ? "bg-danger text-card" : "bg-chip text-text", className)}>
        <span aria-hidden="true">{num(n)}</span>
        <span className="sr-only">{words}</span>
      </span>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-7">
      <nav aria-label={tr("أقسام إدارة النظام", "Administration sections")} className="shrink-0 print:hidden lg:sticky lg:top-24 lg:w-60">
        {/* A phone: one row of links that scrolls sideways. */}
        <ul className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:hidden">
          {GROUPS.flatMap((g) => g.items).map((i) => (
            <li key={i.key} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active === i.key ? "page" : undefined}
                className={cn(
                  // relative: the badge's hidden words stay inside the scrolling row (else they widen the whole page on a phone).
                  "relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] whitespace-nowrap",
                  active === i.key ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-card text-muted hover:text-text",
                )}
              >
                <i.icon size={15} aria-hidden="true" />
                {tr(i.ar, i.en)}
                {badge(i.key, "ms-1")}
              </Link>
            </li>
          ))}
        </ul>
        {/* A computer: the side menu in its three groups. */}
        <div className="hidden flex-col gap-4 rounded-2xl border border-line bg-card p-2.5 lg:flex">
          <p className="px-2.5 pt-1.5 text-sm font-semibold">{tr("إدارة النظام", "Administration")}</p>
          {GROUPS.map((g) => (
            <div key={g.en} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{tr(g.ar, g.en)}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      aria-current={active === i.key ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                        active === i.key
                          ? "bg-accent-soft font-semibold text-accent-ink before:absolute before:inset-y-1.5 before:start-0 before:w-0.75 before:rounded-full before:bg-accent"
                          : "text-muted hover:bg-card-2 hover:text-text",
                      )}
                    >
                      <i.icon size={16} aria-hidden="true" className="shrink-0" />
                      <span className="min-w-0 truncate">{tr(i.ar, i.en)}</span>
                      {badge(i.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
