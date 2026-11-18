// The demo data: invented people and projects (never real ones), with dates around today so "late",
// "due today" and the sprint always look current. Demo accounts exist only here, in the demo build.
import type { Announcement } from "@/features/announcements";
import type { Attachment } from "@/features/attachments";
import type { Notification, NotificationPrefs } from "@/features/notifications";
import type { Project, ProjectEvent, Sprint } from "@/features/projects";
import type { Task, TaskComment, TaskEvent } from "@/features/tasks";
import type { Priority, TaskStatus, User } from "@/shared/api/types";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";
import { daysBetween, today } from "@/shared/lib/utils";

/** The demo password of every demo account. Only the demo build has it. */
export const DEMO_PASSWORD = "123456";

/** One account per job for the login page's one-tap buttons (the demo build only). */
export function demoAccounts() {
  const users = seed().users;
  const firstOf = (role: User["role"]) => users.find((u) => u.role === role)!;
  return (["ceo", "pm", "monitor", "lead", "employee", "admin"] as const).map(firstOf);
}

export interface MockDb {
  users: User[];
  projects: Project[];
  sprints: Sprint[];
  tasks: Task[];
  comments: TaskComment[];
  events: TaskEvent[];
  /** Each project's history (setup changes). */
  project_events: ProjectEvent[];
  notifications: Notification[];
  /** Files attached to tasks and projects (the demo keeps each file's bytes in `url`). */
  attachments: Attachment[];
  announcements: Omit<Announcement, "seen" | "seen_count" | "audience_count">[];
  /** Who has seen which announcement, and when. */
  announcement_reads: { announcement_id: number; user_id: number; at: string }[];
  /** Each person's notification choices, by user id. */
  notification_prefs: Record<number, NotificationPrefs>;
  /** The last id given to each kind of record. */
  seq: {
    project: number; task: number; comment: number; event: number; phase: number; sprint: number; project_event: number; notification: number;
    attachment: number; announcement: number;
  };
}

export function seed(now = new Date()): MockDb {
  const d = (offset: number) => today(offset, now);
  /** Whole days from today to `day` (negative = in the past). */
  const daysFrom = (day: string) => daysBetween(today(0, now), day);

  const users: User[] = [
    { id: 1, name: "مريم العبيدي", name_en: "Maryam Al-Obaidi", email: "ceo@demo.test", role: "ceo", title: "المديرة التنفيذية", active: true },
    { id: 2, name: "أحمد كريم", name_en: "Ahmed Kareem", email: "pm@demo.test", role: "pm", title: "مدير مشاريع", active: true },
    { id: 3, name: "هدى ناصر", name_en: "Huda Nasser", email: "monitor@demo.test", role: "monitor", title: "مسؤولة المتابعة والتقييم", active: true },
    { id: 4, name: "مصطفى جواد", name_en: "Mustafa Jawad", email: "lead@demo.test", role: "lead", title: "قائد فريق التطوير", team_id: 1, active: true },
    { id: 5, name: "سارة علي", name_en: "Sara Ali", email: "employee@demo.test", role: "employee", title: "مطورة واجهات", team_id: 1, active: true },
    { id: 6, name: "علي حسين", name_en: "Ali Hussein", email: "ali@demo.test", role: "employee", title: "مطور خوادم", team_id: 1, active: true },
    { id: 7, name: "زينب فاضل", name_en: "Zainab Fadhil", email: "zainab@demo.test", role: "employee", title: "مختبِرة جودة", team_id: 1, active: true },
    { id: 8, name: "حسن رعد", name_en: "Hassan Raad", email: "admin@demo.test", role: "admin", title: "مسؤول النظام", active: true },
  ];

  // A non-software project with its own status (the brief: projects may add statuses).
  const campaignStatuses: TaskStatus[] = [
    ...DEFAULT_STATUSES.filter((s) => s.key !== "testing" && s.key !== "completed" && s.key !== "blocked"),
    { key: "approval", name: "بانتظار موافقة الإدارة", name_en: "Awaiting approval", tone: "review" },
    ...DEFAULT_STATUSES.filter((s) => s.key === "completed" || s.key === "blocked"),
  ];

  const projects: Project[] = [
    {
      id: 1, code: "PRJ-1", name: "منصة الحجز الإلكتروني", name_en: "Online booking platform",
      description: "منصة يحجز منها العملاء مواعيدهم ويتابعونها، مع لوحة للموظفين.",
      pm_id: 2, member_ids: [2, 4, 5, 6, 7], start: d(-40), end: d(25), state: "active", priority: "high",
      uses_sprints: true, statuses: DEFAULT_STATUSES,
      phases: [{ id: 1, name: "التحليل والتصميم" }, { id: 2, name: "التطوير" }, { id: 3, name: "الإطلاق" }],
    },
    {
      id: 2, code: "PRJ-2", name: "تطبيق المبيعات", name_en: "Sales app",
      description: "تطبيق لمندوبي المبيعات لتسجيل الطلبات والزيارات.",
      pm_id: 2, member_ids: [2, 4, 6], start: d(-20), end: d(50), state: "active", priority: "medium",
      uses_sprints: false, statuses: DEFAULT_STATUSES, phases: [],
    },
    {
      id: 3, code: "PRJ-3", name: "حملة التسويق الشتوية", name_en: "Winter marketing campaign",
      description: "حملة إعلانية للموسم الشتوي، دون مراحل ولا دورات.",
      pm_id: 2, member_ids: [2, 7], start: d(5), end: d(45), state: "planned", priority: "low",
      uses_sprints: false, statuses: campaignStatuses, phases: [],
    },
  ];

  const sprints: Sprint[] = [{ id: 1, project_id: 1, name: "الدورة 4", start: d(-6), end: d(5), planned_ratio: 0 }];

  // A moment `days` ago at `hour` o'clock, for history and comments.
  const at = (days: number, hour = 10) => {
    const x = new Date(now);
    x.setDate(x.getDate() - days);
    x.setHours(hour, 0, 0, 0);
    return x.toISOString();
  };

  let id = 0;
  const task = (
    project_id: number, code: string, title: string, status: string, priority: Priority,
    assignee_id: number, due: number, sub: [number, number], blocked_reason?: string,
  ): Task => ({
    id: ++id, code, project_id, title, status, priority, assignee_id,
    description: DESCRIPTIONS[code] ?? "",
    sprint_id: project_id === 1 ? 1 : undefined, start: d(due - 7), due: d(due),
    subtasks_done: sub[0], subtasks_total: sub[1], blocked_reason,
    created_by: projects.find((p) => p.id === project_id)!.pm_id, created_at: at(9),
    updated_at: at(1),
  });

  const tasks: Task[] = [
    task(1, "TSK-118", "تصميم شاشة تسجيل الدخول", "new", "high", 5, 4, [0, 4]),
    task(1, "TSK-121", "كتابة متطلبات تقرير الأداء", "new", "medium", 6, 8, [1, 3]),
    task(1, "TSK-115", "إعداد بيئة الاختبار الآلي", "todo", "medium", 7, 3, [0, 2]),
    task(1, "TSK-104", "ربط لوحة كانبان بالخادم", "in_progress", "high", 4, 1, [3, 5]),
    task(1, "TSK-109", "صفحة إعلانات الشركة", "in_progress", "low", 5, -2, [1, 3]),
    task(1, "TSK-099", "تنبيه اقتراب موعد التسليم", "in_review", "medium", 6, 2, [4, 4]),
    task(1, "TSK-092", "من شاهد الإعلان ومن لم يشاهده", "testing", "low", 7, 3, [2, 2]),
    task(1, "TSK-085", "إعداد الأدوار والصلاحيات", "completed", "high", 6, -4, [6, 6]),
    task(1, "TSK-088", "سجل العمليات", "completed", "medium", 6, -1, [3, 3]),
    task(1, "TSK-097", "ربط المهام بمستودعات GitHub", "blocked", "medium", 4, -1, [1, 4], "بانتظار صلاحية الوصول إلى المستودع"),
    task(2, "TSK-201", "شاشة تسجيل الطلب", "in_progress", "high", 6, 6, [2, 5]),
    task(2, "TSK-202", "مزامنة الطلبات بلا إنترنت", "todo", "high", 6, 12, [0, 3]),
    task(2, "TSK-203", "تقرير زيارات المندوبين", "new", "medium", 4, 20, [0, 2]),
    task(2, "TSK-204", "اختيار مزوّد الخرائط", "completed", "low", 4, -6, [1, 1]),
    task(3, "TSK-301", "اختيار الرسائل الرئيسية للحملة", "approval", "medium", 7, 9, [2, 3]),
    task(3, "TSK-302", "حجز المساحات الإعلانية", "new", "high", 2, 14, [0, 4]),
  ];

  // Project 1 works in phases: each of its tasks belongs to one.
  const PHASE_OF: Record<string, number> = {
    "TSK-118": 1, "TSK-121": 1, "TSK-085": 1,
    "TSK-115": 2, "TSK-104": 2, "TSK-109": 2, "TSK-099": 2, "TSK-088": 2, "TSK-097": 2,
    "TSK-092": 3,
  };
  for (const t of tasks) if (PHASE_OF[t.code]) t.phase_id = PHASE_OF[t.code];

  // TSK-099: Ali asked to mark it done; it waits for the PM's approval.
  const asked = tasks.find((t) => t.code === "TSK-099")!;
  asked.approval = { state: "pending", from: "in_review", to: "completed", requested_by: 6, requested_at: at(0, 9) };

  // The history: every task was created by its PM; some moved since.
  let eventId = 0;
  const events: TaskEvent[] = tasks.map((t) => ({ id: ++eventId, task_id: t.id, actor_id: t.created_by!, kind: "created", at: t.created_at! }));
  const ev = (code: string, e: Omit<TaskEvent, "id" | "task_id">) =>
    events.push({ id: ++eventId, task_id: tasks.find((t) => t.code === code)!.id, ...e });
  ev("TSK-104", { actor_id: 4, kind: "status", from: "todo", to: "in_progress", at: at(5) });
  ev("TSK-097", { actor_id: 4, kind: "status", from: "todo", to: "in_progress", at: at(6) });
  ev("TSK-097", { actor_id: 4, kind: "blocked", from: "in_progress", to: "blocked", note: "بانتظار صلاحية الوصول إلى المستودع", at: at(2, 11) });
  ev("TSK-099", { actor_id: 6, kind: "status", from: "in_progress", to: "in_review", at: at(2, 15) });
  ev("TSK-099", { actor_id: 6, kind: "approval_requested", from: "in_review", to: "completed", at: at(0, 9) });
  ev("TSK-085", { actor_id: 6, kind: "approval_requested", from: "testing", to: "completed", at: at(5, 12) });
  ev("TSK-085", { actor_id: 2, kind: "approved", from: "testing", to: "completed", at: at(4, 9) });
  ev("TSK-109", { actor_id: 2, kind: "due", from: d(-5), to: d(-2), note: "أُضيف قسم الإعلانات المثبّتة", at: at(6) });

  let commentId = 0;
  const comment = (code: string, author_id: number, body: string, when: string): TaskComment => ({
    id: ++commentId, task_id: tasks.find((t) => t.code === code)!.id, author_id, body, created_at: when,
  });
  const comments: TaskComment[] = [
    comment("TSK-097", 4, "طلبت الصلاحية من مسؤول النظام، وننتظر الرد.", at(2, 11)),
    comment("TSK-097", 2, "سأتابع الأمر معه اليوم.", at(1, 9)),
    comment("TSK-099", 6, "أنهيت التنبيه قبل الموعد بيوم وبساعة، وجرّبته على ثلاث مهام.", at(0, 9)),
    comment("TSK-104", 5, "الواجهة جاهزة، وأنتظر نقطة الاتصال من الخادم.", at(1, 14)),
  ];

  // Each project's history: created by its PM; project 1's plan changed after work started (an edge case in the brief).
  let projectEventId = 0;
  const project_events: ProjectEvent[] = projects.map((p) => ({
    id: ++projectEventId, project_id: p.id, actor_id: p.pm_id, kind: "created", at: at(Math.max(0, -daysFrom(p.start)) + 2, 9),
  }));
  project_events.push(
    { id: ++projectEventId, project_id: 1, actor_id: 2, kind: "member_added", to: "7", at: at(30) },
    { id: ++projectEventId, project_id: 1, actor_id: 2, kind: "dates", from: `${d(-40)} → ${d(20)}`, to: `${d(-40)} → ${d(25)}`, note: "أُضيف ربط المهام بمستودعات GitHub إلى نطاق العمل", at: at(12) },
  );

  // A few notifications that already happened (the due-date reminders are made when someone opens the list).
  const about = (code: string) => {
    const t = tasks.find((x) => x.code === code)!;
    const p = projects.find((x) => x.id === t.project_id)!;
    return { project_id: p.id, task_id: t.id, data: { task_code: t.code, task_title: t.title, project_name: p.name, project_name_en: p.name_en } };
  };
  let notificationId = 0;
  const notifications: Notification[] = [
    { id: ++notificationId, user_id: 5, kind: "task_assigned", actor_id: 2, ...about("TSK-118"), at: at(9), read: true },
    { id: ++notificationId, user_id: 2, kind: "approval_requested", actor_id: 6, ...about("TSK-099"), at: at(0, 9), read: false },
    { id: ++notificationId, user_id: 4, kind: "task_comment", actor_id: 2, ...about("TSK-097"), at: at(1, 9), read: false },
    { id: ++notificationId, user_id: 2, kind: "task_comment", actor_id: 5, ...about("TSK-104"), at: at(1, 14), read: true },
    { id: ++notificationId, user_id: 7, kind: "project_added", actor_id: 2, project_id: 1, data: { project_name: projects[0].name, project_name_en: projects[0].name_en }, at: at(30), read: true },
  ];

  // Two small example files: a task's requirements and a project's plan (invented text).
  const textFile = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    return { size: bytes.length, url: `data:text/plain;charset=utf-8;base64,${btoa(String.fromCharCode(...bytes))}` };
  };
  const attachments: Attachment[] = [
    {
      id: 1, owner_type: "task", owner_id: tasks.find((t) => t.code === "TSK-118")!.id, name: "متطلبات-شاشة-الدخول.txt", mime: "text/plain",
      ...textFile("شاشة الدخول: البريد الإلكتروني وكلمة المرور، ورسالة واضحة عند الخطأ، ودعم الوضع الليلي."), uploaded_by: 2, at: at(8),
    },
    {
      id: 2, owner_type: "project", owner_id: 1, name: "خطة-المشروع.txt", mime: "text/plain",
      ...textFile("المراحل: التحليل والتصميم، ثم التطوير، ثم الإطلاق. الدورة الحالية: الدورة 4."), uploaded_by: 2, at: at(35),
    },
  ];

  // Two announcements: an important one from the CEO that some have seen, one from the admin that most have seen.
  const announcements: MockDb["announcements"] = [
    {
      id: 1, title: "اجتماع عام يوم الخميس", important: true, author_id: 1, created_at: at(1, 9),
      body: "يُعقد اجتماع عام لكل الموظفين يوم الخميس في العاشرة صباحاً، لعرض خطة الربع القادم. الحضور مطلوب.",
    },
    {
      id: 2, title: "صيانة الخوادم ليلة السبت", important: false, author_id: 8, created_at: at(4, 11),
      body: "تتوقف المنصة عن العمل ليلة السبت من الحادية عشرة حتى الواحدة صباحاً لأعمال صيانة.",
    },
  ];
  const announcement_reads: MockDb["announcement_reads"] = [
    { announcement_id: 1, user_id: 1, at: at(1, 9) },
    { announcement_id: 1, user_id: 2, at: at(1, 10) },
    { announcement_id: 1, user_id: 4, at: at(0, 9) },
    ...[8, 1, 2, 3, 4, 5].map((user_id, i) => ({ announcement_id: 2, user_id, at: at(4, 11 + i) })),
  ];
  notifications.push(
    ...[3, 4, 5, 6, 7, 8].map((user_id) => ({
      id: ++notificationId, user_id, kind: "announcement" as const, actor_id: 1, announcement_id: 1,
      data: { title: announcements[0].title }, at: at(1, 9), read: user_id === 4,
    })),
  );

  return {
    users, projects, sprints, tasks, comments, events, project_events, notifications, notification_prefs: {}, attachments,
    announcements, announcement_reads,
    seq: {
      project: projects.length, task: id, comment: commentId, event: eventId, phase: 3, sprint: sprints.length,
      project_event: projectEventId, notification: notificationId, attachment: attachments.length, announcement: announcements.length,
    },
  };
}

/** Short descriptions for some demo tasks, so the task page has something to show. */
const DESCRIPTIONS: Record<string, string> = {
  "TSK-104": "نقل المهمة بين الأعمدة يحفظ حالتها في الخادم، ويظهر التغيير لكل من يفتح اللوحة.",
  "TSK-097": "ربط كل مهمة بمستودع GitHub، وإظهار الالتزامات وطلبات الدمج المرتبطة بها في صفحة المهمة.",
  "TSK-099": "إشعار المسؤول عن المهمة قبل موعد التسليم بيوم، ثم عند تجاوزه.",
  "TSK-118": "شاشة الدخول بالبريد الإلكتروني وكلمة المرور، مع رسائل واضحة عند الخطأ.",
};
