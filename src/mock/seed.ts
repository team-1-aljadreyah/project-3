// The demo data: invented people and projects (never real ones), with dates around today so "late",
// "due today" and the sprint always look current. Demo accounts exist only here, in the demo build.
import type { Announcement } from "@/features/announcements";
import type { Attachment } from "@/features/attachments";
import type { Bug, BugEvent } from "@/features/bugs";
import type { Message } from "@/features/chat";
import type { Notification, NotificationPrefs } from "@/features/notifications";
import type { Project, ProjectEvent, ProjectTemplate, Sprint } from "@/features/projects";
import type { Task, TaskComment, TaskEvent } from "@/features/tasks";
import type { Priority, TaskStatus, Team, User } from "@/shared/api/types";
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
  bugs: Bug[];
  bug_events: BugEvent[];
  teams: Team[];
  /** Private chats between two people. Project and team chats come from the projects and teams. */
  directs: { id: number; member_ids: number[] }[];
  messages: Omit<Message, "files">[];
  /** The last message each person has read in each chat. */
  chat_reads: { chat: string; user_id: number; last_id: number }[];
  templates: ProjectTemplate[];
  /** Who has seen which announcement, and when. */
  announcement_reads: { announcement_id: number; user_id: number; at: string }[];
  /** Each person's notification choices, by user id. */
  notification_prefs: Record<number, NotificationPrefs>;
  /** The last id given to each kind of record. */
  seq: {
    project: number; task: number; comment: number; event: number; phase: number; sprint: number; project_event: number; notification: number;
    attachment: number; announcement: number; bug: number; bug_event: number; direct: number; message: number; template: number;
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

  // Project 1 works in sprints: "الدورة 3" ended (its blocked task moved on to "الدورة 4"), "الدورة 4" runs today,
  // "الدورة 5" comes next. A sprint's ended numbers are kept in `result`.
  const sprints: Sprint[] = [
    { id: 1, project_id: 1, name: "الدورة 4", start: d(-6), end: d(5), planned_ratio: 0 },
    {
      id: 2, project_id: 1, name: "الدورة 3", start: d(-20), end: d(-7), planned_ratio: 1,
      closed_at: `${d(-7)}T15:00:00.000Z`, result: { planned: 2, done: 1, moved: 1, moved_to: 1 },
    },
    { id: 3, project_id: 1, name: "الدورة 5", start: d(6), end: d(19), planned_ratio: 0 },
  ];

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
  // The sprints: TSK-085 was done in the ended "الدورة 3"; TSK-121 waits in the backlog (no sprint yet).
  tasks.find((t) => t.code === "TSK-085")!.sprint_id = 2;
  tasks.find((t) => t.code === "TSK-121")!.sprint_id = undefined;
  // Dependencies: "who saw the announcement" waits for the announcements page (not done yet); the performance report
  // waits for the roles (already done).
  const byCode = (code: string) => tasks.find((t) => t.code === code)!;
  byCode("TSK-092").depends_on = [byCode("TSK-109").id];
  byCode("TSK-121").depends_on = [byCode("TSK-085").id];

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
  ev("TSK-097", { actor_id: 2, kind: "sprint", from: "الدورة 3", to: "الدورة 4", at: at(7, 15) });
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
    { id: ++projectEventId, project_id: 1, actor_id: 2, kind: "sprint_closed", from: "الدورة 3", to: "الدورة 4", note: "1/2", at: at(7, 15) },
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

  // Bugs in projects 1 and 2, in every status: one late, one sent back after testing, one closed.
  const taskId = (code: string) => tasks.find((t) => t.code === code)!.id;
  const bug = (
    id: number, project_id: number, title: string, severity: Bug["severity"], priority: Bug["priority"], status: Bug["status"],
    reported_by: number, assignee_id: number | undefined, due: number | undefined, extra: Partial<Bug> = {},
  ): Bug => ({
    id, code: `BUG-${id}`, project_id, title, description: "", severity, priority, status, reported_by, assignee_id,
    due: due === undefined ? undefined : d(due), created_at: at(6 - id % 4), updated_at: at(1), ...extra,
  });
  const bugs: Bug[] = [
    bug(1, 1, "زر الدخول لا يعمل على الهاتف", "critical", "high", "fixing", 7, 5, -1, {
      phase_id: 2, task_id: taskId("TSK-118"), description: "على شاشة صغيرة يختفي زر الدخول خلف لوحة المفاتيح.",
    }),
    bug(2, 1, "تاريخ التسليم يظهر بتوقيت خاطئ", "high", "medium", "testing", 2, 6, 2, { task_id: taskId("TSK-099") }),
    bug(3, 1, "نص الإعلان يُقطع في الوضع الليلي", "medium", "low", "reopened", 7, 5, 4, { task_id: taskId("TSK-109") }),
    bug(4, 1, "رسالة خطأ بالإنجليزية في واجهة عربية", "low", "low", "reported", 4, undefined, undefined),
    bug(5, 1, "سجل العمليات لا يعرض اسم المستخدم", "high", "high", "closed", 2, 6, -3, { closed_at: at(2) }),
    bug(6, 2, "الطلبات تتكرر عند ضعف الاتصال", "critical", "high", "assigned", 4, 6, 3),
  ];
  let bugEventId = 0;
  const bug_events: BugEvent[] = bugs.map((b) => ({ id: ++bugEventId, bug_id: b.id, actor_id: b.reported_by, kind: "created" as const, at: b.created_at }));
  bug_events.push(
    { id: ++bugEventId, bug_id: 3, actor_id: 5, kind: "status", from: "fixing", to: "testing", at: at(2) },
    { id: ++bugEventId, bug_id: 3, actor_id: 7, kind: "status", from: "testing", to: "reopened", note: "ما زال النص يُقطع على شاشة الهاتف", at: at(1) },
    { id: ++bugEventId, bug_id: 5, actor_id: 2, kind: "status", from: "testing", to: "closed", at: at(2) },
  );

  // One team (BRIEF question 6 is open), and a few messages: in project 1's chat (with a reply and a mention of Sara),
  // in the team's chat, and a private chat between Ahmed and Sara. Sara hasn't read the newest ones.
  const teams: Team[] = [{ id: 1, name: "فريق التطوير", name_en: "Development team", lead_id: 4 }];
  const directs = [{ id: 1, member_ids: [2, 5] }];
  let messageId = 0;
  const msg = (chat: string, author_id: number, body: string, when: string, extra: Partial<Message> = {}) => ({
    id: ++messageId, chat, author_id, body, mentions: [], created_at: when, ...extra,
  });
  const messages: MockDb["messages"] = [
    msg("p-1", 2, "صباح الخير. نبدأ اليوم الدورة 4، الأولوية لربط اللوحة بالخادم.", at(2, 9)),
    msg("p-1", 4, "تمام. سأراجع نقاط الاتصال مع علي قبل الظهر.", at(2, 10)),
    msg("t-1", 4, "تذكير: مراجعة الشيفرة كل خميس الساعة الثانية.", at(1, 11)),
    msg("d-1", 2, "سارة، هل تحتاجين مساعدة في صفحة الإعلانات؟", at(1, 15)),
    msg("p-1", 6, "نقطة الاتصال جاهزة على بيئة التجربة.", at(0, 9), { reply_to: 2 }),
    msg("p-1", 2, "ممتاز. @سارة علي هل يمكنك تجربتها على اللوحة اليوم؟", at(0, 10), { mentions: [5] }),
  ];
  const chat_reads = [
    { chat: "p-1", user_id: 5, last_id: 2 },
    { chat: "t-1", user_id: 5, last_id: 3 },
    { chat: "p-1", user_id: 2, last_id: 6 },
    { chat: "d-1", user_id: 2, last_id: 4 },
  ];
  notifications.push({
    id: ++notificationId, user_id: 5, kind: "chat_mention", actor_id: 2, chat_key: "p-1",
    data: { note: messages[5].body }, at: at(0, 10), read: false,
  });

  // One project template, made by the PM: a mobile app in three phases, worked in sprints.
  const templates: ProjectTemplate[] = [{
    id: 1, name: "تطبيق جوال", description: "تحليل، ثم تطوير، ثم إطلاق في المتاجر.", from_project: "تطبيق المبيعات",
    statuses: structuredClone(DEFAULT_STATUSES), phases: ["التحليل والتصميم", "التطوير", "الإطلاق"], uses_sprints: true,
    tasks: [
      { title: "جمع المتطلبات مع العميل", description: "", priority: "high", phase: "التحليل والتصميم" },
      { title: "تصميم الشاشات الرئيسية", description: "", priority: "high", phase: "التحليل والتصميم" },
      { title: "إعداد مشروع التطبيق وبيئة الاختبار", description: "", priority: "medium", phase: "التطوير" },
      { title: "ربط التطبيق بالخادم", description: "", priority: "medium", phase: "التطوير" },
      { title: "النشر في متجري التطبيقات", description: "", priority: "medium", phase: "الإطلاق" },
    ],
    created_by: 2, created_at: at(10),
  }];

  return {
    users, projects, sprints, tasks, comments, events, project_events, notifications, notification_prefs: {}, attachments,
    announcements, announcement_reads, bugs, bug_events, teams, directs, messages, chat_reads, templates,
    seq: {
      project: projects.length, task: id, comment: commentId, event: eventId, phase: 3, sprint: sprints.length,
      project_event: projectEventId, notification: notificationId, attachment: attachments.length, announcement: announcements.length,
      bug: bugs.length, bug_event: bugEventId, direct: directs.length, message: messageId, template: templates.length,
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
