import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import type { Team } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, ButtonLink, Dialog, Empty, ErrorBox, errorText, Field, Input, LoadingBlock, Select, Skeleton, Stat, useToast } from "@/shared/ui";
import { adminApi } from "../api";
import { AdminOverview } from "../components/admin-overview";
import { UsersList } from "../components/users-list";
import { canAdminister, SETTING_RANGE } from "../rules";
import type { Settings } from "../types";

type Tab = "users" | "teams" | "settings";
const TAB_KEYS = ["users", "teams", "settings"] as const;

/** The system admin's page (the brief: users, roles and permissions, settings, data health), under an overview of the week. */
export function AdminPage() {
  const { tr } = useFmt();
  usePageTitle(tr("إدارة النظام", "Administration"));
  const me = useUser();
  // In the address, so a link can open a tab: /admin?tab=teams.
  const [tab, setTab] = useQueryParam<Tab>("tab", "users", TAB_KEYS);
  if (!canAdminister(me)) return <Empty title={tr("هذه الصفحة لمسؤول النظام والمدير التنفيذي", "This page is for the system admin and the CEO")} />;

  const tabs: { key: Tab; ar: string; en: string }[] = [
    { key: "users", ar: "المستخدمون والأدوار", en: "Users and roles" },
    { key: "teams", ar: "الفرق", en: "Teams" },
    { key: "settings", ar: "الإعدادات وصحة البيانات", en: "Settings and data health" },
  ];
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{tr("إدارة النظام", "Administration")}</h1>
      {/* The numbers, the week's activity, the newest audit lines and the last changed accounts, before the sections. */}
      <AdminOverview me={me.id} />
      <div role="tablist" aria-label={tr("أقسام الإدارة", "Administration sections")} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`admin-${t.key}`}
            aria-controls="admin-panel"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-3 py-3 text-sm whitespace-nowrap", tab === t.key ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text")}
          >
            {tr(t.ar, t.en)}
          </button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-${tab}`}>
        {tab === "users" && <UsersList />}
        {tab === "teams" && <TeamsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

function TeamsTab() {
  const { tr, lang, num } = useFmt();
  const toast = useToast();
  const load = useLoad(() => Promise.all([adminApi.teams(), adminApi.users()]));
  const [editing, setEditing] = useState<{ team?: Team } | null>(null);
  const [v, setV] = useState({ name: "", name_en: "", lead_id: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (load.state.status === "loading") return <Skeleton className="h-48" />;
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  const [teams, users] = load.state.data;
  const leads = users.filter((u) => u.role === "lead" && u.active);
  const nameOf = (id?: number) => {
    const u = users.find((x) => x.id === id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("بلا قائد", "No leader");
  };
  const open = (team?: Team) => {
    setV({ name: team?.name ?? "", name_en: team?.name_en ?? "", lead_id: team?.lead_id ? String(team.lead_id) : "" });
    setErrors({});
    setEditing({ team });
  };
  const save = async () => {
    const input = { name: v.name, name_en: v.name_en, lead_id: v.lead_id ? Number(v.lead_id) : null };
    try {
      if (editing?.team) await adminApi.updateTeam(editing.team.id, input);
      else await adminApi.createTeam(input);
      toast(tr("حُفظ الفريق.", "Team saved."));
      setEditing(null);
      load.reload();
    } catch (e) {
      setErrors(e instanceof ApiError && e.errors ? e.errors : { form: errorText(e, tr) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button pill className="self-end" onClick={() => open()}>
        <Plus size={16} aria-hidden="true" />
        {tr("فريق جديد", "New team")}
      </Button>
      <ul aria-label={tr("الفرق", "Teams")} className="grid gap-3 md:grid-cols-2">
        {teams.map((t) => (
          // The whole card opens the edit window; "Team page" sits above it and opens the team's own page.
          <li key={t.id} className="relative">
            <Link href={`/teams/${t.id}`} className="absolute end-3 top-3 z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft hover:underline">
              {tr("صفحة الفريق", "Team page")}
              <ChevronLeft size={13} aria-hidden="true" className="ltr:rotate-180" />
            </Link>
            <button type="button" onClick={() => open(t)} className="flex w-full flex-col gap-1 rounded-xl border border-line bg-card p-4 pe-28 text-start hover:border-accent">
              <b dir="auto">{lang === "en" && t.name_en ? t.name_en : t.name}</b>
              <span className="text-sm text-muted">
                {tr(`القائد: ${nameOf(t.lead_id)} · ${num(users.filter((u) => u.active && u.team_id === t.id).length)} أعضاء`, `Leader: ${nameOf(t.lead_id)} · ${users.filter((u) => u.active && u.team_id === t.id).length} people`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">{tr("أعضاء الفريق يُختارون من صفحة كل مستخدم (حقل «الفريق»). الفريق ثابت إلى أن يقرر العميل غير ذلك.", 'Team members are set on each user ("Team"). A team is fixed until the client decides otherwise.')}</p>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.team ? tr("تعديل الفريق", "Edit the team") : tr("فريق جديد", "New team")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button onClick={save}>{tr("احفظ", "Save")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={tr("اسم الفريق", "Team name")} htmlFor="t-name" error={errors.name}>
            <Input id="t-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} invalid={!!errors.name} />
          </Field>
          <Field label={tr("الاسم بالإنجليزية", "Name in English")} htmlFor="t-name-en">
            <Input id="t-name-en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          </Field>
          <Field label={tr("قائد الفريق", "Team leader")} htmlFor="t-lead" error={errors.lead_id}>
            <Select id="t-lead" value={v.lead_id} onChange={(e) => setV({ ...v, lead_id: e.target.value })}>
              <option value="">{tr("بلا قائد", "No leader")}</option>
              {leads.map((u) => (
                <option key={u.id} value={u.id}>
                  {lang === "en" && u.name_en ? u.name_en : u.name}
                </option>
              ))}
            </Select>
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {errors.form}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function SettingsTab() {
  const { tr, num } = useFmt();
  const toast = useToast();
  const load = useLoad(() => Promise.all([adminApi.settings(), adminApi.health()]));
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState<string>();

  if (load.state.status === "loading") return <LoadingBlock><Skeleton className="h-48" /></LoadingBlock>;
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  const [settings, health] = load.state.data;
  const v = draft ?? settings;
  const fields: { key: keyof Settings; ar: string; en: string }[] = [
    { key: "due_soon_days", ar: "تذكير قرب موعد التسليم قبل (أيام)", en: "Due-soon reminder, days before" },
    { key: "lock_after", ar: "قفل الحساب بعد محاولات دخول خاطئة", en: "Lock an account after wrong passwords" },
    { key: "lock_minutes", ar: "مدة القفل (دقائق)", en: "Lock time (minutes)" },
  ];
  const save = async () => {
    setError(undefined);
    try {
      await adminApi.saveSettings(v);
      toast(tr("حُفظت الإعدادات.", "Settings saved."));
      setDraft(null);
      load.reload();
    } catch (e) {
      setError(errorText(e, tr));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-labelledby="settings-title" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
        <h2 id="settings-title" className="font-semibold">
          {tr("الإعدادات", "Settings")}
        </h2>
        {fields.map((f) => (
          <Field key={f.key} label={`${tr(f.ar, f.en)} (${SETTING_RANGE[f.key][0]}–${SETTING_RANGE[f.key][1]})`} htmlFor={`s-${f.key}`}>
            <Input
              id={`s-${f.key}`}
              type="number"
              min={SETTING_RANGE[f.key][0]}
              max={SETTING_RANGE[f.key][1]}
              value={v[f.key]}
              onChange={(e) => setDraft({ ...v, [f.key]: Number(e.target.value) })}
            />
          </Field>
        ))}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button onClick={save} disabled={!draft} className="self-start">
          {tr("احفظ الإعدادات", "Save settings")}
        </Button>
        <ButtonLink href="/admin/security" variant="ghost" size="sm" className="self-start">
          {tr("الجلسات والحسابات المقفلة", "Sessions and locked accounts")}
        </ButtonLink>
      </section>
      <section aria-labelledby="health-title" className="flex flex-col gap-3">
        <h2 id="health-title" className="font-semibold">
          {tr("صحة البيانات", "Data health")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat href="/admin?tab=users" label={tr("حسابات نشطة", "Active accounts")} value={num(health.users_active)} note={tr(`موقوفة ${num(health.users_stopped)} · مقفلة ${num(health.users_locked)}`, `${health.users_stopped} stopped · ${health.users_locked} locked`)} />
          <Stat href="/" label={tr("المشاريع والمهام", "Projects and tasks")} value={num(health.projects)} note={tr(`${num(health.tasks)} مهمة`, `${health.tasks} tasks`)} />
          <Stat label={tr("الملفات", "Files")} value={num(health.files)} note={`${(health.files_bytes / 1024 / 1024).toFixed(1)} MB`} />
          <Stat href="/audit" label={tr("سجل العمليات", "Audit log")} value={num(health.audit_entries)} note={tr("سطر محفوظ", "lines kept")} />
        </div>
        <p className="text-xs text-faint">{tr("النسخ الاحتياطي يديره فريق DevOps على الخادم (سؤال مفتوح للعميل).", "Backups are run by DevOps on the server (an open question for the client).")}</p>
        <ButtonLink href="/admin/health" variant="secondary" size="sm" className="self-start">
          {tr("صحة النظام كاملة", "Full system health")}
        </ButtonLink>
      </section>
    </div>
  );
}
