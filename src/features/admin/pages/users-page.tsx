import { UserPlus } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { Empty } from "@/shared/ui";
import { UsersList } from "../components/users-list";
import { canAddUsers, canAdminister } from "../rules";

/**
 * The monitor's users page (the client, 24 November 2026): every account, and "New user" to add one. She gives any job
 * but the CEO and the system admin; changing, stopping or unlocking an account stays with the system admin.
 */
export function UsersPage() {
  const { tr } = useFmt();
  usePageTitle(tr("المستخدمون", "Users"));
  const me = useUser();
  if (!canAddUsers(me)) return <Empty title={tr("هذه الصفحة للمتابِعة ومسؤول النظام والمدير التنفيذي", "This page is for the monitor, the system admin and the CEO")} />;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("المستخدمون", "Users")}</h1>
        {!canAdminister(me) && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <UserPlus size={15} aria-hidden="true" className="shrink-0 text-accent" />
            {tr(
              "أضيفي حسابات جديدة بأي دور عدا المدير التنفيذي ومسؤول النظام. تعديل الحسابات وإيقافها لمسؤول النظام.",
              "Add new accounts with any role but the CEO and the system admin. Changing or stopping an account is for the system admin.",
            )}
          </p>
        )}
      </div>
      <UsersList />
    </div>
  );
}
