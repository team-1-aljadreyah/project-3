import { arN, G } from "@/shared/lib/count-words";
import { useState } from "react";
import { moveTargets, projectsApi, type Sprint, type SprintNumbers } from "@/features/projects";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, errorText, useToast } from "@/shared/ui";

/**
 * Ending a sprint (the brief: unfinished tasks at the end of a sprint need handling). It shows what was done and what
 * is left, and asks where the unfinished tasks go: the next open sprint (chosen first) or back to the backlog.
 */
export function EndSprintDialog({
  sprint,
  sprints,
  numbers,
  onClose,
  onDone,
}: {
  sprint: Sprint | null;
  sprints: Sprint[];
  numbers?: SprintNumbers;
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr, num, day } = useFmt();
  const toast = useToast();
  const targets = sprint ? moveTargets(sprints, sprint) : [];
  // "" = the backlog; otherwise a sprint id. The soonest open sprint is the usual choice.
  const [choice, setChoice] = useState<string | null>(null);
  const picked = choice ?? (targets[0] ? String(targets[0].id) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const end = async () => {
    if (!sprint) return;
    setBusy(true);
    setError(undefined);
    try {
      await projectsApi.closeSprint(sprint.id, { move_to: picked ? Number(picked) : null });
      toast(tr(`انتهت «${sprint.name}».`, `"${sprint.name}" ended.`));
      setChoice(null);
      onDone();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const left = numbers?.left ?? 0;
  return (
    <Dialog
      open={!!sprint}
      onClose={onClose}
      title={tr("إنهاء الدورة", "End the sprint")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={end} disabled={busy}>
            {tr("أنهِ الدورة", "End sprint")}
          </Button>
        </>
      }
    >
      {sprint && numbers && (
        <div className="flex flex-col gap-4 text-sm">
          <p>
            {tr(
              `«${sprint.name}»: أُنجز ${num(numbers.done)} من ${arN(numbers.planned, G.task)}، وبقي ${num(left)}.`,
              `"${sprint.name}": ${numbers.done} of ${numbers.planned} tasks done, ${left} left.`,
            )}
          </p>
          {left > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{tr("أين تذهب المهام غير المنجزة؟", "Where do the unfinished tasks go?")}</legend>
              {targets.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name="move_to" value={s.id} checked={picked === String(s.id)} onChange={() => setChoice(String(s.id))} className="accent-[var(--accent)]" />
                  <span>
                    {s.name} <span className="text-muted">({day(s.start)} – {day(s.end)})</span>
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="move_to" value="" checked={picked === ""} onChange={() => setChoice("")} className="accent-[var(--accent)]" />
                {tr("قائمة الانتظار (بلا دورة)", "The backlog (no sprint)")}
              </label>
              {targets.length === 0 && (
                <p className="text-xs text-muted">{tr("لا توجد دورة مفتوحة أخرى. أضف واحدة من الإعدادات إن أردت.", "There is no other open sprint. Add one in the settings if you want.")}</p>
              )}
            </fieldset>
          ) : (
            <p className="text-muted">{tr("كل مهام الدورة منجزة.", "Every task of the sprint is done.")}</p>
          )}
          <p className="text-xs text-muted">{tr("المهام المنجزة تبقى في الدورة، وتُحفظ أرقامها. لا يمكن التراجع عن الإنهاء.", "Done tasks stay in the sprint and its numbers are kept. Ending can't be undone.")}</p>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
