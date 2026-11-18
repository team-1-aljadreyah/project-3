// What each notification says, where a click on it goes, and the names of the kinds for the preferences.
import type { User } from "@/shared/api/types";
import type { Fmt } from "@/shared/lib/i18n";
import { daysBetween, today } from "@/shared/lib/utils";
import type { Notification, NotificationKind } from "./types";

/** The kinds as people see them in the preferences, with a short explanation. */
export const KIND_WORDS: Record<NotificationKind, { ar: string; en: string; hint_ar: string; hint_en: string }> = {
  task_assigned: { ar: "إسناد مهمة إليك", en: "A task is given to you", hint_ar: "عند إسناد مهمة جديدة إليك.", hint_en: "When a task is assigned to you." },
  task_status: { ar: "تغيير حالة مهمة", en: "A task's status changes", hint_ar: "مهامك، ومهام مشاريعك إن كنت مديرها.", hint_en: "Your tasks, and your projects' tasks if you manage them." },
  task_comment: { ar: "تعليق جديد", en: "A new comment", hint_ar: "على مهامك، أو مهمة علّقت عليها.", hint_en: "On your tasks, or a task you commented on." },
  task_due_changed: { ar: "تغيير موعد التسليم", en: "A due date changes", hint_ar: "عند تغيير موعد تسليم مهمة مسندة إليك.", hint_en: "When the due date of your task changes." },
  task_due_soon: { ar: "اقتراب موعد التسليم", en: "A due date is near", hint_ar: "قبل موعد التسليم بيوم، ويوم التسليم.", hint_en: "The day before, and on the day." },
  task_overdue: { ar: "تجاوز موعد التسليم", en: "A task is late", hint_ar: "عند تجاوز مهمتك موعد تسليمها.", hint_en: "When your task passes its due date." },
  approval_requested: { ar: "طلب اعتماد إكمال", en: "Approval is requested", hint_ar: "لمدير المشروع وقادة الفرق فيه.", hint_en: "For the project's manager and team leaders." },
  approval_decided: { ar: "قرار الاعتماد", en: "Approval is decided", hint_ar: "عند اعتماد إكمال مهمة طلبتَه أو إرجاعها.", hint_en: "When a completion you asked for is approved or sent back." },
  project_added: { ar: "إضافتك إلى مشروع", en: "You're added to a project", hint_ar: "عند إضافتك إلى أعضاء مشروع.", hint_en: "When you become a project member." },
  project_pm: { ar: "تغيير مدير المشروع", en: "A project's manager changes", hint_ar: "لكل أعضاء المشروع.", hint_en: "For all the project's members." },
  announcement: { ar: "إعلان جديد من الإدارة", en: "A new announcement", hint_ar: "عند نشر إعلان لكل الشركة.", hint_en: "When the management posts one for everyone." },
  project_plan: { ar: "تغيير خطة مشروع", en: "A project's plan changes", hint_ar: "عند تغيير مواعيد مشروع أنت فيه.", hint_en: "When the dates of your project change." },
};

/** The notification in one sentence, in the person's language: "أحمد كريم أسند إليك TSK-118". */
export function notificationText(n: Notification, fmt: Fmt, people: Map<number, User>) {
  const { tr, lang, day } = fmt;
  const nameOf = (id?: number | string) => {
    const u = id === undefined ? undefined : people.get(Number(id));
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("أحدهم", "Someone");
  };
  const who = nameOf(n.actor_id);
  const d = n.data;
  const task = `${d.task_code ?? ""}`;
  const project = (lang === "en" && d.project_name_en) || d.project_name || "";

  switch (n.kind) {
    case "task_assigned":
      return tr(`${who} أسند إليك ${task}`, `${who} gave you ${task}`);
    case "task_status":
      return tr(`${who} نقل ${task} إلى «${d.status ?? "-"}»`, `${who} moved ${task} to "${d.status_en ?? d.status ?? "-"}"`);
    case "task_comment":
      return tr(`${who} علّق على ${task}`, `${who} commented on ${task}`);
    case "task_due_changed":
      return d.due ? tr(`${who} غيّر موعد تسليم ${task} إلى ${day(d.due)}`, `${who} moved ${task}'s due date to ${day(d.due)}`) : tr(`${who} أزال موعد تسليم ${task}`, `${who} removed ${task}'s due date`);
    case "task_due_soon":
      // Counted from today, so an old reminder still says the truth ("today", "1 day late"…).
      return d.due ? tr(`موعد تسليم ${task}: ${fmt.due(daysBetween(today(), d.due))}`, `${task} is due ${fmt.due(daysBetween(today(), d.due))}`) : tr(`اقترب موعد تسليم ${task}`, `${task} is due soon`);
    case "task_overdue":
      return tr(`تجاوزت ${task} موعد تسليمها`, `${task} is past its due date`);
    case "approval_requested":
      return tr(`${who} طلب اعتماد إكمال ${task}`, `${who} asks you to approve ${task} as done`);
    case "approval_decided":
      return d.decision === "rejected"
        ? tr(`${who} أرجع ${task} ولم يعتمد إكمالها`, `${who} sent ${task} back`)
        : tr(`${who} اعتمد إكمال ${task}`, `${who} approved ${task} as done`);
    case "project_added":
      return tr(`${who} أضافك إلى مشروع ${project}`, `${who} added you to ${project}`);
    case "project_pm":
      return tr(`${who} سلّم إدارة ${project} إلى ${nameOf(d.pm_id)}`, `${who} handed ${project} to ${nameOf(d.pm_id)}`);
    case "announcement":
      return tr(`${who} نشر إعلاناً: ${d.title ?? ""}`, `${who} posted an announcement: ${d.title ?? ""}`);
    case "project_plan":
      return tr(`${who} غيّر خطة ${project}: الإنجاز المتوقع ${d.due ? day(d.due) : "-"}`, `${who} changed ${project}'s plan: expected end ${d.due ? day(d.due) : "-"}`);
  }
}

/** A second, smaller line: the task's title or a reason, when there is one. */
export function notificationDetail(n: Notification) {
  return n.data.note || n.data.task_title || undefined;
}

/** Where a click on the notification goes: its task, its announcement, else its project. */
export function notificationLink(n: Notification) {
  if (n.task_id) return `/tasks/${n.task_id}`;
  if (n.announcement_id) return `/announcements/${n.announcement_id}`;
  if (n.project_id) return `/projects/${n.project_id}`;
  return "/notifications";
}
