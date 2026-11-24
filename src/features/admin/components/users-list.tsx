import { Cake, Lock, Plus } from "lucide-react";
import { useState } from "react";
import { ROLES as ROLE_WORDS } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { roleName } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { cn, matches } from "@/shared/lib/utils";
import { Avatar, Button, ErrorBox, Input, Pill, Select, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { canAdminister, isLocked } from "../rules";
import type { AdminUser } from "../types";
import { UserDialog } from "./user-dialog";

/**
 * The accounts: search, a role filter, the ones without a birth date, and "New user". The admin and the CEO open any
 * row to change it; the monitor (who only adds accounts) sees the rows as they are.
 */
export function UsersList() {
  const { tr, lang } = useFmt();
  const me = useUser();
  const canEdit = canAdminister(me);
  const load = useLoad(() => Promise.all([adminApi.users(), adminApi.teams()]));
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  // Only the accounts without a birth date (it is optional, but the birthday reminders need it).
  const [noBirth, setNoBirth] = useState(false);
  const [editing, setEditing] = useState<{ user?: AdminUser } | null>(null);
  const now = new Date().toISOString();

  if (load.state.status === "loading") return <Skeleton className="h-72" />;
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  const [users, teams] = load.state.data;
  const missingBirth = users.filter((u) => u.active && !u.birth_date).length;
  const shown = users.filter((u) => (!role || u.role === role) && (!noBirth || (u.active && !u.birth_date)) && matches(q, u.name, u.name_en, u.email));
  const teamName = (id?: number) => {
    const t = teams.find((x) => x.id === id);
    return t ? (lang === "en" && t.name_en ? t.name_en : t.name) : "-";
  };

  const row = (u: AdminUser) => (
    <>
      <Avatar user={u} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{lang === "en" && u.name_en ? u.name_en : u.name}</span>
        <span dir="ltr" className="truncate text-xs text-muted">
          {u.email}
        </span>
      </span>
      <Pill tone="todo">{roleName(u, lang)}</Pill>
      <span className="text-xs text-muted">{teamName(u.team_id)}</span>
      {u.active && !u.birth_date && (
        <span className="inline-flex items-center gap-1 text-xs text-faint" title={tr("تذكيرات أعياد الميلاد تحتاجه", "The birthday reminders need it")}>
          <Cake size={12} aria-hidden="true" />
          {tr("بلا تاريخ ميلاد", "No birth date")}
        </span>
      )}
      {!u.active && <Pill tone="blocked">{tr("موقوف", "Stopped")}</Pill>}
      {isLocked(u, now) && (
        <Pill tone="review">
          <Lock size={12} aria-hidden="true" />
          {tr("مقفل", "Locked")}
        </Pill>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("ابحث بالاسم أو البريد", "Search by name or email")} aria-label={tr("ابحث عن مستخدم", "Search for a user")} className="h-9 w-64" />
        <Select aria-label={tr("الدور", "Role")} value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-auto">
          <option value="">{tr("كل الأدوار", "All roles")}</option>
          {Object.entries(ROLE_WORDS).map(([k, w]) => (
            <option key={k} value={k}>
              {tr(w.ar, w.en)}
            </option>
          ))}
        </Select>
        {(missingBirth > 0 || noBirth) && (
          <button
            type="button"
            aria-pressed={noBirth}
            onClick={() => setNoBirth((x) => !x)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
              noBirth ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:border-accent hover:text-text",
            )}
          >
            <Cake size={15} aria-hidden="true" />
            {tr(`بلا تاريخ ميلاد: ${missingBirth}`, `No birth date: ${missingBirth}`)}
          </button>
        )}
        <Button pill className="ms-auto" onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" />
          {tr("مستخدم جديد", "New user")}
        </Button>
      </div>
      <ul aria-label={tr("المستخدمون", "Users")} className="flex flex-col gap-2">
        {shown.map((u) => (
          <li key={u.id}>
            {canEdit ? (
              // The whole row opens the user (click anywhere).
              <button type="button" onClick={() => setEditing({ user: u })} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-3 text-start hover:border-accent">
                {row(u)}
              </button>
            ) : (
              <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-3">{row(u)}</div>
            )}
          </li>
        ))}
      </ul>
      {editing && <UserDialog user={editing.user} teams={teams} me={me.id} onClose={() => setEditing(null)} onSaved={load.reload} />}
    </div>
  );
}
