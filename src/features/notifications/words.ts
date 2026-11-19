// What each notification says, where a click on it goes, and the names of the kinds for the preferences.
import type { User } from "@/shared/api/types";
import type { Fmt } from "@/shared/lib/i18n";
import { daysBetween, today } from "@/shared/lib/utils";
import type { Notification, NotificationKind } from "./types";

/** Bug statuses in Arabic, for the notification sentences (the bugs feature has its own full labels). */
const bugStatusAr: Record<string, string> = {
  reported: "مُسجّلة",
  assigned: "مُسندة",
  fixing: "قيد الإصلاح",
  testing: "قيد الاختبار",
  reopened: "أُعيدت للمطور",
  closed: "مغلقة",
};

/** The kinds as people see them in the preferences, with a short explanation. */
export const KIND_WORDS: Record<NotificationKind, { ar: string; en: string; hint_ar: string; hint_en: string }> = {
  task_assigned: { ar: "إسناد مهمة إليك", en: "A task is given to you", hint_ar: "عند إسناد مهمة جديدة إليك.", hint_en: "When a task is assigned to you." },
  task_status: { ar: "تغيير حالة مهمة", en: "A task's status changes", hint_ar: "مهامك، ومهام مشاريعك إن كنت مديرها.", hint_en: "Your tasks, and your projects' tasks if you manage them." },
  task_comment: { ar: "تعليق جديد", en: "A new comment", hint_ar: "على مهامك، أو مهمة علّقت عليها.", hint_en: "On your tasks, or a task you commented on." },
  task_due_changed: { ar: "تغيير موعد التسليم", en: "A due date changes", hint_ar: "عند تغيير موعد تسليم مهمة مسندة إليك.", hint_en: "When the due date of your task changes." },
  task_due_soon: { ar: "اقتراب موعد التسليم", en: "A due date is near", hint_ar: "قبل موعد التسليم بيوم، ويوم التسليم.", hint_en: "The day before, and on the day." },
  task_overdue: { ar: "تجاوز موعد التسليم", en: "A task is late", hint_ar: "عند تجاوز مهمتك موعد تسليمها.", hint_en: "When your task passes its due date." },
  approval_requested: { ar: "طلب اعتماد إكمال", en: "Approval is requested", hint_ar: "لمدير المشروع وقادة الفرق فيه.", hint_en: "For the project's manager and team leaders." },
  github_pr_merged: { ar: "دمج طلب سحب مرتبط بمهمتك", en: "A PR for your task is merged", hint_ar: "عند دمج طلب سحب في GitHub يذكر مهمتك، لتنقلها.", hint_en: "When a GitHub pull request that mentions your task is merged, so you can move it." },
  team_joined: { ar: "انضمامك إلى فريق", en: "You join a team", hint_ar: "عند إضافتك إلى فريق أو جعلك قائده.", hint_en: "When you are put in a team or made its leader." },
  account_locked: { ar: "قفل حساب", en: "An account is locked", hint_ar: "للمسؤول: عند قفل حساب بعد محاولات دخول خاطئة.", hint_en: "For the admin: when an account locks after wrong passwords." },
  review_final: { ar: "تقييم أدائك", en: "Your performance review", hint_ar: "عند اعتماد تقييم لأدائك.", hint_en: "When a review of your work is made final." },
  dependency_done: { ar: "انتهاء ما تنتظره مهمتك", en: "A task yours waits for is done", hint_ar: "عند إنجاز آخر مهمة كانت مهمتك تنتظرها.", hint_en: "When the last task yours was waiting for is done." },
  approval_decided: { ar: "قرار الاعتماد", en: "Approval is decided", hint_ar: "عند اعتماد إكمال مهمة طلبتَه أو إرجاعها.", hint_en: "When a completion you asked for is approved or sent back." },
  project_added: { ar: "إضافتك إلى مشروع", en: "You're added to a project", hint_ar: "عند إضافتك إلى أعضاء مشروع.", hint_en: "When you become a project member." },
  project_pm: { ar: "تغيير مدير المشروع", en: "A project's manager changes", hint_ar: "لكل أعضاء المشروع.", hint_en: "For all the project's members." },
  chat_mention: { ar: "ذكر اسمك في محادثة", en: "You're mentioned in a chat", hint_ar: "عند ذكرك بـ @ في محادثة.", hint_en: "When someone writes @ and your name." },
  bug_reported: { ar: "تسجيل مشكلة برمجية", en: "A bug is reported", hint_ar: "لمدير المشروع وقادة الفرق فيه.", hint_en: "For the project's manager and team leaders." },
  bug_assigned: { ar: "إسناد مشكلة إليك", en: "A bug is given to you", hint_ar: "عند تحويل مشكلة إليك لإصلاحها.", hint_en: "When a bug is given to you to fix." },
  bug_status: { ar: "تغيير حالة مشكلة", en: "A bug's status changes", hint_ar: "لمن سجّلها والمطور ومدير المشروع.", hint_en: "For its reporter, developer and project manager." },
  bug_late: { ar: "تأخر إصلاح مشكلة", en: "A bug fix is late", hint_ar: "للمطور ومدير المشروع بعد الموعد المتوقع.", hint_en: "For the developer and the PM, after the expected day." },
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
    case "github_pr_merged":
      // d.note = the pull request ("aljadreyah/booking-web #41").
      return tr(`دُمج ${d.note ?? "-"} المرتبط بـ ${task}: هل تنقل المهمة؟`, `${d.note ?? "-"} for ${task} was merged: move the task?`);
    case "team_joined":
      // d.note = the team's name.
      return tr(`${who} أضافك إلى «${d.note ?? "-"}»`, `${who} put you in "${d.note ?? "-"}"`);
    case "account_locked":
      // d.note = the locked person's name.
      return tr(`قُفل حساب ${d.note ?? "-"} بعد محاولات دخول خاطئة`, `${d.note ?? "-"}'s account locked after wrong passwords`);
    case "review_final":
      // d.note = the review's period.
      return tr(`${who} اعتمد تقييم أدائك للفترة ${d.note ?? ""}`, `${who} made your performance review final (${d.note ?? ""})`);
    case "dependency_done":
      // d.note = the task that was finished; the notification is about the task that can go on now.
      return tr(`أُنجزت ${d.note ?? "-"}، ويمكن متابعة ${task}`, `${d.note ?? "-"} is done: ${task} can go on`);
    case "chat_mention":
      return tr(`${who} ذكرك في محادثة`, `${who} mentioned you in a chat`);
    case "bug_reported":
      return tr(`${who} سجّل مشكلة: ${d.bug_code ?? ""}`, `${who} reported a bug: ${d.bug_code ?? ""}`);
    case "bug_assigned":
      return tr(`${who} حوّل إليك المشكلة ${d.bug_code ?? ""}`, `${who} gave you ${d.bug_code ?? ""}`);
    case "bug_status":
      return tr(`${who} نقل ${d.bug_code ?? ""} إلى «${bugStatusAr[d.bug_status ?? ""] ?? d.bug_status ?? "-"}»`, `${who} moved ${d.bug_code ?? ""} to "${d.bug_status ?? "-"}"`);
    case "bug_late":
      return tr(`تأخر إصلاح ${d.bug_code ?? ""} عن موعده`, `${d.bug_code ?? ""} is past its expected fix day`);
    case "announcement":
      return tr(`${who} نشر إعلاناً: ${d.title ?? ""}`, `${who} posted an announcement: ${d.title ?? ""}`);
    case "project_plan":
      return tr(`${who} غيّر خطة ${project}: الإنجاز المتوقع ${d.due ? day(d.due) : "-"}`, `${who} changed ${project}'s plan: expected end ${d.due ? day(d.due) : "-"}`);
  }
}

/** A second, smaller line: the task's or bug's title, or a reason, when there is one. */
export function notificationDetail(n: Notification) {
  return n.data.note || n.data.task_title || n.data.bug_title || undefined;
}

/** Where a click on the notification goes: its task, its announcement, else its project. */
export function notificationLink(n: Notification) {
  if (n.task_id) return `/tasks/${n.task_id}`;
  if (n.announcement_id) return `/announcements/${n.announcement_id}`;
  if (n.bug_id) return `/bugs/${n.bug_id}`;
  if (n.chat_key) return `/chat/${n.chat_key}`;
  if (n.kind === "review_final") return "/performance";
  if (n.kind === "account_locked") return "/admin";
  if (n.project_id) return `/projects/${n.project_id}`;
  return "/notifications";
}
