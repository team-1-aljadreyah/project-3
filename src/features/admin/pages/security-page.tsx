import { CircleCheck, KeyRound, LockOpen, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Team } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { roleName } from "@/shared/lib/site";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, matches } from "@/shared/lib/utils";
import { Avatar, Button, Dialog, Empty, ErrorBox, errorText, Input, LoadingBlock, Pill, Skeleton, useToast } from "@/shared/ui";
import { adminApi } from "../api";
import { deviceWords, parseUserAgent, shortSession, type Device } from "../audit-detail";
import { Panel } from "../components/panel";
import { UserDialog } from "../components/user-dialog";
import { canManageSessions } from "../rules";
import { NEVER_SIGNED_IN_DAYS } from "../security";
import type { AdminSession, AdminUser, SecuritySummary } from "../types";

/** "Active now": seen in the last 5 minutes. */
const LIVE_MS = 5 * 60_000;

const DEVICE_ICON: Record<Device["kind"], typeof Monitor> = { computer: Monitor, phone: Smartphone, tablet: Tablet, other: Monitor };

type Confirm = { kind: "one"; session: AdminSession; user?: AdminUser } | { kind: "all"; user: AdminUser; count: number };

/**
 * Sessions and security (/admin/security): who is signed in, on what and from where, with "sign out this session" and
 * "sign out everywhere"; the failed sign-ins of the last 7 days by account and by address; the locked accounts with
 * "unlock now"; and the accounts that never signed in. The admin and the CEO (the server refuses others: 403).
 */
export function SecurityPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الجلسات والأمان", "Sessions and security"));
  const me = useUser();
  const allowed = canManageSessions(me);
  const load = useLoad(
    () => (allowed ? Promise.all([adminApi.sessions(), adminApi.securitySummary(), adminApi.users(), adminApi.teams()]) : Promise.resolve(null)),
    [allowed],
  );

  if (!allowed) return <Empty title={tr("هذه الصفحة لمسؤول النظام والمدير التنفيذي", "This page is for the system admin and the CEO")} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("الجلسات والأمان", "Sessions and security")}</h1>
        <p className="text-sm text-muted">{tr("من سجّل الدخول الآن ومن أين، ومحاولات الدخول الخاطئة، والحسابات المقفلة.", "Who is signed in now and from where, wrong passwords, and locked accounts.")}</p>
      </header>
      {load.state.status === "loading" ? (
        <LoadingBlock className="flex flex-col gap-5">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </LoadingBlock>
      ) : load.state.status === "error" ? (
        <ErrorBox error={load.state.error} onRetry={load.reload} />
      ) : load.data ? (
        <SecurityBody sessions={load.data[0]} summary={load.data[1]} users={load.data[2]} teams={load.data[3]} me={me.id} reload={load.reload} />
      ) : null}
    </div>
  );
}

function SecurityBody({ sessions, summary, users, teams, me, reload }: { sessions: AdminSession[]; summary: SecuritySummary; users: AdminUser[]; teams: Team[]; me: number; reload: () => void }) {
  const { tr, num } = useFmt();
  const people = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const signedIn = new Set(sessions.map((s) => s.user_id)).size;
  const addresses = summary.by_ip.length;

  const cells: { id: string; label: string; value: number; note: string; danger?: boolean }[] = [
    { id: "sessions", label: tr("جلسات نشطة", "Active sessions"), value: sessions.length, note: tr(`لـ ${num(signedIn)} أشخاص`, `for ${signedIn} people`) },
    {
      id: "failed",
      label: tr(`دخول خاطئ (${num(summary.days)} أيام)`, `Failed sign-ins (${summary.days} days)`),
      value: summary.failed_total,
      note: tr(`من ${num(addresses)} عنوان`, `from ${addresses} addresses`),
      danger: summary.failed_total >= summary.lock_after,
    },
    { id: "locked", label: tr("مقفلة الآن", "Locked now"), value: summary.locked.length, note: summary.locked.length ? tr("افتحها من هنا", "Unlock them here") : tr("لا شيء", "None"), danger: summary.locked.length > 0 },
    { id: "never", label: tr("لم تسجّل الدخول قط", "Never signed in"), value: summary.never_signed_in.length, note: tr("حسابات نشطة", "active accounts") },
  ];

  return (
    <>
      {/* One strip of four numbers; each jumps to its part of the page. */}
      <section aria-label={tr("الخلاصة", "Summary")} className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {cells.map((c) => (
            <li key={c.id} className="relative flex flex-col gap-0.5 border-line px-4 py-3 hover:bg-card-2 max-lg:odd:border-e max-lg:nth-[-n+2]:border-b lg:not-last:border-e">
              <a href={`#${c.id}`} className="text-[13px] text-muted after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
                {c.label}
              </a>
              <span className={cn("num text-2xl font-semibold", c.danger && "text-danger")}>{num(c.value)}</span>
              <span className="text-xs text-muted">{c.note}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span>
          <KeyRound size={15} aria-hidden="true" className="me-2 inline align-[-2px]" />
          {tr(
          `يُقفل الحساب بعد ${num(summary.lock_after)} محاولات خاطئة متتالية، لمدة ${num(summary.lock_minutes)} دقيقة.`,
          `An account locks after ${summary.lock_after} wrong passwords in a row, for ${summary.lock_minutes} minutes.`,
          )}
        </span>
        <Link href="/admin?tab=settings" className="font-medium text-accent underline-offset-4 hover:underline">
          {tr("غيّرها في الإعدادات", "Change it in the settings")}
        </Link>
      </p>
      <SessionsPanel sessions={sessions} people={people} reload={reload} />
      <FailedPanel summary={summary} people={people} />
      <div className="grid gap-5 lg:grid-cols-2">
        <LockedPanel summary={summary} people={people} reload={reload} />
        <NeverPanel summary={summary} people={people} teams={teams} me={me} reload={reload} />
      </div>
    </>
  );
}

function SessionsPanel({ sessions, people, reload }: { sessions: AdminSession[]; people: Map<number, AdminUser>; reload: () => void }) {
  const { tr, num, lang, ago, dateTime } = useFmt();
  const toast = useToast();
  const [q, setQ] = useQueryParam<string>("q", "");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const now = new Date().getTime();
  const nameOf = (u?: AdminUser) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("حساب محذوف", "Unknown account"));

  // One block per person, the most recently active first; the search finds a person, an address or a device.
  const groups = useMemo(() => {
    const byUser = new Map<number, AdminSession[]>();
    for (const s of sessions) {
      const u = people.get(s.user_id);
      const device = deviceWords(parseUserAgent(s.user_agent), (ar, en) => `${ar} ${en}`);
      if (q && !matches(q, u?.name, u?.name_en, u?.email, s.ip, device)) continue;
      byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
    }
    return [...byUser.entries()];
  }, [sessions, people, q]);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(undefined);
    try {
      if (confirm.kind === "one") {
        await adminApi.endSession(confirm.session.id);
        toast(tr("انتهت الجلسة: على صاحبها تسجيل الدخول من جديد على ذلك الجهاز.", "The session ended: its owner must sign in again on that device."));
      } else {
        const { ended } = await adminApi.endUserSessions(confirm.user.id);
        toast(tr(`أُخرج من ${num(ended)} جلسة.`, `Signed out of ${ended} sessions.`));
      }
      setConfirm(null);
      reload();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const confirmText = () => {
    if (!confirm) return "";
    if (confirm.kind === "all") {
      return tr(
        `سيخرج ${nameOf(confirm.user)} من ${num(confirm.count)} جلسة على كل أجهزته، ويحتاج إلى تسجيل الدخول من جديد. لا تتغير كلمة مروره.`,
        `${nameOf(confirm.user)} will be signed out of ${confirm.count} sessions on every device and must sign in again. The password stays the same.`,
      );
    }
    const d = deviceWords(parseUserAgent(confirm.session.user_agent), tr);
    return tr(
      `سيخرج ${nameOf(confirm.user)} من ${d}${confirm.session.ip ? ` (${confirm.session.ip})` : ""} ويحتاج إلى تسجيل الدخول من جديد هناك. جلساته الأخرى تبقى.`,
      `${nameOf(confirm.user)} will be signed out on ${d}${confirm.session.ip ? ` (${confirm.session.ip})` : ""} and must sign in again there. Their other sessions stay.`,
    );
  };

  return (
    <Panel
      id="sessions"
      title={tr("الجلسات النشطة", "Active sessions")}
      note={tr("جلسة لكل جهاز سجّل منه الشخص دخوله. تنتهي الجلسة وحدها بعد 30 يوماً دون استعمال.", "One session per device a person signed in on. A session ends by itself after 30 days unused.")}
      tools={
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("شخص أو عنوان أو جهاز", "Person, address or device")}
          aria-label={tr("ابحث في الجلسات", "Search the sessions")}
          className="h-9 w-full sm:w-64"
        />
      }
    >
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{q ? tr("لا جلسة تطابق البحث.", "No session matches the search.") : tr("لا أحد مسجّل الدخول الآن.", "Nobody is signed in now.")}</p>
      ) : (
        <ul aria-label={tr("الجلسات حسب الشخص", "Sessions by person")} className="divide-y divide-line">
          {groups.map(([userId, list]) => {
            const u = people.get(userId);
            const others = list.filter((s) => !s.current).length;
            return (
              <li key={userId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span aria-hidden="true" className="flex">
                    {u ? <Avatar user={u} /> : <span className="size-8 rounded-full bg-chip" />}
                  </span>
                  <span className="flex min-w-40 flex-1 flex-col">
                    <span className="font-medium">{nameOf(u)}</span>
                    <span className="text-xs text-muted">
                      {u && roleName(u, lang)} · {tr(`${num(list.length)} جلسة`, `${list.length} ${list.length === 1 ? "session" : "sessions"}`)}
                    </span>
                  </span>
                  {u && others > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setConfirm({ kind: "all", user: u, count: others })} aria-label={tr(`أخرج ${nameOf(u)} من كل الأجهزة`, `Sign ${nameOf(u)} out everywhere`)}>
                      <LogOut size={14} aria-hidden="true" />
                      {tr("أخرجه من كل الأجهزة", "Sign out everywhere")}
                    </Button>
                  )}
                </div>
                <ul aria-label={tr(`جلسات ${nameOf(u)}`, `${nameOf(u)}'s sessions`)} className="flex flex-col gap-1.5 sm:ps-11">
                  {list.map((s) => {
                    const d = parseUserAgent(s.user_agent);
                    const Icon = DEVICE_ICON[d.kind];
                    const live = now - Date.parse(s.last_seen_at) < LIVE_MS;
                    return (
                      <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg bg-card-2 px-3 py-2 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Icon size={18} aria-hidden="true" className="text-muted" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{deviceWords(d, tr)}</span>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            <span dir="ltr" className="font-mono">
                              {s.ip ?? "-"}
                            </span>
                            <span title={s.id} dir="ltr" className="font-mono text-faint">
                              #{shortSession(s.id)}
                            </span>
                          </span>
                        </span>
                        <span className="col-start-2 text-xs text-muted sm:col-start-auto">
                          {tr("الدخول:", "Signed in:")} <time dateTime={s.started_at}>{dateTime(s.started_at)}</time>
                        </span>
                        <span className="col-start-2 flex items-center gap-1.5 text-xs text-muted sm:col-start-auto">
                          <span aria-hidden="true" className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-line-strong")} />
                          {live ? tr("نشط الآن", "Active now") : <>{tr("آخر نشاط:", "Last seen:")} <time dateTime={s.last_seen_at} title={dateTime(s.last_seen_at)}>{ago(s.last_seen_at)}</time></>}
                        </span>
                        <span className="col-start-3 row-span-3 row-start-1 self-center sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                          {s.current ? (
                            <Pill tone="done">{tr("هذا الجهاز", "This device")}</Pill>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirm({ kind: "one", session: s, user: u })} aria-label={tr(`أنهِ جلسة ${nameOf(u)} على ${deviceWords(d, tr)}`, `End ${nameOf(u)}'s session on ${deviceWords(d, tr)}`)}>
                              <LogOut size={14} aria-hidden="true" />
                              <span className="max-sm:sr-only">{tr("أنهِ الجلسة", "End session")}</span>
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "all" ? tr("إخراجه من كل الأجهزة؟", "Sign out everywhere?") : tr("إنهاء هذه الجلسة؟", "End this session?")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button onClick={run} disabled={busy}>
              {tr("أخرجه", "Sign out")}
            </Button>
          </>
        }
      >
        <p className="text-sm">{confirmText()}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Dialog>
    </Panel>
  );
}

function FailedPanel({ summary, people }: { summary: SecuritySummary; people: Map<number, AdminUser> }) {
  const { tr, num, lang, ago, dateTime } = useFmt();
  const nameOf = (u: AdminUser) => (lang === "en" && u.name_en ? u.name_en : u.name);
  const most = Math.max(1, ...summary.by_account.map((a) => a.count), ...summary.by_ip.map((a) => a.count));
  const bar = (count: number) => (
    <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-chip">
      <span className={cn("block h-full rounded-full", count >= summary.lock_after ? "bg-danger" : "bg-line-strong")} style={{ width: `${Math.max(8, (count / most) * 100)}%` }} />
    </span>
  );
  const th = "px-3 py-2 text-start text-xs font-medium whitespace-nowrap text-muted";
  const td = "px-3 py-2.5";

  return (
    <Panel
      id="failed"
      title={tr(`محاولات الدخول الخاطئة (آخر ${num(summary.days)} أيام)`, `Failed sign-ins (last ${summary.days} days)`)}
      note={tr("الأكثر أولاً. الأحمر بلغ حد القفل. كل صف يفتح محاولاته في سجل العمليات.", "The most first. Red reached the lock limit. Each row opens its attempts in the audit log.")}
    >
      {summary.failed_total === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CircleCheck size={16} aria-hidden="true" className="text-success" />
          {tr(`لا محاولات خاطئة في آخر ${num(summary.days)} أيام.`, `No failed sign-ins in the last ${summary.days} days.`)}
        </p>
      ) : (
        <div className="grid divide-line lg:grid-cols-2 lg:divide-x rtl:lg:divide-x-reverse max-lg:divide-y">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="px-3 pt-3 pb-1 text-start text-[13px] font-semibold">{tr("حسب الحساب", "By account")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>{tr("الحساب", "Account")}</th>
                  <th scope="col" className={th}>{tr("المحاولات", "Attempts")}</th>
                  <th scope="col" className={cn(th, "max-sm:hidden")}>{tr("العناوين", "Addresses")}</th>
                  <th scope="col" className={th}>{tr("آخرها", "Last")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_account.slice(0, 10).map((a) => {
                  const u = a.user_id !== undefined ? people.get(a.user_id) : undefined;
                  const href = `/audit?action=login_failed&q=${encodeURIComponent(a.label)}`;
                  return (
                    <tr key={a.user_id ?? a.label} className="relative border-t border-line hover:bg-card-2">
                      <td className={td}>
                        <Link href={href} className="flex flex-col after:absolute after:inset-0">
                          {u ? <span className="font-medium">{nameOf(u)}</span> : <span className="text-muted">{tr("بريد غير معروف", "Unknown email")}</span>}
                          <span dir="ltr" className="truncate text-start text-xs text-muted">
                            {a.label}
                          </span>
                        </Link>
                      </td>
                      <td className={td}>
                        <span className="flex items-center gap-2">
                          <span className={cn("num w-6 font-semibold", a.count >= summary.lock_after && "text-danger")}>{num(a.count)}</span>
                          {bar(a.count)}
                        </span>
                      </td>
                      <td className={cn(td, "text-xs text-muted max-sm:hidden")}>
                        <span dir="ltr" className="font-mono">
                          {a.ips.slice(0, 2).join(", ")}
                          {a.ips.length > 2 && ` +${a.ips.length - 2}`}
                        </span>
                      </td>
                      <td className={cn(td, "text-xs whitespace-nowrap text-muted")}>
                        <time dateTime={a.last_at} title={dateTime(a.last_at)}>{ago(a.last_at)}</time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="px-3 pt-3 pb-1 text-start text-[13px] font-semibold">{tr("حسب العنوان", "By address")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>{tr("عنوان IP", "IP address")}</th>
                  <th scope="col" className={th}>{tr("المحاولات", "Attempts")}</th>
                  <th scope="col" className={cn(th, "max-sm:hidden")}>{tr("حسابات جُرّبت", "Accounts tried")}</th>
                  <th scope="col" className={th}>{tr("آخرها", "Last")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_ip.slice(0, 10).map((a) => (
                  <tr key={a.ip} className="relative border-t border-line hover:bg-card-2">
                    <td className={td}>
                      <Link href={`/audit?action=login_failed&ip=${encodeURIComponent(a.ip)}`} dir="ltr" className="font-mono after:absolute after:inset-0">
                        {a.ip}
                      </Link>
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className={cn("num w-6 font-semibold", a.count >= summary.lock_after && "text-danger")}>{num(a.count)}</span>
                        {bar(a.count)}
                      </span>
                    </td>
                    <td className={cn(td, "num text-muted max-sm:hidden")}>{num(a.accounts)}</td>
                    <td className={cn(td, "text-xs whitespace-nowrap text-muted")}>
                      <time dateTime={a.last_at} title={dateTime(a.last_at)}>{ago(a.last_at)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

function LockedPanel({ summary, people, reload }: { summary: SecuritySummary; people: Map<number, AdminUser>; reload: () => void }) {
  const { tr, num, lang, dateTime } = useFmt();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const nameOf = (u?: AdminUser) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");
  const unlock = async (id: number) => {
    setError(undefined);
    try {
      await adminApi.unlockUser(id);
      toast(tr("فُتح الحساب: يستطيع صاحبه الدخول الآن.", "Unlocked: its owner can sign in now."));
      reload();
    } catch (e) {
      setError(errorText(e, tr));
    }
  };
  return (
    <Panel id="locked" title={tr("الحسابات المقفلة", "Locked accounts")} note={tr("قُفلت بعد محاولات خاطئة، وتُفتح وحدها حين تنتهي المدة.", "Locked after wrong passwords; they open by themselves when the time is up.")}>
      {summary.locked.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CircleCheck size={16} aria-hidden="true" className="text-success" />
          {tr("لا حساب مقفل الآن.", "No account is locked now.")}
        </p>
      ) : (
        <ul aria-label={tr("الحسابات المقفلة", "Locked accounts")} className="divide-y divide-line">
          {summary.locked.map((l) => {
            const u = people.get(l.user_id);
            return (
              <li key={l.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="flex">
                  {u && <Avatar user={u} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{nameOf(u)}</span>
                  <span className="text-xs text-danger">
                    {tr(`مقفل حتى ${dateTime(l.locked_until)} · ${num(l.failed)} محاولات خاطئة`, `Locked until ${dateTime(l.locked_until)} · ${l.failed} wrong passwords`)}
                  </span>
                </span>
                <Button size="sm" onClick={() => unlock(l.user_id)} aria-label={tr(`افتح حساب ${nameOf(u)} الآن`, `Unlock ${nameOf(u)} now`)}>
                  <LockOpen size={14} aria-hidden="true" />
                  {tr("افتحه الآن", "Unlock now")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="px-4 pb-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Panel>
  );
}

function NeverPanel({ summary, people, teams, me, reload }: { summary: SecuritySummary; people: Map<number, AdminUser>; teams: Team[]; me: number; reload: () => void }) {
  const { tr, lang, day } = useFmt();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const old = new Date().getTime() - NEVER_SIGNED_IN_DAYS * 86_400_000;
  return (
    <Panel id="never" title={tr("لم تسجّل الدخول قط", "Never signed in")} note={tr("حسابات نشطة لم يدخل بها أصحابها بعد: تأكد أنهم استلموا بياناتهم.", "Active accounts their owners have not used yet: check they got their details.")}>
      {summary.never_signed_in.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CircleCheck size={16} aria-hidden="true" className="text-success" />
          {tr("دخل كل أصحاب الحسابات مرة على الأقل.", "Everyone has signed in at least once.")}
        </p>
      ) : (
        <ul aria-label={tr("لم تسجّل الدخول قط", "Never signed in")} className="divide-y divide-line">
          {summary.never_signed_in.map((n) => {
            const u = people.get(n.user_id);
            if (!u) return null;
            const stale = !n.created_at || Date.parse(n.created_at) < old;
            return (
              <li key={n.user_id}>
                {/* The whole row opens the account (click anywhere). */}
                <button type="button" onClick={() => setEditing(u)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start hover:bg-card-2">
                  <span aria-hidden="true" className="flex">
                    <Avatar user={u} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{lang === "en" && u.name_en ? u.name_en : u.name}</span>
                    <span dir="ltr" className="truncate text-start text-xs text-muted">
                      {u.email}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{n.created_at ? tr(`أُضيف ${day(n.created_at)}`, `Added ${day(n.created_at)}`) : tr("أُضيف قبل السجل", "Added before the log")}</span>
                  {stale && <Pill tone="review">{tr(`أقدم من ${NEVER_SIGNED_IN_DAYS} أيام`, `Older than ${NEVER_SIGNED_IN_DAYS} days`)}</Pill>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <UserDialog user={editing} teams={teams} me={me} onClose={() => setEditing(null)} onSaved={reload} />}
    </Panel>
  );
}
