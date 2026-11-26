import { CircleAlert, CircleCheck, Clock, Globe, Server, Tag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { API_URL, USE_MOCK } from "@/shared/lib/config";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Empty, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { AttentionRows } from "../components/attention-list";
import { Panel } from "../components/panel";
import { bytesText, needsAttention, STORAGE_WARN, storageParts, storageUsed } from "../health";
import { canAdminister } from "../rules";
import type { DataHealth } from "../types";

/** The front end's own version, written in when it is built (next.config.ts, from package.json). */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "-";

const PART_WORDS = {
  attachments: { ar: "مرفقات المهام والمشاريع والأخطاء والمحادثات", en: "Attachments (tasks, projects, bugs, chat)", dot: "bg-accent" },
  pictures: { ar: "الصور الشخصية", en: "Profile pictures", dot: "bg-(--st-testing-ink)" },
  voice: { ar: "الرسائل الصوتية", en: "Voice messages", dot: "bg-(--st-review-ink)" },
  audit: { ar: "سجل العمليات", en: "Audit log", dot: "bg-(--st-todo-ink)" },
} as const;

/**
 * System health (/admin/health): what needs attention (each line opens the page that fixes it), the data's size, the
 * storage by kind against the quota, the last backup as the server reports it, and which version talks to which API.
 */
export function HealthPage() {
  const { tr } = useFmt();
  usePageTitle(tr("صحة النظام", "System health"));
  const me = useUser();
  const allowed = canAdminister(me);
  const load = useLoad(() => (allowed ? Promise.all([adminApi.health(), adminApi.users(), adminApi.teams()]) : Promise.resolve(null)), [allowed]);
  const items = useMemo(() => (load.data ? needsAttention({ health: load.data[0], users: load.data[1], teams: load.data[2], now: new Date() }) : []), [load.data]);

  if (!allowed) return <Empty title={tr("هذه الصفحة لمسؤول النظام والمدير التنفيذي", "This page is for the system admin and the CEO")} />;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("صحة النظام", "System health")}</h1>
        <p className="text-sm text-muted">{tr("حجم البيانات والمساحة والنسخ الاحتياطي، وما يحتاج إلى انتباه.", "The data's size, storage and backups, and what needs attention.")}</p>
      </header>
      {load.state.status === "loading" ? (
        <LoadingBlock className="flex flex-col gap-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </LoadingBlock>
      ) : load.state.status === "error" ? (
        <ErrorBox error={load.state.error} onRetry={load.reload} />
      ) : load.data ? (
        <>
          <Panel id="attention" title={items.length ? tr(`يحتاج إلى انتباه (${items.length})`, `Needs attention (${items.length})`) : tr("يحتاج إلى انتباه", "Needs attention")}>
            <AttentionRows items={items} />
          </Panel>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            <StoragePanel health={load.data[0]} />
            <div className="flex flex-col gap-5">
              <BackupPanel health={load.data[0]} />
              <AboutPanel health={load.data[0]} />
            </div>
          </div>
          <DataPanel health={load.data[0]} />
        </>
      ) : null}
    </div>
  );
}

function StoragePanel({ health }: { health: DataHealth }) {
  const { tr, num, pct } = useFmt();
  const used = storageUsed(health);
  const quota = health.storage_quota_bytes;
  const share = quota ? used / quota : undefined;
  const parts = storageParts(health);
  const over = share !== undefined && share > STORAGE_WARN;
  return (
    <Panel id="storage" title={tr("المساحة", "Storage")} note={health.storage ? tr("كما يحسبها الخادم، حسب نوع الملفات.", "As the server counts it, by kind of file.") : tr("الخادم لا يرسل التفاصيل بعد: هذا مجموع الملفات.", "The server doesn't send the details yet: this is the files' total.")}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span dir="ltr" className={cn("num text-3xl font-semibold", over && "text-danger")}>
              {bytesText(used)}
            </span>
            {quota && (
              <span className="text-sm text-muted">
                {tr("من", "of")} <span dir="ltr">{bytesText(quota)}</span>
              </span>
            )}
          </span>
          {share !== undefined && (
            <span className={cn("text-sm font-medium", over ? "text-danger" : "text-muted")}>
              {over && <CircleAlert size={14} aria-hidden="true" className="me-1 inline" />}
              {/* The percent keeps its sign after the number in Arabic too. */}
              {tr("مستعمل", "Used")} {share > 0 && share < 0.01 && tr("أقل من", "under")} <span dir="ltr">{share > 0 && share < 0.01 ? "1%" : pct(share)}</span>
            </span>
          )}
        </div>
        {/* One bar: each kind its colour, the rest of the quota empty; the 80% line marks where it needs attention. */}
        <div className="relative">
          <div
            role="img"
            aria-label={tr(
              `المساحة المستعملة: ${parts.map((p) => `${PART_WORDS[p.key].ar} ${bytesText(p.bytes)}`).join("، ")}`,
              `Storage used: ${parts.map((p) => `${PART_WORDS[p.key].en} ${bytesText(p.bytes)}`).join(", ")}`,
            )}
            className="flex h-3 overflow-hidden rounded-full bg-chip"
          >
            {parts.map((p) => (p.bytes > 0 ? <span key={p.key} className={cn("h-full", PART_WORDS[p.key].dot)} style={{ width: `${Math.max(0.6, p.share * 100)}%` }} /> : null))}
          </div>
          {quota && <span aria-hidden="true" title="80%" className="absolute -top-1 -bottom-1 w-px bg-danger" style={{ insetInlineStart: `${STORAGE_WARN * 100}%` }} />}
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">{tr("المساحة حسب النوع", "Storage by kind")}</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-1.5 text-start font-medium">
                {tr("النوع", "Kind")}
              </th>
              <th scope="col" className="py-1.5 ps-4 text-end font-medium">
                {tr("الملفات", "Files")}
              </th>
              <th scope="col" className="py-1.5 ps-4 text-end font-medium">
                {tr("الحجم", "Size")}
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.key} className="border-t border-line">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-sm", PART_WORDS[p.key].dot)} />
                    {tr(PART_WORDS[p.key].ar, PART_WORDS[p.key].en)}
                  </span>
                </td>
                <td className="num py-2 ps-4 text-end text-muted">{p.files === undefined ? "—" : num(p.files)}</td>
                <td className="num py-2 ps-4 text-end whitespace-nowrap">
                  <span dir="ltr">{bytesText(p.bytes)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BackupPanel({ health }: { health: DataHealth }) {
  const { tr, dateTime, ago } = useFmt();
  const b = health.backup;
  const ok = b?.status === "ok";
  return (
    <Panel id="backup" title={tr("النسخ الاحتياطي", "Backups")} note={tr("يديره فريق DevOps على الخادم؛ هنا ما يقوله الخادم.", "Run by DevOps on the server; this is what the server reports.")}>
      <div className="flex flex-col gap-2 p-4 text-sm">
        {!b ? (
          <p className="text-muted">{tr("الخادم لا يرسل حالة النسخ الاحتياطي بعد.", "The server doesn't report the backups yet.")}</p>
        ) : (
          <>
            <p className={cn("flex items-center gap-2 font-medium", ok ? "text-success" : b.status === "failed" ? "text-danger" : "text-muted")}>
              {ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
              {b.status === "ok" ? tr("نجحت آخر نسخة", "The last backup succeeded") : b.status === "failed" ? tr("فشلت آخر نسخة", "The last backup failed") : b.status === "running" ? tr("نسخ احتياطي جارٍ الآن", "A backup is running") : tr("الحالة غير معروفة", "Status unknown")}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
              <dt>{tr("الوقت", "When")}</dt>
              <dd className="text-text">{b.at ? <time dateTime={b.at}>{`${dateTime(b.at)} (${ago(b.at)})`}</time> : "-"}</dd>
              {b.size_bytes !== undefined && (
                <>
                  <dt>{tr("الحجم", "Size")}</dt>
                  <dd dir="ltr" className="text-start text-text">
                    {bytesText(b.size_bytes)}
                  </dd>
                </>
              )}
              {b.note && (
                <>
                  <dt>{tr("ملاحظة", "Note")}</dt>
                  <dd dir="auto" className="text-text">
                    {b.note}
                  </dd>
                </>
              )}
            </dl>
            {USE_MOCK && <p className="text-xs text-faint">{tr("في النسخة التجريبية هذه الحالة افتراضية؛ الخادم الحقيقي يرسل حالته.", "In the demo this status is invented; the real server sends its own.")}</p>}
          </>
        )}
      </div>
    </Panel>
  );
}

function AboutPanel({ health }: { health: DataHealth }) {
  const { tr } = useFmt();
  const rows = [
    { icon: Tag, label: tr("إصدار الواجهة", "Front end version"), value: APP_VERSION, ltr: true },
    { icon: Server, label: tr("إصدار الخادم", "Server version"), value: health.server_version ?? tr("لا يرسلها", "Not sent"), ltr: !!health.server_version },
    { icon: Globe, label: tr("الخادم المتصل به", "API in use"), value: USE_MOCK ? tr("تجريبي (بيانات في المتصفح)", "Demo (data in the browser)") : `${API_URL}/api/v1`, ltr: !USE_MOCK },
    { icon: Clock, label: tr("المنطقة الزمنية لهذا الجهاز", "This device's time zone"), value: Intl.DateTimeFormat().resolvedOptions().timeZone, ltr: true },
  ];
  return (
    <Panel title={tr("عن النظام", "About")}>
      <dl className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-2.5">
            <r.icon size={15} aria-hidden="true" className="shrink-0 text-muted" />
            <dt className="text-muted">{r.label}</dt>
            <dd dir={r.ltr ? "ltr" : undefined} className={cn("ms-auto min-w-0 truncate text-[13px]", r.ltr && "font-mono")}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function DataPanel({ health }: { health: DataHealth }) {
  const { tr, num } = useFmt();
  const rows: { label: string; value: number; note?: string; href?: string; danger?: boolean }[] = [
    { label: tr("حسابات نشطة", "Active accounts"), value: health.users_active, href: "/admin?tab=users" },
    { label: tr("حسابات موقوفة", "Stopped accounts"), value: health.users_stopped, href: "/admin?tab=users" },
    { label: tr("حسابات مقفلة الآن", "Locked now"), value: health.users_locked, href: "/admin/security#locked", danger: health.users_locked > 0 },
    { label: tr("المشاريع", "Projects"), value: health.projects, href: "/" },
    { label: tr("المهام", "Tasks"), value: health.tasks },
    { label: tr("الملفات", "Files"), value: health.files, note: bytesText(health.files_bytes) },
    { label: tr("أسطر سجل العمليات", "Audit log lines"), value: health.audit_entries, href: "/audit", note: health.storage ? bytesText(health.storage.audit_bytes) : undefined },
  ];
  return (
    <Panel title={tr("حجم البيانات", "Data")} note={tr("الأعداد كما في قاعدة البيانات الآن.", "The counts in the database now.")}>
      <ul className="-me-px -mb-px grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {rows.map((r) => (
          <li key={r.label} className={cn("flex flex-col gap-0.5 border-e border-b border-line px-4 py-3", r.href && "relative hover:bg-card-2")}>
            {r.href ? (
              <Link href={r.href} className="text-xs text-muted after:absolute after:inset-0">
                {r.label}
              </Link>
            ) : (
              <span className="text-xs text-muted">{r.label}</span>
            )}
            <span className={cn("num text-xl font-semibold", r.danger && "text-danger")}>{num(r.value)}</span>
            {r.note && (
              <span dir="ltr" className="text-start text-xs text-muted">
                {r.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
