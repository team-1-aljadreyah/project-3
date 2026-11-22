import { KeyRound } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { PASSWORD_MIN_DEFAULT, passwordProblem } from "@/shared/lib/password";
import { useSiteLive } from "@/shared/lib/site";
import { Button, errorText, Field, PasswordInput, useToast } from "@/shared/ui";
import { profileApi } from "../api";

/**
 * "Change my password", for everyone, in their profile: the current password, the new one (as long as the CEO's
 * setting asks, at least), and the new one again. Closed until pressed, so the profile stays short.
 */
export function ChangePassword() {
  const { tr } = useFmt();
  const toast = useToast();
  const min = useSiteLive().password_min ?? PASSWORD_MIN_DEFAULT;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setAgain("");
    setErrors({});
  };

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!current) problems.current_password = tr("اكتب كلمة مرورك الحالية.", "Enter your current password.");
    const p = passwordProblem(next, min);
    if (p) problems.password = tr(p.ar, p.en);
    else if (next === current) problems.password = tr("اختر كلمة مرور غير الحالية.", "Choose a password other than the current one.");
    if (!problems.password && next !== again) problems.password_again = tr("الكلمتان غير متطابقتين.", "The two don't match.");
    if (Object.keys(problems).length) return setErrors(problems);
    setBusy(true);
    try {
      await profileApi.changeMyPassword(current, next);
      toast(tr("تغيّرت كلمة المرور.", "Your password was changed."));
      reset();
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setErrors({ form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-card-2 p-4 text-start transition-colors hover:border-accent"
      >
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <KeyRound size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{tr("غيّر كلمة المرور", "Change your password")}</span>
          <span className="text-xs text-muted">{tr(`${min} أحرف على الأقل`, `At least ${min} characters`)}</span>
        </span>
      </button>
    );
  }

  return (
    <section aria-labelledby="change-password-h" className="flex flex-col gap-3 rounded-xl border border-line bg-card-2 p-4">
      <h3 id="change-password-h" className="flex items-center gap-2 font-medium">
        <KeyRound size={16} aria-hidden="true" className="text-accent" />
        {tr("غيّر كلمة المرور", "Change your password")}
      </h3>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={tr("كلمة المرور الحالية", "Current password")} htmlFor="pw-current" error={errors.current_password}>
          <PasswordInput id="pw-current" value={current} onChange={setCurrent} invalid={!!errors.current_password} autoComplete="current-password" />
        </Field>
        <Field label={tr("كلمة المرور الجديدة", "New password")} hint={tr(`${min} أحرف على الأقل`, `At least ${min} characters`)} htmlFor="pw-new" error={errors.password}>
          <PasswordInput id="pw-new" value={next} onChange={setNext} invalid={!!errors.password} />
        </Field>
        <Field label={tr("أعد كتابة الجديدة", "The new one again")} htmlFor="pw-again" error={errors.password_again}>
          <PasswordInput id="pw-again" value={again} onChange={setAgain} invalid={!!errors.password_again} />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ كلمة المرور", "Save the password")}
          </Button>
        </div>
      </form>
    </section>
  );
}
