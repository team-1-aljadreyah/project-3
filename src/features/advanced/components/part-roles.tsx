// «Jobs and roles»: the CEO makes a new job. It starts like one of the existing jobs (its rules come from it), keeps a
// name in Arabic and English, a colour, the actions of «who may do what» it may do, and the menu pages it sees. It can
// only take away from its base job, never give more. Changes go into the page's one draft (saved with the bar).
import { Copy, Lock, Pencil, Plus, Trash2, UserCog, Users } from "lucide-react";
import { useId, useState } from "react";
import { adminApi, type AdminUser } from "@/features/admin";
import { NAV, ROLES } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { BASE_JOBS, ENFORCED_ACTIONS, ROLE_COLORS, type BaseJob } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, Field, Input, Pill, Select, Textarea, TONE_CLASS, errorText, useToast } from "@/shared/ui";
import { ACTION_GROUPS, ACTIONS, baseDoes, basePages, checkRoles, duplicateRole, LIMITS, newRole, peopleWithRole, type ActionGroup } from "../rules";
import type { CustomRole } from "../types";
import { type Ctx, Note, Part } from "./controls";
import { Live } from "./parts-rules";

const jobName = (j: BaseJob | "ceo" | "admin", tr: Ctx["tr"]) => tr(ROLES[j].ar, ROLES[j].en);

/** A role's name as a coloured badge. */
export function RoleBadge({ role, className }: { role: Pick<CustomRole, "name" | "name_en" | "color">; className?: string }) {
  const { tr } = useFmt();
  return (
    <Pill tone={role.color} className={cn("gap-1.5", className)}>
      <UserCog size={12} aria-hidden="true" />
      <span dir="auto">{tr(role.name || "دور جديد", role.name_en || role.name || "New role")}</span>
    </Pill>
  );
}

export function RolesPart(c: Ctx) {
  const { tr, r } = c;
  const { num } = useFmt();
  const users = useLoad(() => adminApi.users());
  const [editing, setEditing] = useState<{ role: CustomRole; isNew: boolean } | null>(null);
  const [removing, setRemoving] = useState<CustomRole | null>(null);
  const full = r.roles.length >= LIMITS.roles;
  const peopleOf = (key: string) => peopleWithRole(users.data ?? [], key);

  const put = (role: CustomRole) => c.set({ roles: r.roles.some((x) => x.key === role.key) ? r.roles.map((x) => (x.key === role.key ? role : x)) : [...r.roles, role] });

  return (
    <div className="flex flex-col gap-5">
      <Note>
        {tr(
          "الدور الجديد يبدأ مثل وظيفة موجودة، فتبقى قواعدها كلها لأصحابه، ثم تأخذ منه ما تشاء: أعمالاً من «من يحق له ماذا» وصفحات من القائمة. لا يعطي أكثر مما للوظيفة التي بدأ منها. يعطيه مسؤول النظام للحسابات من «الحسابات والفرق».",
          "A new role starts like an existing job, so its people keep all that job's rules; then you take away what you like: actions of «who may do what» and pages of the menu. It never gives more than the job it starts from. The system admin gives it to accounts in «Accounts and teams».",
        )}
      </Note>

      <Part
        title={tr("الوظائف والأدوار", "Jobs and roles")}
        sub={tr(`الأدوار التي أنشأتها: ${num(r.roles.length)} من ${LIMITS.roles}`, `Roles you made: ${num(r.roles.length)} of ${LIMITS.roles}`)}
        icon={<UserCog size={17} aria-hidden="true" className="text-accent" />}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Live />
            <Button size="sm" pill disabled={full} onClick={() => setEditing({ role: newRole("employee", r), isNew: true })}>
              <Plus size={15} aria-hidden="true" />
              {tr("دور جديد", "New role")}
            </Button>
          </span>
        }
      >
        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{tr("الوظائف الأساسية (ثابتة)", "The base jobs (fixed)")}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label={tr("الوظائف الأساسية", "The base jobs")}>
              {(["ceo", ...BASE_JOBS, "admin"] as const).map((j) => (
                <li key={j} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card-2 px-3 text-[13px] text-muted">
                  <Lock size={11} aria-hidden="true" />
                  {jobName(j, tr)}
                </li>
              ))}
            </ul>
          </div>

          {r.roles.length ? (
            <ul aria-label={tr("الأدوار التي أنشأتها", "Roles you made")} className="grid gap-3 md:grid-cols-2">
              {r.roles.map((role) => {
                const people = peopleOf(role.key).length;
                const errs = Object.keys(c.errors).some((k) => k.startsWith(`roles.${role.key}.`));
                return (
                  <li key={role.key} className={cn("relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-accent", errs ? "border-danger" : "border-line")}>
                    {/* The whole card opens the role (click anywhere); the small buttons sit above it. */}
                    <button type="button" onClick={() => setEditing({ role, isNew: false })} className="flex flex-col items-start gap-1 text-start after:absolute after:inset-0 after:content-['']" aria-label={tr(`عدّل الدور ${role.name}`, `Edit the role ${role.name_en || role.name}`)}>
                      <RoleBadge role={role} />
                      {role.description && (
                        <span dir="auto" className="mt-1 line-clamp-2 text-[13px] text-muted">
                          {role.description}
                        </span>
                      )}
                    </button>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{tr(`يبدأ مثل: ${jobName(role.base, tr)}`, `Starts like: ${jobName(role.base, tr)}`)}</span>
                      <span>{tr(`أعمال: ${role.actions.length}`, `Actions: ${role.actions.length}`)}</span>
                      <span>{tr(`صفحات: ${role.pages.length} من ${basePages(role.base).length}`, `Pages: ${role.pages.length} of ${basePages(role.base).length}`)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} aria-hidden="true" />
                        {users.data ? tr(`حسابات: ${people}`, `Accounts: ${people}`) : "…"}
                      </span>
                    </p>
                    {errs && <p className="text-xs font-medium text-danger">{tr("في هذا الدور حقول تحتاج تصحيحاً", "This role has fields to fix")}</p>}
                    <div className="relative z-10 flex gap-1 self-end">
                      <IconAction label={tr(`عدّل ${role.name}`, `Edit ${role.name_en || role.name}`)} onClick={() => setEditing({ role, isNew: false })}>
                        <Pencil size={14} aria-hidden="true" />
                      </IconAction>
                      <IconAction label={tr(`انسخ ${role.name}`, `Duplicate ${role.name_en || role.name}`)} disabled={full} onClick={() => setEditing({ role: duplicateRole(role, r.roles), isNew: true })}>
                        <Copy size={14} aria-hidden="true" />
                      </IconAction>
                      <IconAction label={tr(`احذف ${role.name}`, `Delete ${role.name_en || role.name}`)} danger onClick={() => setRemoving(role)}>
                        <Trash2 size={14} aria-hidden="true" />
                      </IconAction>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong/60 px-6 py-10 text-center">
              <UserCog size={22} aria-hidden="true" className="text-accent" />
              <p className="font-semibold">{tr("لم تنشئ أدواراً بعد", "You haven't made any roles yet")}</p>
              <p className="max-w-md text-[13px] text-muted">{tr("مثلاً: «منسق مشاريع» يبدأ مثل الموظف، بلا تسجيل مشكلات وبلا صفحة الأداء.", "For example: «Project coordinator» starts like an employee, without reporting bugs and without the performance page.")}</p>
            </div>
          )}
        </div>
      </Part>

      {editing && <RoleDialog c={c} start={editing.role} isNew={editing.isNew} onClose={() => setEditing(null)} onDone={(role) => (put(role), setEditing(null))} />}
      {removing && (
        <RemoveDialog
          c={c}
          role={removing}
          people={peopleOf(removing.key)}
          onClose={() => setRemoving(null)}
          onMoved={users.reload}
          onRemove={() => {
            c.set({ roles: r.roles.filter((x) => x.key !== removing.key) });
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function IconAction({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors disabled:opacity-40", danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-chip hover:text-text")}
    >
      {children}
    </button>
  );
}

/** Make or change a role: names, description, colour, the job it starts like, its actions and its pages. */
function RoleDialog({ c, start, isNew, onClose, onDone }: { c: Ctx; start: CustomRole; isNew: boolean; onClose: () => void; onDone: (r: CustomRole) => void }) {
  const { tr } = c;
  const [v, setV] = useState<CustomRole>(start);
  const id = useId();
  // The checks of the whole list, with this role in it (names must differ from the other roles).
  const others = c.r.roles.filter((x) => x.key !== v.key);
  const all = checkRoles([...others, v]);
  const err = (f: string) => {
    const e = all[`roles.${v.key}.${f}`];
    return e ? tr(e.ar, e.en) : undefined;
  };
  const blocking = Object.keys(all).some((k) => k.startsWith(`roles.${v.key}.`));
  const changeBase = (base: BaseJob) => setV({ ...newRole(base, c.r), key: v.key, name: v.name, name_en: v.name_en, description: v.description, color: v.color });
  const groups = Object.keys(ACTION_GROUPS) as ActionGroup[];
  const pages = NAV.filter((n) => basePages(v.base).includes(n.key));
  const toggle = <T,>(list: T[], x: T, on: boolean) => (on ? [...list, x] : list.filter((y) => y !== x));

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? tr("دور جديد", "New role") : tr(`تعديل الدور: ${start.name}`, `Edit the role: ${start.name_en || start.name}`)}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button disabled={blocking} onClick={() => onDone({ ...v, name: v.name.trim(), name_en: v.name_en.trim(), description: v.description?.trim() || undefined })}>
            {isNew ? tr("أضف الدور", "Add the role") : tr("تم", "Done")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl bg-card-2 px-4 py-3">
          <span className="text-xs text-muted">{tr("هكذا يظهر:", "It shows like this:")}</span>
          <RoleBadge role={v} />
          <span className="text-xs text-faint">{tr(`مثل ${jobName(v.base, tr)}`, `like ${jobName(v.base, tr).toLowerCase()}`)}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("الاسم بالعربية", "Name in Arabic")} htmlFor={`${id}-name`} error={err("name")}>
            <Input id={`${id}-name`} value={v.name} maxLength={LIMITS.roleName} onChange={(e) => setV({ ...v, name: e.target.value })} invalid={!!err("name")} placeholder={tr("مثلاً: منسق مشاريع", "e.g. منسق مشاريع")} />
          </Field>
          <Field label={tr("الاسم بالإنجليزية", "Name in English")} htmlFor={`${id}-name-en`} error={err("name_en")}>
            <Input id={`${id}-name-en`} dir="ltr" value={v.name_en} maxLength={LIMITS.roleName} onChange={(e) => setV({ ...v, name_en: e.target.value })} invalid={!!err("name_en")} placeholder="e.g. Project coordinator" />
          </Field>
          <Field label={tr("وصف قصير (اختياري)", "Short description (optional)")} htmlFor={`${id}-desc`} error={err("description")} className="sm:col-span-2">
            <Textarea id={`${id}-desc`} value={v.description ?? ""} maxLength={LIMITS.roleDescription} onChange={(e) => setV({ ...v, description: e.target.value })} className="min-h-16" />
          </Field>
          <Field
            label={tr("يبدأ مثل", "Starts like")}
            htmlFor={`${id}-base`}
            hint={isNew ? tr("يأخذ عمود هذه الوظيفة وصفحاتها، ثم تغيّر ما تشاء", "It takes this job's column and pages; then change what you like") : tr("لا تتغير بعد الإنشاء: قواعد أصحابه تأتي منها", "It can't change after it is made: its people's rules come from it")}
          >
            <Select id={`${id}-base`} value={v.base} disabled={!isNew} onChange={(e) => changeBase(e.target.value as BaseJob)}>
              {BASE_JOBS.map((j) => (
                <option key={j} value={j}>
                  {jobName(j, tr)}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{tr("اللون", "Colour")}</legend>
            <div role="radiogroup" aria-label={tr("لون الدور", "The role's colour")} className="flex flex-wrap gap-2">
              {ROLE_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  role="radio"
                  aria-checked={v.color === col}
                  aria-label={tr(`لون ${COLOR_WORDS[col].ar}`, `${COLOR_WORDS[col].en} colour`)}
                  onClick={() => setV({ ...v, color: col })}
                  className={cn("size-9 rounded-full border-2 transition-transform", TONE_CLASS[col].pill, v.color === col ? "scale-110 border-accent" : "border-transparent hover:scale-105")}
                />
              ))}
            </div>
          </fieldset>
        </div>

        <section aria-labelledby={`${id}-acts`} className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 id={`${id}-acts`} className="text-sm font-semibold">
              {tr("ما يحق له", "What it may do")}
            </h3>
            <span className="text-xs text-muted">{tr("«يسري الآن» = يرفضه الخادم فوراً حين تزيل العلامة", "«Now» = the server refuses it as soon as you untick it")}</span>
          </div>
          <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-faint">{tr(ACTION_GROUPS[g].ar, ACTION_GROUPS[g].en)}</p>
                {ACTIONS.filter((a) => a.group === g).map((a) => {
                  const able = baseDoes(v.base, a.key);
                  return (
                    <label key={a.key} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", able ? "cursor-pointer hover:bg-card-2" : "cursor-not-allowed text-faint")} title={able ? undefined : tr("وظيفته الأساسية لا تقوم بهذا", "Its base job doesn't do this")}>
                      <input
                        type="checkbox"
                        className="size-4 accent-(--accent)"
                        disabled={!able}
                        checked={able && v.actions.includes(a.key)}
                        onChange={(e) => setV({ ...v, actions: toggle(v.actions, a.key, e.target.checked) })}
                      />
                      <span className="min-w-0 flex-1">{tr(a.ar, a.en)}</span>
                      {able && ENFORCED_ACTIONS.includes(a.key) && <Pill tone="done">{tr("يسري الآن", "Now")}</Pill>}
                      {!able && <Lock size={12} aria-hidden="true" />}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {err("actions") && <p className="px-4 pb-3 text-xs font-medium text-danger">{err("actions")}</p>}
        </section>

        <section aria-labelledby={`${id}-pages`} className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 id={`${id}-pages`} className="text-sm font-semibold">
              {tr("الصفحات التي يراها في القائمة", "The pages it sees in the menu")}
            </h3>
            <Pill tone="done">{tr("يسري الآن", "Now")}</Pill>
          </div>
          <div className="grid gap-1 p-4 sm:grid-cols-3">
            {pages.map((n) => (
              <label key={n.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-card-2">
                <input type="checkbox" className="size-4 accent-(--accent)" checked={v.pages.includes(n.key)} onChange={(e) => setV({ ...v, pages: toggle(v.pages, n.key, e.target.checked) })} />
                {tr(n.ar, n.en)}
              </label>
            ))}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
            {tr(
              `فقط صفحات «${jobName(v.base, tr)}». الصفحة المزالة تختفي من قائمته الآن؛ أما منع فتحها برابط مباشر فيأتي لاحقاً.`,
              `Only the pages of «${jobName(v.base, tr)}». A page you remove leaves the menu now; refusing it by a direct link comes later.`,
            )}
          </p>
        </section>
      </div>
    </Dialog>
  );
}

const COLOR_WORDS: Record<CustomRole["color"], { ar: string; en: string }> = {
  todo: { ar: "بنفسجي", en: "Violet" },
  progress: { ar: "عنابي", en: "Wine" },
  review: { ar: "كهرماني", en: "Amber" },
  testing: { ar: "أزرق", en: "Blue" },
  done: { ar: "أخضر", en: "Green" },
  new: { ar: "رمادي", en: "Grey" },
};

/**
 * Removing a role. While active accounts have it, it can't go: the dialog lists them and moves them all to another job
 * or role first (the admin's call, which the CEO may make too).
 */
function RemoveDialog({ c, role, people, onClose, onMoved, onRemove }: { c: Ctx; role: CustomRole; people: AdminUser[]; onClose: () => void; onMoved: () => void; onRemove: () => void }) {
  const { tr } = c;
  const { lang } = useFmt();
  const toast = useToast();
  const id = useId();
  const targets = c.r.roles.filter((x) => x.key !== role.key);
  const [to, setTo] = useState<string>(role.base);
  const [busy, setBusy] = useState(false);

  async function move() {
    const custom = targets.find((x) => `custom:${x.key}` === to);
    setBusy(true);
    try {
      for (const u of people) await adminApi.updateUser(u.id, custom ? { role: custom.base, custom_role: custom.key } : { role: to as BaseJob, custom_role: null });
      toast(tr(`نُقل ${people.length} من الأشخاص.`, `${people.length} people moved.`));
      onMoved();
    } catch (e) {
      toast(errorText(e, tr), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={tr(`حذف الدور «${role.name}»`, `Delete the role "${role.name_en || role.name}"`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button disabled={people.length > 0} onClick={onRemove} className="bg-danger text-card hover:bg-danger/90">
            {tr("احذف الدور", "Delete the role")}
          </Button>
        </>
      }
    >
      {people.length ? (
        <div className="flex flex-col gap-3 text-sm">
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
            {tr(`لا يُحذف: لهذا الدور ${people.length} من الحسابات النشطة. انقلهم إلى وظيفة أو دور آخر أولاً.`, `It can't go yet: ${people.length} active accounts have this role. Move them to another job or role first.`)}
          </p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-line bg-card-2 px-4 py-2 text-[13px]">
            {people.map((u) => (
              <li key={u.id} className="py-0.5">
                {lang === "en" && u.name_en ? u.name_en : u.name}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={tr("انقلهم إلى", "Move them to")} htmlFor={`${id}-to`} className="min-w-48 flex-1">
              <Select id={`${id}-to`} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value={role.base}>{tr(`${jobName(role.base, tr)} (وظيفته الأساسية)`, `${jobName(role.base, tr)} (its base job)`)}</option>
                {targets.map((x) => (
                  <option key={x.key} value={`custom:${x.key}`}>
                    {tr(x.name, x.name_en || x.name)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" disabled={busy} onClick={move} className="h-11">
              {tr(`انقل ${people.length}`, `Move ${people.length}`)}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm">{tr("لا حساب نشطاً له هذا الدور. يُحذف من الأدوار عند الحفظ، ويُكتب في السجل.", "No active account has this role. It goes when you save, and the history keeps it.")}</p>
      )}
    </Dialog>
  );
}
