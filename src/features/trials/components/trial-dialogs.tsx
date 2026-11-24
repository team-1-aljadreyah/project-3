import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { today } from "@/shared/lib/utils";
import { Button, Dialog, errorText, Field, Input, Textarea, useToast } from "@/shared/ui";
import { trialsApi } from "../api";
import { TRIAL_LIMITS as L } from "../rules";
import type { TrialMember, TrialTeam } from "../types";

/** Runs a save: the field errors under their fields, anything else at the bottom. */
function useSave(onDone: () => void) {
  const { tr } = useFmt();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async (job: () => Promise<unknown>) => {
    setBusy(true);
    setErrors({});
    try {
      await job();
      onDone();
    } catch (e) {
      setErrors(e instanceof ApiError && e.errors ? e.errors : { form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };
  return { errors, busy, run };
}

function FormError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {text}
    </p>
  );
}

/** A new trial team, or changing one: its name, what it is for, and the day it started. */
export function TrialTeamDialog({ team, onClose, onSaved }: { team?: TrialTeam; onClose: () => void; onSaved: (team: TrialTeam) => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const [v, setV] = useState({ name: team?.name ?? "", goal: team?.goal ?? "", started_on: team?.started_on ?? today() });
  const { errors, busy, run } = useSave(onClose);
  const save = () =>
    run(async () => {
      const saved = team ? await trialsApi.updateTeam(team.id, v) : await trialsApi.createTeam(v);
      toast(team ? tr("حُفظ الفريق التجريبي.", "Trial team saved.") : tr("أُنشئ الفريق التجريبي. أضف أعضاءه الآن.", "Trial team made. Add its people now."));
      onSaved(saved);
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title={team ? tr("تعديل الفريق التجريبي", "Edit the trial team") : tr("فريق تجريبي جديد", "New trial team")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {team ? tr("احفظ", "Save") : tr("أنشئ الفريق", "Make the team")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={tr("اسم الفريق", "Team name")} htmlFor="tr-name" error={errors.name}>
          <Input id="tr-name" maxLength={L.name} value={v.name} invalid={!!errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={tr("مثلاً: فريق تطبيق الجوال", "For example: the mobile app team")} />
        </Field>
        <Field label={tr("الهدف من التجربة (اختياري)", "What the trial is for (optional)")} htmlFor="tr-goal" error={errors.goal}>
          <Textarea id="tr-goal" rows={3} maxLength={L.goal} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} />
        </Field>
        <Field label={tr("يوم بدء التجربة", "First day of the trial")} htmlFor="tr-start" error={errors.started_on}>
          <Input id="tr-start" type="date" dir="ltr" max={today()} value={v.started_on} invalid={!!errors.started_on} onChange={(e) => setV({ ...v, started_on: e.target.value })} />
        </Field>
        <FormError text={errors.form} />
      </form>
    </Dialog>
  );
}

/** A new person on trial, or changing their details (they are not accounts: nothing is sent to them). */
export function TrialMemberDialog({ teamId, member, onClose, onSaved }: { teamId: number; member?: TrialMember; onClose: () => void; onSaved: () => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const [v, setV] = useState({ name: member?.name ?? "", specialty: member?.specialty ?? "", phone: member?.phone ?? "", email: member?.email ?? "", joined_on: member?.joined_on ?? today() });
  const { errors, busy, run } = useSave(onClose);
  const save = () =>
    run(async () => {
      if (member) await trialsApi.updateMember(member.id, v);
      else await trialsApi.addMember(teamId, v);
      toast(member ? tr("حُفظت البيانات.", "Saved.") : tr(`أُضيف ${v.name.trim()} إلى الفريق.`, `${v.name.trim()} was added to the team.`));
      onSaved();
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title={member ? tr(`بيانات ${member.name}`, `${member.name}'s details`) : tr("عضو جديد", "New member")}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {member ? tr("احفظ", "Save") : tr("أضف العضو", "Add the member")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={tr("الاسم", "Name")} htmlFor="tm-name" error={errors.name}>
          <Input id="tm-name" maxLength={L.member} value={v.name} invalid={!!errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label={tr("التخصص أو العمل", "What they do")} htmlFor="tm-spec" error={errors.specialty}>
          <Input id="tm-spec" maxLength={L.specialty} value={v.specialty} invalid={!!errors.specialty} onChange={(e) => setV({ ...v, specialty: e.target.value })} placeholder={tr("مثلاً: مطوّر واجهات", "For example: front-end developer")} />
        </Field>
        <Field label={tr("الهاتف (اختياري)", "Phone (optional)")} htmlFor="tm-phone" error={errors.phone}>
          <Input id="tm-phone" type="tel" dir="ltr" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
        <Field label={tr("البريد (اختياري)", "Email (optional)")} htmlFor="tm-email" error={errors.email}>
          <Input id="tm-email" type="email" dir="ltr" value={v.email} invalid={!!errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field label={tr("انضم في", "Joined on")} htmlFor="tm-joined" error={errors.joined_on}>
          <Input id="tm-joined" type="date" dir="ltr" max={today()} value={v.joined_on} invalid={!!errors.joined_on} onChange={(e) => setV({ ...v, joined_on: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <FormError text={errors.form} />
        </div>
      </form>
    </Dialog>
  );
}
