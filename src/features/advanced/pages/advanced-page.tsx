// The CEO's advanced settings (/advanced): every company rule in one place, like Project 2's "Setup". A tree of parts
// on the side with a quick find (it finds a part by the names of the settings inside it too), the chosen part on the
// other side (?s=work in the address), and ONE draft for all parts with a bar at the bottom to save or undo it.
// On a phone the tree is a short list to choose from, so the part itself is on the first screen.
import { AlertTriangle, BellRing, CalendarDays, ChevronDown, FileClock, Hash, Home, KeyRound, ListChecks, Megaphone, Save, Search, ScrollText, ToggleRight, UserCheck, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, matches } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, errorText, LoadingBlock, Select, Skeleton, useToast } from "@/shared/ui";
import { advancedApi } from "../api";
import type { Ctx } from "../components/controls";
import { AnnouncePart } from "../components/part-announce";
import { HistoryPart } from "../components/part-history";
import { HomePart } from "../components/part-home";
import { PART_KEYS, partHref, partOf, type PartKey } from "../components/part-links";
import { RolesPart } from "../components/part-roles";
import { NotifyPart, PermissionsPart } from "../components/parts-tables";
import { FeaturesPart, NamesPart, SecurityPart, TasksPart, WorkPart } from "../components/parts-rules";
import { canUseAdvancedSettings, changedRules, checkRules, diffRules, PART_WORDS } from "../rules";
import type { AdvancedData, AdvancedRules } from "../types";

interface Leaf {
  key: PartKey | "admin" | "audit";
  ar: string;
  en: string;
  icon: typeof Home;
  /** Another page of the platform, instead of a part of this one. */
  href?: string;
}

const TREE: { ar: string; en: string; leaves: Leaf[] }[] = [
  { ar: "", en: "", leaves: [{ key: "home", ar: "الرئيسية", en: "Home", icon: Home }] },
  {
    ar: "قواعد العمل",
    en: "Business rules",
    leaves: [
      { key: "work", ar: "الدوام والعطل والمواعيد", en: "Working time and due dates", icon: CalendarDays },
      { key: "tasks", ar: "المهام والاعتماد", en: "Tasks and approvals", icon: ListChecks },
    ],
  },
  {
    ar: "الصلاحيات والإشعارات",
    en: "Rights and notifications",
    leaves: [
      { key: "permissions", ar: "من يحق له ماذا", en: "Who may do what", icon: UserCheck },
      { key: "roles", ar: "الوظائف والأدوار", en: "Jobs and roles", icon: UserCog },
      { key: "notify", ar: "من يصله كل إشعار", en: "Who gets which notification", icon: BellRing },
    ],
  },
  {
    ar: "أدوات المدير التنفيذي",
    en: "The CEO's tools",
    leaves: [
      { key: "features", ar: "تشغيل الميزات وإيقافها", en: "Feature switches", icon: ToggleRight },
      { key: "security", ar: "الدخول والأمان", en: "Sign-in and security", icon: KeyRound },
      { key: "names", ar: "الرموز والأرقام", en: "Codes and numbers", icon: Hash },
      { key: "announce", ar: "الإعلان ووضع القراءة", en: "Banner and read-only", icon: Megaphone },
      { key: "history", ar: "السجل والملف والافتراضي", en: "History, file, defaults", icon: FileClock },
    ],
  },
  {
    ar: "المنصة",
    en: "Platform",
    leaves: [
      { key: "admin", ar: "الحسابات والفرق", en: "Accounts and teams", icon: Users, href: "/admin" },
      { key: "audit", ar: "سجل العمليات", en: "Audit log", icon: ScrollText, href: "/audit" },
    ],
  },
];

const PART_NAME = Object.fromEntries(TREE.flatMap((g) => g.leaves).map((l) => [l.key, l])) as Record<PartKey, Leaf>;

export function AdvancedPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الإعدادات المتقدمة", "Advanced settings"));
  const me = useUser();
  if (!canUseAdvancedSettings(me)) return <Empty title={tr("الإعدادات المتقدمة للمدير التنفيذي وحده", "The advanced settings are for the CEO only")} />;
  // The part comes from the address (?s=), which Next.js reads inside <Suspense>.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Setup />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <LoadingBlock className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Skeleton className="h-12 lg:h-[34rem]" />
      <Skeleton className="h-[34rem]" />
    </LoadingBlock>
  );
}

function Setup() {
  const { tr } = useFmt();
  const toast = useToast();
  const router = useRouter();
  const asked = useSearchParams().get("s") ?? "home";
  const part: PartKey = (PART_KEYS as string[]).includes(asked) ? (asked as PartKey) : "home";
  const load = useLoad(() => advancedApi.get());
  // The answer of the last save, shown until the page has loaded it again (no flash of the old values).
  const [fresh, setFresh] = useState<AdvancedData | null>(null);
  const [draft, setDraft] = useState<AdvancedRules | null>(null);
  const [serverErr, setServerErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const data = fresh && (!load.data || (fresh.updated_at ?? "") > (load.data.updated_at ?? "")) ? fresh : load.data;

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <Title />
        {load.state.status === "error" ? <ErrorBox error={load.state.error} onRetry={load.reload} /> : <PageSkeleton />}
      </div>
    );
  }

  const saved = data.rules;
  const r = draft ?? saved;
  const problems = checkRules(r);
  const errors: Record<string, string> = { ...Object.fromEntries(Object.entries(problems).map(([k, v]) => [k, tr(v.ar, v.en)])), ...serverErr };
  const pending = draft ? diffRules(saved, draft) : [];
  const dirty = pending.length > 0;
  const pendingParts = new Set(pending.map((p) => partOf(p.key)));
  const errorParts = [...new Set(Object.keys(errors).map(partOf))];

  const set = (patch: Partial<AdvancedRules>) => {
    setDraft({ ...r, ...patch });
    setServerErr({});
  };

  async function save() {
    setBusy(true);
    try {
      const answer = await advancedApi.save(changedRules(r));
      setFresh(answer);
      setDraft(null);
      toast(tr("حُفظت الإعدادات، وتسري على الجميع الآن.", "Saved. It applies to everyone now."));
    } catch (e) {
      if (e instanceof ApiError && e.errors) setServerErr(e.errors);
      toast(errorText(e, tr), "danger");
    } finally {
      setBusy(false);
    }
  }

  const c: Ctx = { r, set, errors, tr };
  const body =
    part === "work" ? <WorkPart {...c} /> :
    part === "tasks" ? <TasksPart {...c} /> :
    part === "permissions" ? <PermissionsPart {...c} /> :
    part === "roles" ? <RolesPart {...c} /> :
    part === "notify" ? <NotifyPart {...c} /> :
    part === "features" ? <FeaturesPart {...c} /> :
    part === "security" ? <SecurityPart {...c} /> :
    part === "names" ? <NamesPart {...c} /> :
    part === "announce" ? <AnnouncePart {...c} /> :
    part === "history" ? <HistoryPart saved={saved} dirty={dirty} /> :
    <HomePart saved={saved} />;

  const match = (l: Leaf) => !q.trim() || matches(q, l.ar, l.en, PART_WORDS[l.key]);
  const leafName = (l: Leaf) => tr(l.ar, l.en);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-28">
      <Title />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Phone and tablet: a short list to choose the part from, so the part is on the first screen. */}
        <div className="flex flex-col gap-2 lg:hidden">
          <label htmlFor="adv-part" className="text-sm font-medium">
            {tr("القسم", "Section")}
          </label>
          <Select id="adv-part" value={part} onChange={(e) => router.push(partHref(e.target.value as PartKey))}>
            {TREE.map((g, i) => {
              const leaves = g.leaves.filter((l) => !l.href);
              if (!leaves.length) return null;
              const options = leaves.map((l) => (
                <option key={l.key} value={l.key}>
                  {leafName(l)}
                  {pendingParts.has(l.key as PartKey) ? ` (${tr("غير محفوظ", "unsaved")})` : ""}
                </option>
              ));
              return g.ar ? (
                <optgroup key={i} label={tr(g.ar, g.en)}>
                  {options}
                </optgroup>
              ) : (
                options
              );
            })}
          </Select>
          <div className="flex flex-wrap gap-2">
            {TREE.flatMap((g) => g.leaves)
              .filter((l) => l.href)
              .map((l) => (
                <Link key={l.key} href={l.href!} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] text-muted hover:border-accent hover:text-accent">
                  <l.icon size={14} aria-hidden="true" />
                  {leafName(l)}
                </Link>
              ))}
          </div>
        </div>

        {/* Computer: the tree, in a card that stays in view. */}
        <aside className="hidden h-fit rounded-2xl border border-line bg-card p-3 shadow-card lg:sticky lg:top-24 lg:block">
          <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-line bg-card-2 px-3 focus-within:border-accent">
            <Search size={15} aria-hidden="true" className="text-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("بحث سريع", "Quick find")} aria-label={tr("بحث سريع في الإعدادات", "Quick find in the settings")} className="w-full bg-transparent text-sm outline-none placeholder:text-faint" />
          </label>
          <nav aria-label={tr("أقسام الإعدادات المتقدمة", "Advanced settings sections")} className="flex flex-col gap-3">
            {TREE.map((g, i) => {
              const leaves = g.leaves.filter(match);
              if (!leaves.length) return null;
              return (
                <div key={i}>
                  {g.ar && (
                    <p className="flex items-center gap-1 px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">
                      <ChevronDown size={12} aria-hidden="true" />
                      {tr(g.ar, g.en)}
                    </p>
                  )}
                  <ul>
                    {leaves.map((l) => {
                      const active = !l.href && l.key === part;
                      return (
                        <li key={l.key}>
                          <Link
                            href={l.href ?? partHref(l.key as PartKey)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                              active ? "bg-accent-soft font-semibold text-accent-ink" : "text-muted hover:bg-card-2 hover:text-text",
                            )}
                          >
                            <l.icon size={16} aria-hidden="true" className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{leafName(l)}</span>
                            {pendingParts.has(l.key as PartKey) && (
                              <span className="size-2 shrink-0 rounded-full bg-accent" title={tr("تغييرات غير محفوظة", "Unsaved changes")}>
                                <span className="sr-only">{tr("(غير محفوظ)", "(unsaved)")}</span>
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {!TREE.some((g) => g.leaves.some(match)) && <p className="px-2 py-3 text-center text-[13px] text-muted">{tr("لا قسم بهذا الاسم", "No section by that name")}</p>}
          </nav>
        </aside>

        <div className="min-w-0">{body}</div>
      </div>

      {/* The bar goes straight into <body>: the frame's settle-in effect would otherwise hold it inside the page. */}
      {dirty && typeof document !== "undefined" && createPortal(
        <div role="region" aria-label={tr("حفظ التغييرات", "Save the changes")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]shadow-[0_-6px_24px_rgb(0_0_0/0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2">
            <div className="me-auto flex min-w-0 items-center gap-2 text-sm font-semibold">
              {errorParts.length ? <AlertTriangle size={17} aria-hidden="true" className="shrink-0 text-danger" /> : <Save size={17} aria-hidden="true" className="shrink-0 text-accent" />}
              {errorParts.length ? (
                <span>
                  {tr("صحّح الحقول المعلَّمة بالأحمر قبل الحفظ", "Fix the fields marked in red before saving")}
                  <span className="font-normal text-muted">
                    {" "}
                    {tr("في: ", "in: ")}
                    {errorParts.map((p, i) => (
                      <span key={p}>
                        {i > 0 && tr("، ", ", ")}
                        <Link href={partHref(p)} className="text-danger underline underline-offset-2">
                          {leafName(PART_NAME[p])}
                        </Link>
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                <span>
                  {tr("لديك تغييرات غير محفوظة", "You have unsaved changes")} <span className="num font-normal text-muted">({pending.length})</span>
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setServerErr({});
              }}
            >
              {tr("تراجع", "Undo")}
            </Button>
            <Button onClick={save} disabled={busy || errorParts.length > 0}>
              <Save size={16} aria-hidden="true" />
              {tr("حفظ", "Save")}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Title() {
  const { tr } = useFmt();
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{tr("الإعدادات المتقدمة", "Advanced settings")}</h1>
      <p className="text-sm text-muted">{tr("قواعد العمل والصلاحيات والإشعارات والميزات، بيدك دون الحاجة إلى مبرمج", "Business rules, rights, notifications and features, in your hands, no developer needed")}</p>
    </header>
  );
}
