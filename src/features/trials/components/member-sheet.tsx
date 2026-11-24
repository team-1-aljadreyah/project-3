import { Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Dialog, errorText, Field, Textarea, useToast } from "@/shared/ui";
import { TONE_CLASS } from "@/shared/ui";
import { trialsApi } from "../api";
import { DECISION_WORDS, DECISIONS, scoreText, TRIAL_LIMITS as L } from "../rules";
import type { TrialEntry, TrialMemberRow } from "../types";
import { StarPicker, Stars } from "./stars";

/**
 * One person on trial: their details, the decision (being assessed, kept, not kept), a new rating and/or note, and
 * everything written about them, newest first. Ratings and notes are hers only (the client: nobody else sees them).
 */
export function MemberSheet({
  member,
  entries,
  ended,
  onClose,
  onChanged,
  onEdit,
}: {
  member: TrialMemberRow;
  entries: TrialEntry[];
  ended: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const { tr, num, day, ago } = useFmt();
  const toast = useToast();
  const [score, setScore] = useState<number>();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const mine = entries.filter((e) => e.member_id === member.id);

  const run = async (job: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setErrors({});
    try {
      await job();
      if (done) toast(done);
      onChanged();
      return true;
    } catch (e) {
      setErrors(e instanceof ApiError && e.errors ? e.errors : { form: errorText(e, tr) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!score && !text.trim()) return setErrors({ text: tr("اختر درجة أو اكتب ملاحظة.", "Choose a score or write a note.") });
    const ok = await run(() => trialsApi.addEntry(member.id, { score, text: text.trim() || undefined }), tr("حُفظ.", "Saved."));
    if (ok) {
      setScore(undefined);
      setText("");
    }
  };

  return (
    <Dialog open onClose={onClose} title={member.name} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        {/* Who they are, and how they are doing. */}
        <div className="flex flex-wrap items-center gap-3.5">
          <Avatar user={{ id: 1000 + member.id, name: member.name }} size="xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-medium">{member.specialty}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>{tr(`انضم ${day(member.joined_on)}`, `Joined ${day(member.joined_on)}`)}</span>
              {member.phone && (
                <a href={`tel:${member.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-text">
                  <Phone size={12} aria-hidden="true" />
                  {member.phone}
                </a>
              )}
              {member.email && (
                <a href={`mailto:${member.email}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-text">
                  <Mail size={12} aria-hidden="true" />
                  {member.email}
                </a>
              )}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Stars value={member.average} />
              <span className="text-muted">
                {member.average !== undefined ? tr(`${scoreText(member.average)} من 5 · ${num(member.scores)} تقييم`, `${scoreText(member.average)} of 5 · ${member.scores} ratings`) : tr("لم يُقيَّم بعد", "Not rated yet")}
              </span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />
            {tr("البيانات", "Details")}
          </Button>
        </div>

        {/* The decision: three choices in one row. */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{tr("القرار", "Decision")}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-chip/60 p-1">
            {DECISIONS.map((d) => {
              const on = member.decision === d;
              return (
                <label
                  key={d}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-center text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent",
                    on ? cn("font-semibold shadow-sm", TONE_CLASS[DECISION_WORDS[d].tone]) : "text-muted hover:bg-card hover:text-text",
                  )}
                >
                  <input
                    type="radio"
                    name="trial-decision"
                    value={d}
                    checked={on}
                    disabled={busy}
                    onChange={() => void run(() => trialsApi.updateMember(member.id, { decision: d }), tr(`القرار: ${DECISION_WORDS[d].ar}`, `Decision: ${DECISION_WORDS[d].en}`))}
                    className="sr-only"
                  />
                  {tr(DECISION_WORDS[d].ar, DECISION_WORDS[d].en)}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* A new rating and/or note. */}
        <form
          noValidate
          className="flex flex-col gap-3 rounded-xl border border-line bg-card-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <h3 className="text-sm font-semibold">{tr("تقييم أو ملاحظة جديدة", "A new rating or note")}</h3>
          {ended && <p className="text-xs text-muted">{tr("انتهت التجربة، ويمكنك ما زلت إضافة ملاحظة أخيرة.", "The trial has ended; you can still add a last note.")}</p>}
          <StarPicker value={score} onChange={setScore} />
          <Field label={tr("ملاحظة (اختياري مع الدرجة)", "A note (optional with a score)")} htmlFor="te-text" error={errors.text}>
            <Textarea
              id="te-text"
              rows={3}
              maxLength={L.text}
              value={text}
              invalid={!!errors.text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tr("ما الذي أحسنه أو يحتاج إلى تحسينه؟", "What did they do well, or need to improve?")}
            />
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {errors.form}
            </p>
          )}
          <Button type="submit" disabled={busy} className="self-end">
            {tr("احفظ", "Save")}
          </Button>
        </form>

        {/* Everything written about them. */}
        <section aria-labelledby="te-history" className="flex flex-col gap-2">
          <h3 id="te-history" className="text-sm font-semibold">
            {tr(`السجل (${num(mine.length)})`, `History (${mine.length})`)}
          </h3>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">{tr("لا تقييمات ولا ملاحظات بعد.", "No ratings or notes yet.")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {mine.map((e) => (
                <li key={e.id} className="group flex items-start gap-3 rounded-xl border border-line bg-card p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {e.score && <Stars value={e.score} size={13} />}
                      <time dateTime={e.at}>{ago(e.at)}</time>
                    </p>
                    {e.text && (
                      <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                        {e.text}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => trialsApi.removeEntry(e.id), tr("حُذف.", "Removed."))}
                    aria-label={tr("احذف هذا السطر", "Remove this line")}
                    className="rounded-full p-1.5 text-faint opacity-60 hover:bg-chip hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
          {removing ? (
            <div role="alert" className="flex flex-1 flex-wrap items-center gap-2">
              <p className="min-w-40 flex-1 text-danger">{tr(`أتريد حذف ${member.name} من الفريق مع تقييماته وملاحظاته؟`, `Remove ${member.name} from the team, with their ratings and notes?`)}</p>
              <Button size="sm" variant="secondary" onClick={() => setRemoving(false)}>
                {tr("لا", "No")}
              </Button>
              <Button
                size="sm"
                className="bg-danger text-card hover:bg-danger hover:opacity-90"
                disabled={busy}
                onClick={async () => {
                  if (await run(() => trialsApi.removeMember(member.id), tr("حُذف العضو.", "Member removed."))) onClose();
                }}
              >
                {tr("نعم، احذفه", "Yes, remove")}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(true)}>
              <Trash2 size={14} aria-hidden="true" />
              {tr("احذف من الفريق", "Remove from the team")}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
