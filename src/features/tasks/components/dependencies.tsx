import { Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isDone, type Project } from "@/features/projects";
import { useFmt } from "@/shared/lib/i18n";
import { matches } from "@/shared/lib/utils";
import { Button, Dialog, errorText, IconButton, Input, StatusPill, useToast } from "@/shared/ui";
import { tasksApi } from "../api";
import { LIMITS, makesLoop, openDependencies, statusOf, waitingOn } from "../rules";
import type { Task } from "../types";

/**
 * Task dependencies (the brief: "a task waits for another one"): what this task waits for, and what waits for it.
 * While anything it waits for isn't done, it can't be marked done. The PM and team leaders change the list.
 */
export function Dependencies({ task, project, tasks, canEdit, onSaved }: { task: Task; project: Project; tasks: Task[]; canEdit: boolean; onSaved: () => void }) {
  const { tr } = useFmt();
  const [editing, setEditing] = useState(false);
  const waitsFor = tasks.filter((t) => task.depends_on?.includes(t.id));
  const blocks = waitingOn(task, tasks);
  const open = openDependencies(project, task, tasks);

  const row = (t: Task) => {
    const status = statusOf(project, t.status);
    return (
      <li key={t.id}>
        <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-chip">
          <span dir="ltr" className="num shrink-0 text-xs text-muted">
            {t.code}
          </span>
          <span dir="auto" className="min-w-0 flex-1 truncate">
            {t.title}
          </span>
          {status && <StatusPill status={status} />}
        </Link>
      </li>
    );
  };

  return (
    <section aria-labelledby="deps-title" className="rounded-xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="deps-title" className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Link2 size={15} aria-hidden="true" />
          {tr("التبعيات", "Dependencies")}
        </h2>
        {canEdit && (
          <IconButton label={tr("عدّل ما تنتظره المهمة", "Change what the task waits for")} onClick={() => setEditing(true)} className="bg-transparent">
            <Pencil size={15} aria-hidden="true" />
          </IconButton>
        )}
      </div>
      {open.length > 0 && (
        <p className="mb-2 rounded-lg bg-chip px-3 py-2 text-xs text-muted">
          {tr("لا يمكن إكمال هذه المهمة قبل إنجاز ما تنتظره.", "This task can't be done before the tasks it waits for.")}
        </p>
      )}
      <h3 className="mt-1 text-xs font-medium text-faint">{tr("تنتظر", "Waits for")}</h3>
      {waitsFor.length ? <ul className="flex flex-col">{waitsFor.map(row)}</ul> : <p className="px-2 py-1.5 text-sm text-faint">{tr("لا شيء.", "Nothing.")}</p>}
      <h3 className="mt-2 text-xs font-medium text-faint">{tr("مهام تنتظرها", "Waited for by")}</h3>
      {blocks.length ? <ul className="flex flex-col">{blocks.map(row)}</ul> : <p className="px-2 py-1.5 text-sm text-faint">{tr("لا شيء.", "Nothing.")}</p>}

      {editing && <EditDependencies task={task} project={project} tasks={tasks} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </section>
  );
}

/** Choosing what the task waits for: the project's other tasks, with a search. A choice that makes a loop is refused. */
function EditDependencies({ task, project, tasks, onClose, onSaved }: { task: Task; project: Project; tasks: Task[]; onClose: () => void; onSaved: () => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const [chosen, setChosen] = useState<number[]>(task.depends_on ?? []);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Not itself, and not a task that already waits for it (directly or through others): that would be a loop.
  const choices = tasks.filter((t) => t.id !== task.id && !makesLoop(task.id, [t.id], tasks) && matches(q, t.code, t.title));
  const toggle = (id: number) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await tasksApi.setDependencies(task.id, chosen);
      toast(tr("حُفظت التبعيات.", "Dependencies saved."));
      onClose();
      onSaved();
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tr(`ما تنتظره ${task.code}`, `What ${task.code} waits for`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy || chosen.length > LIMITS.dependencies}>
            {tr("احفظ", "Save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("ابحث بالرمز أو العنوان", "Search by code or title")} aria-label={tr("ابحث عن مهمة", "Search for a task")} />
        <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {choices.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-chip">
                <input type="checkbox" checked={chosen.includes(t.id)} onChange={() => toggle(t.id)} className="size-4 accent-[var(--accent)]" />
                <span dir="ltr" className="num shrink-0 text-xs text-muted">
                  {t.code}
                </span>
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {t.title}
                </span>
                {isDone(project, t) && <span className="text-xs text-faint">{tr("مكتملة", "done")}</span>}
              </label>
            </li>
          ))}
          {choices.length === 0 && <li className="p-4 text-center text-sm text-muted">{tr("لا مهام مطابقة.", "No matching tasks.")}</li>}
        </ul>
        <p className="text-xs text-muted">
          {tr(`اختر حتى ${LIMITS.dependencies} مهام. المهام التي تنتظر هذه المهمة لا تظهر (كي لا تنتظر كلٌّ من المهمتين الأخرى).`, `Choose up to ${LIMITS.dependencies} tasks. Tasks that wait for this one are left out (so no two tasks wait for each other).`)}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
