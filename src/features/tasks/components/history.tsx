import { Avatar, PRIORITY, PersonName } from "@/shared/ui";
import type { Project } from "@/features/projects";
import type { Priority, User } from "@/shared/api/types";
import { useFmt, type Fmt } from "@/shared/lib/i18n";
import { statusOf } from "../rules";
import type { TaskEvent } from "../types";

/** One history line in words: "نقلها من «قيد التنفيذ» إلى «قيد المراجعة»". */
function eventText(e: TaskEvent, fmt: Fmt, project: Pick<Project, "statuses" | "phases">, people: Map<number, User>) {
  const { tr, lang, day } = fmt;
  const status = (key?: string) => {
    const s = key ? statusOf(project, key) : undefined;
    return `«${s ? (lang === "en" ? s.name_en : s.name) : key ?? "-"}»`;
  };
  const person = (id?: string) => {
    const u = id ? people.get(Number(id)) : undefined;
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const phase = (id?: string) => `«${project.phases.find((ph) => String(ph.id) === id)?.name ?? "-"}»`;
  const priority = (p?: string) => (p && p in PRIORITY ? tr(PRIORITY[p as Priority].ar, PRIORITY[p as Priority].en) : "-");

  switch (e.kind) {
    case "created":
      return tr("أنشأ المهمة", "created the task");
    case "status":
      return tr(`نقلها من ${status(e.from)} إلى ${status(e.to)}`, `moved it from ${status(e.from)} to ${status(e.to)}`);
    case "blocked":
      return tr("أوقفها", "blocked it");
    case "unblocked":
      return tr(`أعادها من التوقف إلى ${status(e.to)}`, `unblocked it to ${status(e.to)}`);
    case "approval_requested":
      return tr("طلب اعتماد إكمالها", "asked to approve it as done");
    case "approved":
      return tr("اعتمد إكمالها", "approved it as done");
    case "rejected":
      return tr(`لم يعتمد إكمالها، وأعادها إلى ${status(e.to)}`, `sent it back to ${status(e.to)}`);
    case "assignee":
      return e.to ? tr(`أسندها إلى ${person(e.to)}`, `assigned it to ${person(e.to)}`) : tr("ألغى إسنادها", "unassigned it");
    case "due":
      return tr(`غيّر موعد التسليم من ${e.from ? day(e.from) : "-"} إلى ${e.to ? day(e.to) : "-"}`, `changed the due date from ${e.from ? day(e.from) : "-"} to ${e.to ? day(e.to) : "-"}`);
    case "priority":
      return tr(`غيّر الأولوية إلى «${priority(e.to)}»`, `set the priority to "${priority(e.to)}"`);
    case "title":
      return tr("غيّر العنوان", "changed the title");
    case "description":
      return tr("عدّل الوصف", "edited the description");
    case "dependency_added":
      return tr(`جعلها تنتظر ${e.to ?? "-"}`, `made it wait for ${e.to ?? "-"}`);
    case "dependency_removed":
      return tr(`لم تعد تنتظر ${e.from ?? "-"}`, `it no longer waits for ${e.from ?? "-"}`);
    case "sprint":
      // from / to are the sprints' names; none = the backlog (no sprint).
      return e.to
        ? tr(`نقلها إلى الدورة «${e.to}»`, `moved it to the sprint "${e.to}"`)
        : tr(`أعادها من «${e.from ?? "-"}» إلى قائمة الانتظار`, `moved it from "${e.from ?? "-"}" back to the backlog`);
    case "phase":
      return e.to ? tr(`نقلها إلى مرحلة ${phase(e.to)}`, `moved it to the ${phase(e.to)} phase`) : tr("أخرجها من المراحل", "took it out of its phase");
    case "comment":
      return tr("أضاف تعليقاً", "commented");
    case "attachment_added":
      return tr(`أرفق الملف «${e.to ?? "-"}»`, `attached "${e.to ?? "-"}"`);
    case "attachment_removed":
      return tr(`حذف الملف «${e.from ?? "-"}»`, `removed the file "${e.from ?? "-"}"`);
  }
}

/** The task's history, newest first. Read-only: nobody can edit or hide a line (the brief). */
export function History({ events, project, people }: { events: TaskEvent[]; project: Project; people: Map<number, User> }) {
  const fmt = useFmt();
  const list = [...events].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ol className="flex flex-col">
      {list.map((e) => {
        const actor = people.get(e.actor_id);
        const name = actor ? (fmt.lang === "en" && actor.name_en ? actor.name_en : actor.name) : "-";
        return (
          <li key={e.id} className="flex gap-3 border-b border-line py-3 last:border-0">
            {actor && <Avatar user={actor} size="sm" className="mt-0.5" />}
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <p>
                <b className="font-semibold">{actor ? <PersonName person={actor} projects={[project]} /> : name}</b> {eventText(e, fmt, project, people)}
              </p>
              {e.note && <p className="text-[13px] text-muted">«{e.note}»</p>}
              <time dateTime={e.at} title={fmt.dateTime(e.at)} className="text-xs text-faint">
                {fmt.ago(e.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
