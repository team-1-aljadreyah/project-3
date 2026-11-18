import type { User } from "@/shared/api/types";
import { useFmt, type Fmt } from "@/shared/lib/i18n";
import { Avatar } from "@/shared/ui";
import { PROJECT_STATE } from "../../project-state";
import type { ProjectEvent, ProjectState } from "../../types";

const FIELDS: Record<string, { ar: string; en: string }> = {
  name: { ar: "الاسم", en: "name" },
  name_en: { ar: "الاسم بالإنجليزية", en: "English name" },
  description: { ar: "الوصف", en: "description" },
  priority: { ar: "الأولوية", en: "priority" },
  uses_sprints: { ar: "العمل بالدورات", en: "sprints" },
};

/** One history line in words: "غيّر خطة المشروع من … إلى …". */
function eventText(e: ProjectEvent, fmt: Fmt, people: Map<number, User>) {
  const { tr, lang, day } = fmt;
  const person = (id?: string) => {
    const u = id ? people.get(Number(id)) : undefined;
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  // Days inside the stored text ("2026-11-01 → 2026-12-20") are shown in the person's language.
  const days = (s?: string) => (s ?? "-").replace(/\d{4}-\d{2}-\d{2}/g, (d) => day(d));
  const state = (s?: string) => (s && s in PROJECT_STATE ? tr(PROJECT_STATE[s as ProjectState].ar, PROJECT_STATE[s as ProjectState].en) : "-");

  switch (e.kind) {
    case "created":
      return tr("أنشأ المشروع", "created the project");
    case "details": {
      const names = (e.to ?? "").split(",").filter(Boolean).map((f) => (FIELDS[f] ? tr(FIELDS[f].ar, FIELDS[f].en) : f));
      return tr(`عدّل بيانات المشروع (${names.join("، ")})`, `changed the project's ${names.join(", ")}`);
    }
    case "dates":
      return tr(`غيّر خطة المشروع من ${days(e.from)} إلى ${days(e.to)}`, `changed the plan from ${days(e.from)} to ${days(e.to)}`);
    case "state":
      return tr(`غيّر حالة المشروع من «${state(e.from)}» إلى «${state(e.to)}»`, `changed the state from "${state(e.from)}" to "${state(e.to)}"`);
    case "pm":
      return tr(`سلّم إدارة المشروع من ${person(e.from)} إلى ${person(e.to)}`, `handed the project from ${person(e.from)} to ${person(e.to)}`);
    case "member_added":
      return tr(`أضاف ${person(e.to)} إلى الأعضاء`, `added ${person(e.to)} to the members`);
    case "member_removed":
      return tr(`أزال ${person(e.from)} من الأعضاء`, `removed ${person(e.from)} from the members`);
    case "statuses":
      return tr(`عدّل حالات المهام: ${e.to ?? "-"}`, `changed the task statuses: ${e.to ?? "-"}`);
    case "phases":
      return e.to ? tr(`عدّل المراحل: ${e.to}`, `changed the phases: ${e.to}`) : tr("أزال كل المراحل", "removed all phases");
    case "sprint_added":
      return tr(`أضاف دورة: ${days(e.to)}`, `added a sprint: ${days(e.to)}`);
    case "sprint_changed":
      return tr(`عدّل دورة: ${days(e.to)}`, `changed a sprint: ${days(e.to)}`);
    case "sprint_removed":
      return tr(`حذف دورة: ${days(e.from)}`, `removed a sprint: ${days(e.from)}`);
  }
}

/** The project's history, newest first. Nobody can edit or hide it (the brief). */
export function ProjectHistory({ events, people }: { events: ProjectEvent[]; people: Map<number, User> }) {
  const fmt = useFmt();
  const { tr, lang, dateTime } = fmt;
  const list = [...events].sort((a, b) => b.at.localeCompare(a.at));
  if (!list.length) return <p className="text-sm text-muted">{tr("لا يوجد سجل بعد.", "No history yet.")}</p>;

  return (
    <ol className="flex max-w-3xl flex-col">
      {list.map((e) => {
        const actor = people.get(e.actor_id);
        return (
          <li key={e.id} className="flex gap-3 border-b border-line py-3 last:border-b-0">
            {actor && <Avatar user={actor} size="sm" />}
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm">
                <b className="font-semibold">{actor ? (lang === "en" && actor.name_en ? actor.name_en : actor.name) : "-"}</b> {eventText(e, fmt, people)}
              </p>
              {e.note && (
                <p className="text-[13px] text-muted">
                  {/* <bdi> keeps an Arabic reason in the right order inside an English line (and the other way round). */}
                  {tr("السبب: ", "Reason: ")}
                  <bdi>{e.note}</bdi>
                </p>
              )}
              <time dateTime={e.at} className="text-xs text-faint">
                {dateTime(e.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
