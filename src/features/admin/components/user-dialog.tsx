import { Trash2 } from "lucide-react";
import { useState } from "react";
import { canRemovePicture, profileApi } from "@/features/profile";
import { ApiError } from "@/shared/api";
import type { Role, Team } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { updateSessionUser, useUser } from "@/shared/lib/session";
import { Avatar, Button, Dialog, errorText, Field, Input, Select, useToast } from "@/shared/ui";
import { adminApi } from "../api";
import { ROLES as ROLE_WORDS } from "@/shared/lib/access";
import { isLocked, ROLE_KEYS } from "../rules";
import type { AdminUser, UserInput } from "../types";

/** Adding a user, or changing one: name, email, role, title, team; stopping or restarting the account; unlocking it. */
export function UserDialog({ user, teams, me, onClose, onSaved }: { user?: AdminUser; teams: Team[]; me: number; onClose: () => void; onSaved: () => void }) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [v, setV] = useState<UserInput>({
    name: user?.name ?? "",
    name_en: user?.name_en ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "employee",
    title: user?.title ?? "",
    team_id: user?.team_id ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof UserInput>(k: K, value: UserInput[K]) => setV((o) => ({ ...o, [k]: value }));
  const self = user?.id === me;
  const actor = useUser();
  const [confirmPicture, setConfirmPicture] = useState(false);

  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setErrors({});
    try {
      await job();
      toast(done);
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setErrors({ form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(() => (user ? adminApi.updateUser(user.id, v) : adminApi.createUser(v)), user ? tr("حُفظ المستخدم.", "User saved.") : tr("أُضيف المستخدم.", "User added."));

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? tr(`تعديل ${user.name}`, `Edit ${user.name_en ?? user.name}`) : tr("مستخدم جديد", "New user")}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {tr("احفظ", "Save")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={tr("الاسم", "Name")} htmlFor="u-name" error={errors.name}>
          <Input id="u-name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={tr("الاسم بالإنجليزية", "Name in English")} htmlFor="u-name-en">
          <Input id="u-name-en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        </Field>
        <Field label={tr("البريد الإلكتروني", "Email")} htmlFor="u-email" error={errors.email}>
          <Input id="u-email" type="email" dir="ltr" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label={tr("الهاتف (اختياري)", "Phone (optional)")} htmlFor="u-phone">
          <Input id="u-phone" type="tel" dir="ltr" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={tr("الدور", "Role")} htmlFor="u-role" error={errors.role}>
          <Select id="u-role" value={v.role} disabled={self} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {tr(ROLE_WORDS[r].ar, ROLE_WORDS[r].en)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("المسمى الوظيفي", "Job title")} htmlFor="u-title" error={errors.title}>
          <Input id="u-title" value={v.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label={tr("الفريق", "Team")} htmlFor="u-team" error={errors.team_id}>
          <Select id="u-team" value={v.team_id ?? ""} onChange={(e) => set("team_id", e.target.value ? Number(e.target.value) : null)}>
            <option value="">{tr("بلا فريق", "No team")}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {lang === "en" && t.name_en ? t.name_en : t.name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
      {user?.avatar_url && canRemovePicture(actor, user) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
          <Avatar user={user} size="xl" />
          {confirmPicture ? (
            <div role="alert" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <p className="min-w-40 flex-1 text-danger">
                {self
                  ? tr("أتريد إزالة صورتك؟", "Remove your picture?")
                  : tr(`أتريد إزالة صورة ${user.name}؟ سيظهر الحرف الأول من اسمه، ويُسجَّل ذلك في سجل العمليات.`, `Remove ${user.name_en ?? user.name}'s picture? Their initial shows instead, and the audit log records it.`)}
              </p>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmPicture(false)}>
                {tr("أبقِها", "Keep it")}
              </Button>
              <Button
                size="sm"
                className="bg-danger text-card hover:bg-danger hover:opacity-90"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (self) updateSessionUser(await profileApi.removeMyPicture());
                    else await profileApi.removePictureOf(user.id);
                  }, tr("أُزيلت الصورة.", "Picture removed."))
                }
              >
                {tr("نعم، أزِلها", "Yes, remove it")}
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="text-danger" disabled={busy} onClick={() => setConfirmPicture(true)}>
                <Trash2 size={15} aria-hidden="true" />
                {tr("أزل الصورة", "Remove picture")}
              </Button>
              <span className="min-w-40 flex-1 text-xs text-muted">{tr("لصورة غير لائقة. يستطيع صاحبها وضع صورة جديدة.", "For a picture that is not appropriate. The person can set a new one.")}</span>
            </>
          )}
        </div>
      )}
      {user && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
          {isLocked(user, new Date().toISOString()) && (
            <Button variant="secondary" disabled={busy} onClick={() => run(() => adminApi.updateUser(user.id, { unlock: true }), tr("فُتح الحساب.", "Account unlocked."))}>
              {tr("افتح الحساب المقفل", "Unlock the account")}
            </Button>
          )}
          {!self &&
            (user.active ? (
              <Button variant="secondary" disabled={busy} className="text-danger" onClick={() => run(() => adminApi.updateUser(user.id, { active: false }), tr("أُوقف الحساب.", "Account stopped."))}>
                {tr("أوقف الحساب", "Stop the account")}
              </Button>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => run(() => adminApi.updateUser(user.id, { active: true }), tr("أُعيد تشغيل الحساب.", "Account restarted."))}>
                {tr("أعد تشغيل الحساب", "Restart the account")}
              </Button>
            ))}
          <span className="text-xs text-muted">{tr("لا يُحذف أي حساب: الإيقاف يمنع الدخول ويبقي سجله.", "No account is deleted: stopping blocks sign-in and keeps its history.")}</span>
        </div>
      )}
      {errors.form && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors.form}
        </p>
      )}
    </Dialog>
  );
}
