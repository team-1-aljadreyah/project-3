// The two tables of ticks: who may do what (actions × jobs) and who gets which notification (kinds × jobs).
// The CEO's column is always ticked and locked (the CEO rule); required notifications are locked on for everyone.
import { BellRing, Lock, RotateCcw, UserCheck } from "lucide-react";
import { KIND_WORDS } from "@/features/notifications";
import { NOTIFICATION_KINDS, REQUIRED_NOTIFICATIONS, type NotificationKind } from "@/shared/api/notification-kinds";
import type { Role } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { cn } from "@/shared/lib/utils";
import { Pill } from "@/shared/ui";
import { ACTION_GROUPS, ACTIONS, ALL_ROLES, baseDoes, DEFAULT_RULES as D, STAFF_ROLES, type ActionGroup } from "../rules";
import type { ActionKey, StaffRole } from "../types";
import { type Ctx, Note, Part, same } from "./controls";
import { RoleBadge } from "./part-roles";
import { Later, Live } from "./parts-rules";

const sorted = <T,>(a: T[]) => [...a].sort();

/** A tick in a table, with its full name for screen readers ("Create a project: Team leader"). */
function Tick({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
      className="size-[18px] cursor-pointer rounded accent-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

/** The back-to-default link of a table row. */
function DefaultLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
      <RotateCcw size={11} aria-hidden="true" />
      {label}
    </button>
  );
}

const roleName = (r: Role, tr: Ctx["tr"]) => tr(ROLES[r].ar, ROLES[r].en);

export function PermissionsPart(c: Ctx) {
  const { tr, r } = c;
  const changed = ACTIONS.filter((a) => !same(sorted(r.permissions[a.key]), sorted(D.permissions[a.key])));
  const setAction = (key: ActionKey, roles: StaffRole[]) => c.set({ permissions: { ...r.permissions, [key]: STAFF_ROLES.filter((x) => roles.includes(x)) } });
  const groups = Object.keys(ACTION_GROUPS) as ActionGroup[];
  // The CEO's own roles get a column each after the jobs (part «Jobs and roles»).
  const setRoleAction = (key: string, action: ActionKey, on: boolean) =>
    c.set({ roles: r.roles.map((x) => (x.key === key ? { ...x, actions: on ? [...x.actions, action] : x.actions.filter((y) => y !== action) } : x)) });
  const minWidth = 680 + r.roles.length * 110;

  return (
    <div className="flex flex-col gap-5">
      <Note>
        {tr(
          "علّم الوظائف التي يحق لها كل عمل. المدير التنفيذي يحق له كل شيء دائماً. ما تراه الآن هو قواعد المنصة اليوم.",
          "Tick the jobs that may do each thing. The CEO may always do everything. What you see now is how the platform works today.",
        )}
      </Note>
      {changed.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone="review">{tr(`أعمال معدَّلة: ${changed.length}`, `${changed.length} changed`)}</Pill>
          <DefaultLink onClick={() => c.set({ permissions: D.permissions })} label={tr("أرجع الكل كما كان", "All back to default")} />
        </p>
      )}
      {groups.map((g) => (
        <Part key={g} title={tr(ACTION_GROUPS[g].ar, ACTION_GROUPS[g].en)} icon={<UserCheck size={17} aria-hidden="true" className="text-accent" />} action={<Later />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth }}>
              <caption className="sr-only">{tr(`من يحق له ماذا: ${ACTION_GROUPS[g].ar}`, `Who may do what: ${ACTION_GROUPS[g].en}`)}</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="px-5 py-2.5 text-start font-medium">
                    {tr("العمل", "Action")}
                  </th>
                  {ALL_ROLES.map((role) => (
                    <th key={role} scope="col" className="px-2 py-2.5 text-center font-medium">
                      {roleName(role, tr)}
                    </th>
                  ))}
                  {r.roles.map((role) => (
                    <th key={role.key} scope="col" className="border-s border-line px-2 py-2 text-center font-medium">
                      <RoleBadge role={role} className="max-w-32 justify-center text-center whitespace-normal" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIONS.filter((a) => a.group === g).map((a) => {
                  const roles = r.permissions[a.key];
                  const isChanged = changed.includes(a);
                  return (
                    <tr key={a.key} data-changed={isChanged || undefined} className={cn("border-b border-line last:border-0", isChanged && "bg-(--st-review)/40")}>
                      <th scope="row" className="px-5 py-3 text-start font-medium">
                        <span className="flex flex-wrap items-center gap-2">
                          {tr(a.ar, a.en)}
                          {a.later && <span className="text-xs font-normal text-faint">{tr("(غير موجود في المنصة بعد)", "(not in the platform yet)")}</span>}
                          {isChanged && <Pill tone="review">{tr("معدَّل", "Changed")}</Pill>}
                        </span>
                        {isChanged && <DefaultLink onClick={() => setAction(a.key, a.def)} label={tr("الافتراضي", "Default")} />}
                      </th>
                      {ALL_ROLES.map((role) => (
                        <td key={role} className="px-2 py-3 text-center">
                          {role === "ceo" ? (
                            <Tick checked disabled label={tr(`${a.ar}: ${roleName(role, tr)} (دائماً)`, `${a.en}: ${roleName(role, tr)} (always)`)} />
                          ) : (
                            <Tick
                              checked={roles.includes(role)}
                              onChange={(on) => setAction(a.key, on ? [...roles, role] : roles.filter((x) => x !== role))}
                              label={`${tr(a.ar, a.en)}: ${roleName(role, tr)}`}
                            />
                          )}
                        </td>
                      ))}
                      {r.roles.map((role) => {
                        const able = baseDoes(role.base, a.key);
                        const name = tr(role.name, role.name_en || role.name);
                        return (
                          <td key={role.key} className="border-s border-line px-2 py-3 text-center">
                            <span title={able ? undefined : tr("وظيفته الأساسية لا تقوم بهذا", "Its base job doesn't do this")}>
                              <Tick checked={able && role.actions.includes(a.key)} disabled={!able} onChange={(on) => setRoleAction(role.key, a.key, on)} label={`${tr(a.ar, a.en)}: ${name}`} />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Part>
      ))}
      {r.roles.length > 0 && (
        <p className="text-xs text-muted">
          {tr(
            "أعمدة الأدوار التي أنشأتها: «إنشاء مشروع» و«إسناد مهمة» و«تغيير الموعد» و«نشر إعلان» و«إنشاء مجموعة» و«كتابة التقييمات» و«تسجيل مشكلة» يرفضها الخادم الآن حين تزيل علامتها، والباقي يُطبَّق لاحقاً. الخانة الرمادية: وظيفته الأساسية لا تقوم بهذا.",
            "Columns of the roles you made: «create a project», «give a task», «change a due date», «post an announcement», «create a group», «write reviews» and «report a bug» are refused by the server now when unticked; the rest applies later. A grey box: its base job doesn't do this.",
          )}
        </p>
      )}
    </div>
  );
}

export function NotifyPart(c: Ctx) {
  const { tr, r } = c;
  const isChanged = (k: NotificationKind) => !same(sorted(r.notify[k]), sorted(D.notify[k]));
  const changed = NOTIFICATION_KINDS.filter(isChanged);
  const setKind = (k: NotificationKind, roles: Role[]) => c.set({ notify: { ...r.notify, [k]: ALL_ROLES.filter((x) => roles.includes(x)) } });

  return (
    <div className="flex flex-col gap-5">
      <Note>
        {tr(
          "أزل العلامة لتوقف نوعاً من الإشعارات عن وظيفة كاملة. الإشعارات المطلوبة تصل الجميع دائماً. ويبقى لكل شخص أن يوقف ما يشاء من غير المطلوبة في صفحة إشعاراته.",
          "Untick to stop a kind of notification for a whole job. Required ones always reach everyone. Each person can still turn off the ones that aren't required on their notifications page.",
        )}
      </Note>
      <Part
        title={tr("من يصله كل إشعار", "Who gets which notification")}
        sub={changed.length ? tr(`أنواع معدَّلة: ${changed.length}`, `${changed.length} kinds changed`) : tr(`${NOTIFICATION_KINDS.length} نوعاً، كلها تصل الجميع`, `${NOTIFICATION_KINDS.length} kinds, all reach everyone`)}
        icon={<BellRing size={17} aria-hidden="true" className="text-accent" />}
        action={
          <span className="flex items-center gap-2">
            {changed.length > 0 && <DefaultLink onClick={() => c.set({ notify: D.notify })} label={tr("أرجع الكل", "All back")} />}
            <Live />
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">{tr("من يصله كل إشعار", "Who gets which notification")}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="px-5 py-2.5 text-start font-medium">
                  {tr("الإشعار", "Notification")}
                </th>
                {ALL_ROLES.map((role) => (
                  <th key={role} scope="col" className="px-2 py-2.5 text-center font-medium">
                    {roleName(role, tr)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_KINDS.map((k) => {
                const w = KIND_WORDS[k];
                const required = REQUIRED_NOTIFICATIONS.has(k);
                const roles = r.notify[k];
                const ch = isChanged(k);
                return (
                  <tr key={k} data-changed={ch || undefined} className={cn("border-b border-line last:border-0", ch && "bg-(--st-review)/40")}>
                    <th scope="row" className="px-5 py-2.5 text-start font-medium">
                      <span className="flex flex-wrap items-center gap-2">
                        {tr(w.ar, w.en)}
                        {required && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-faint">
                            <Lock size={11} aria-hidden="true" />
                            {tr("مطلوب", "Required")}
                          </span>
                        )}
                        {ch && <Pill tone="review">{tr("معدَّل", "Changed")}</Pill>}
                      </span>
                      <span className="block text-xs font-normal text-muted">{tr(w.hint_ar, w.hint_en)}</span>
                      {ch && <DefaultLink onClick={() => setKind(k, D.notify[k])} label={tr("الافتراضي: الجميع", "Default: everyone")} />}
                    </th>
                    {ALL_ROLES.map((role) => (
                      <td key={role} className="px-2 py-2.5 text-center">
                        <Tick
                          checked={required || roles.includes(role)}
                          disabled={required}
                          onChange={(on) => setKind(k, on ? [...roles, role] : roles.filter((x) => x !== role))}
                          label={`${tr(w.ar, w.en)}: ${roleName(role, tr)}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Part>
    </div>
  );
}
