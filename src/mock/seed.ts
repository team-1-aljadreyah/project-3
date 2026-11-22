// The demo data: invented people and projects (never real ones), with dates around today so "late",
// "due today" and the sprint always look current. Demo accounts exist only here, in the demo build.
import type { AdvancedRules, SettingsChange } from "@/features/advanced";
import type { Announcement } from "@/features/announcements";
import type { Attachment } from "@/features/attachments";
import type { Bug, BugEvent } from "@/features/bugs";
import type { Message } from "@/features/chat";
import type { Criteria, Review } from "@/features/performance";
import type { AuditEntry, Settings } from "@/features/admin";
import type { GithubItem, GithubSettings } from "@/features/github";
import type { MonitorNote } from "@/features/monitoring";
import type { Notification, NotificationPrefs } from "@/features/notifications";
import type { Project, ProjectEvent, ProjectTemplate, Sprint } from "@/features/projects";
import type { Rating } from "@/features/ratings";
import type { Task, TaskComment, TaskEvent } from "@/features/tasks";
import type { Priority, TaskStatus, Team, User } from "@/shared/api/types";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";
import { daysBetween, today } from "@/shared/lib/utils";

/** The demo password of every demo account. Only the demo build has it. */
export const DEMO_PASSWORD = "123456";

// ── Where the demo people work from (the audit log's "from where") ──────────────────────────────────────────────────
// The demo has no network: each person has a fixed address from the ranges set aside for examples (RFC 5737:
// 192.0.2.x, 198.51.100.x, 203.0.113.x; the admin sits on the office's private 10.x network). Never a real address.

const DEMO_IPS: Record<number, string> = {
  1: "198.51.100.24",
  2: "198.51.100.31",
  3: "198.51.100.47",
  4: "192.0.2.14",
  5: "192.0.2.58",
  6: "192.0.2.73",
  7: "192.0.2.90",
  8: "10.20.0.5",
};

/** Where someone who isn't anyone we know signs in from (a wrong email). */
export const UNKNOWN_IP = "203.0.113.250";

/** The fixed address of a demo person (undefined: someone unknown). Anyone added later gets one from 203.0.113.x. */
export const demoIp = (userId?: number) => (userId === undefined ? UNKNOWN_IP : (DEMO_IPS[userId] ?? `203.0.113.${10 + (userId % 200)}`));

/** The device when there is no browser (the unit tests, on Node): a plain Chrome on Windows. */
export const TEST_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** The devices the old lines were written from (plain, common ones). */
const UA = {
  chromeWin: TEST_USER_AGENT,
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxUbuntu: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
};
/** Each person's devices: the CEO works on a Mac and her phone, the others on one machine each. */
const DEMO_DEVICES: Record<number, string[]> = {
  1: [UA.safariMac, UA.safariIphone],
  2: [UA.edgeWin],
  3: [UA.chromeWin],
  4: [UA.chromeWin],
  5: [UA.chromeWin, UA.chromeAndroid],
  6: [UA.firefoxUbuntu],
  7: [UA.chromeWin],
  8: [UA.firefoxUbuntu],
};

/** A small fixed hash as hex (FNV-1a), so the old lines get the same ids on every fresh demo. */
function hashHex(s: string, length: number) {
  let out = "";
  for (let round = 0; out.length < length; round++) {
    let h = 0x811c9dc5 ^ round;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

/**
 * Where an old (seeded) line came from: the person's address, one of their devices, the session of that person on
 * that day (one sign-in a day), and a request id.
 */
function seededOrigin(e: AuditEntry): Pick<AuditEntry, "ip" | "user_agent" | "session_id" | "request_id"> {
  const day = e.at.slice(0, 10);
  const devices = (e.actor_id && DEMO_DEVICES[e.actor_id]) || [UA.chromeWin];
  const device = devices[Number.parseInt(hashHex(`${e.actor_id}-${day}`, 2), 16) % devices.length];
  return {
    ip: demoIp(e.actor_id),
    user_agent: device,
    session_id: e.actor_id ? `s_${hashHex(`${e.actor_id}-${day}-${device}`, 16)}` : undefined,
    request_id: `req_${hashHex(`line-${e.id}-${e.at}`, 12)}`,
  };
}

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
  /** Group chats: a name, the people in it, and who manages it (`created_by`). */
  groups: { id: number; name: string; created_by: number; member_ids: number[]; created_at: string }[];
  messages: Omit<Message, "files">[];
  /** The last message each person has read in each chat. */
  chat_reads: { chat: string; user_id: number; last_id: number }[];
  templates: ProjectTemplate[];
  /** The review criteria (set and approved by the CEO) and the performance reviews. */
  criteria: Criteria;
  reviews: Review[];
  /** The audit log (nobody changes or removes a line), the platform settings, and each person's sign-in record. */
  audit: AuditEntry[];
  settings: Settings;
  /** `session_id`: the session the last good sign-in started (the audit log writes it on each line). */
  logins: { user_id: number; failed: number; locked_until?: string; last_login_at?: string; session_id?: string }[];
  /** The GitHub link: each project's setting, and the pull requests and commits the server got from GitHub. */
  github: GithubSettings[];
  github_items: GithubItem[];
  /** Who has seen which announcement, and when. */
  announcement_reads: { announcement_id: number; user_id: number; at: string }[];
  /** The monitoring officer's reports, feedback and problems, and what was sent to the CEO. */
  monitor_notes: MonitorNote[];
  /** Quick ratings of teams and people (a score with a reason, any time; not the periodic reviews). */
  ratings: Rating[];
  /** Each person's notification choices, by user id. */
  notification_prefs: Record<number, NotificationPrefs>;
  /** The CEO's advanced settings: only what differs from the defaults (the security numbers live in `settings`). */
  advanced: Partial<AdvancedRules>;
  /** Every save of the advanced settings, oldest first. */
  advanced_log: SettingsChange[];
  /** The last id given to each kind of record. */
  seq: {
    project: number; task: number; comment: number; event: number; phase: number; sprint: number; project_event: number; notification: number;
    attachment: number; announcement: number; bug: number; bug_event: number; direct: number; group: number; message: number; template: number; review: number; audit: number; team: number;
    note: number; advanced_change: number; rating: number;
  };
}

export function seed(now = new Date()): MockDb {
  const d = (offset: number) => today(offset, now);
  /** Whole days from today to `day` (negative = in the past). */
  const daysFrom = (day: string) => daysBetween(today(0, now), day);

  const users: User[] = [
    { id: 1, name: "مريم العبيدي", name_en: "Maryam Al-Obaidi", email: "ceo@demo.test", role: "ceo", title: "المديرة التنفيذية", active: true },
    { id: 2, name: "أحمد كريم", name_en: "Ahmed Kareem", email: "pm@demo.test", role: "pm", title: "مدير القسم", active: true },
    { id: 3, name: "هدى ناصر", name_en: "Huda Nasser", email: "monitor@demo.test", role: "monitor", title: "مسؤولة المتابعة والتقييم", active: true },
    { id: 4, name: "مصطفى جواد", name_en: "Mustafa Jawad", email: "lead@demo.test", role: "lead", title: "قائد فريق التطوير", team_id: 1, active: true },
    { id: 5, name: "سارة علي", name_en: "Sara Ali", email: "employee@demo.test", role: "employee", title: "مطورة واجهات", team_id: 1, active: true },
    { id: 6, name: "علي حسين", name_en: "Ali Hussein", email: "ali@demo.test", role: "employee", title: "مطور خوادم", team_id: 1, active: true },
    { id: 7, name: "زينب فاضل", name_en: "Zainab Fadhil", email: "zainab@demo.test", role: "employee", title: "مختبِرة جودة", team_id: 1, active: true },
    { id: 8, name: "حسن رعد", name_en: "Hassan Raad", email: "admin@demo.test", role: "admin", title: "مسؤول النظام", active: true },
  ];
  // Invented birth dates (never real ones). Sara's birthday is today and Mustafa's is in exactly a week, from today's
  // date like the other days here, so both reminders show; Huda's is 29 February. The years step by 4, so a 29 February
  // today still lands on a real day.
  const bornOn = (day: string, years: number) => `${Number(day.slice(0, 4)) - years}${day.slice(4)}`;
  const BIRTH: Record<number, string> = {
    1: "1978-06-14",
    2: "1986-09-02",
    3: "1992-02-29",
    4: bornOn(d(7), 36),
    5: bornOn(d(0), 28),
    6: "1995-12-10",
    7: "1998-01-03",
    8: "1990-04-21",
  };
  for (const u of users) u.birth_date = BIRTH[u.id];

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

  // A moment `days` ago at `hour` o'clock (and `minute`), for history and comments.
  const at = (days: number, hour = 10, minute = 0) => {
    const x = new Date(now);
    x.setDate(x.getDate() - days);
    x.setHours(hour, minute, 0, 0);
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
  // in the team's chat, and a private chat between Ahmed and Sara. Sara hasn't read the newest ones. Huda (monitoring)
  // made a group with the CEO, Ahmed and Mustafa to follow the launch; she hasn't read the CEO's last message.
  const teams: Team[] = [{ id: 1, name: "فريق التطوير", name_en: "Development team", lead_id: 4 }];
  const directs = [{ id: 1, member_ids: [2, 5] }];
  const groups = [{ id: 1, name: "متابعة الإطلاق", created_by: 3, member_ids: [3, 1, 2, 4], created_at: at(1, 8, 30) }];
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
    msg("g-1", 3, "أنشأت هذه المجموعة لمتابعة إطلاق منصة الحجز. سأرسل ملخص التقدم هنا كل أحد.", at(1, 8, 30)),
    msg("g-1", 2, "شكراً هدى. الدورة الحالية تنتهي الخميس، والتأخير الوحيد في ربط اللوحة.", at(1, 9, 15)),
    msg("g-1", 4, "أنهى الفريق نقاط الاتصال، وبقيت التجربة على الهاتف.", at(1, 13)),
    msg("g-1", 1, "جيد. أريد ملخصاً قصيراً قبل اجتماع الإدارة يوم الأحد.", at(0, 8, 45)),
  ];
  const chat_reads = [
    { chat: "p-1", user_id: 5, last_id: 2 },
    { chat: "t-1", user_id: 5, last_id: 3 },
    { chat: "p-1", user_id: 2, last_id: 6 },
    { chat: "d-1", user_id: 2, last_id: 4 },
    { chat: "g-1", user_id: 3, last_id: 9 },
    { chat: "g-1", user_id: 1, last_id: 10 },
  ];
  notifications.push({
    id: ++notificationId, user_id: 5, kind: "chat_mention", actor_id: 2, chat_key: "p-1",
    data: { note: messages[5].body }, at: at(0, 10), read: false,
  });

  // The review criteria, approved by the CEO: half counted from the tasks, half scored by the reviewer (the brief: a
  // review must not rest on the number of tasks alone). Sara has two final reviews (her trend) from her team leader.
  // The CEO changed the weights two days ago and approved them again yesterday (the audit log below has both lines).
  const criteria: Criteria = {
    items: [
      { id: "completion", name: "إنجاز المهام", name_en: "Tasks done", kind: "auto", metric: "completion", weight: 25 },
      { id: "on_time", name: "الالتزام بالمواعيد", name_en: "On time", kind: "auto", metric: "on_time", weight: 25 },
      { id: "quality", name: "جودة العمل", name_en: "Quality of work", kind: "manual", weight: 30 },
      { id: "teamwork", name: "التعاون والتواصل", name_en: "Teamwork", kind: "manual", weight: 20 },
    ],
    approved_by: 1, approved_at: at(1, 11, 5), updated_at: at(2, 14, 20),
  };
  const pastReview = (id: number, from: number, to: number, perf: { done: number; assigned: number; on_time: number; late: number }, stars: [number, number], total: number, note: string): Review => ({
    id, user_id: 5, reviewer_id: 4, period: { from: d(-from), to: d(-to) },
    scores: { completion: Math.round((perf.done / perf.assigned) * 100), on_time: Math.round(perf.on_time * 100), quality: stars[0] * 20, teamwork: stars[1] * 20 },
    criteria: structuredClone(criteria.items), total, note,
    perf: { user_id: 5, team_id: 1, assigned: perf.assigned, done: perf.done, late: perf.late, blocked: 0, completion: perf.done / perf.assigned, on_time: perf.on_time },
    state: "final", created_at: at(to - 1), finalized_at: at(to - 2),
  });
  const reviews: Review[] = [
    pastReview(1, 120, 61, { done: 6, assigned: 8, on_time: 0.67, late: 2 }, [3, 4], 66, "بداية جيدة. تحتاج إلى تقدير المواعيد بدقة أكبر."),
    pastReview(2, 60, 1, { done: 7, assigned: 8, on_time: 0.86, late: 1 }, [4, 4], 80, "تحسن واضح في الالتزام بالمواعيد وجودة الواجهات."),
  ];

  // The audit log so far: what the admin, the CEO and the PM did (newest last).
  let auditId = 0;
  // The admin changed one field of an account: its job title (from an older one) or its English name (there was none).
  // The new value is read from the account itself, so a line can never disagree with the demo people above.
  const changed = (when: string, userId: number, field: "title" | "name_en", from?: string): AuditEntry => {
    const user = users.find((u) => u.id === userId)!;
    return { id: ++auditId, actor_id: 8, action: "user_changed", target: { type: "user", id: userId, label: user.name }, changes: [{ field, ...(from ? { from } : {}), to: user[field] }], at: when };
  };
  // The admin changed one setting. The last change of each setting ends at its value in the demo settings below.
  const setting = (when: string, field: keyof Settings, from: number, to: number): AuditEntry => ({
    id: ++auditId, actor_id: 8, action: "settings_changed", target: { type: "settings", label: "الإعدادات" }, changes: [{ field, from: String(from), to: String(to) }], at: when,
  });
  const audit: AuditEntry[] = [
    { id: ++auditId, actor_id: 8, action: "team_created", target: { type: "team", id: 1, label: "فريق التطوير" }, changes: [{ field: "lead", to: "مصطفى جواد" }], at: at(45, 9) },
    ...projects.map((p): AuditEntry => ({ id: ++auditId, actor_id: p.pm_id, action: "project_created", target: { type: "project", id: p.id, label: p.name }, at: at(Math.max(0, -daysFrom(p.start)) + 2, 9) })),
    { id: ++auditId, actor_id: 1, action: "criteria_approved", target: { type: "criteria", label: "معايير التقييم" }, at: at(20) },
    { id: ++auditId, actor_id: 2, action: "sprint_closed", target: { type: "sprint", id: 2, label: "الدورة 3" }, changes: [{ field: "moved_to", to: "الدورة 4" }], at: at(7, 15) },
    { id: ++auditId, actor_id: 8, action: "user_changed", target: { type: "user", id: 7, label: "زينب فاضل" }, changes: [{ field: "team", to: "فريق التطوير" }], at: at(30, 11) },

    // The last two weeks, so the admin page's activity chart has a shape on a fresh demo. With the lines above: a quiet
    // week (13 to 7 days ago: 1, 2, 1, 1, 1, 1, 2 a day), then a busier one (6 days ago to yesterday: 2, 1, 2, 6, 2, 2)
    // with one busy day, three days ago, when the admin wrote the team's English names. Nothing is dated today.
    // The tests count on this: no wrong password and no stopped account here, and no new account or team in the last 7
    // days. A removed template or announcement is no longer in the demo data, so its line only names it.
    changed(at(13, 10, 20), 2, "title", "مدير قسم"),
    { id: ++auditId, actor_id: 8, action: "user_created", target: { type: "user", id: 3, label: "هدى ناصر" }, changes: [{ field: "role", to: "monitor" }], at: at(12, 9, 40) },
    changed(at(12, 9, 55), 3, "title", "مسؤولة المتابعة"),
    setting(at(11, 14, 10), "lock_after", 3, 5),
    { id: ++auditId, actor_id: 2, action: "template_deleted", target: { type: "template", label: "تطبيق جوال (مسودة)" }, at: at(10, 12, 30) },
    { id: ++auditId, actor_id: 1, action: "announcement_deleted", target: { type: "announcement", label: "استبيان رضا الموظفين" }, at: at(9, 9, 15) },
    changed(at(8, 11, 15), 1, "title", "المديرة العامة"),
    changed(at(7, 10, 30), 6, "title", "مطور"),

    setting(at(6, 9, 30), "due_soon_days", 1, 2),
    changed(at(6, 13, 45), 4, "title", "قائد فريق"),
    changed(at(5, 10, 5), 5, "title", "مطورة"),
    // The admin's first maintenance notice named the wrong night: removed, then posted again (announcement 2 above).
    { id: ++auditId, actor_id: 8, action: "announcement_deleted", target: { type: "announcement", label: "صيانة الخوادم ليلة الجمعة" }, at: at(4, 10, 50) },
    changed(at(4, 12, 40), 7, "title", "مختبِرة"),
    ...[4, 5, 6, 7, 3].map((userId, i) => changed(at(3, 10, 12 + i * 3), userId, "name_en")),
    setting(at(3, 14, 5), "due_soon_days", 2, 1),
    // The CEO moved weight from the counted numbers to the quality of the work, and approved the criteria again.
    {
      id: ++auditId, actor_id: 1, action: "criteria_changed", target: { type: "criteria", label: "معايير التقييم" }, at: criteria.updated_at,
      changes: [{ field: "items", from: criteria.items.map((c, i) => `${c.name} ${[30, 30, 20, 20][i]}`).join("، "), to: criteria.items.map((c) => `${c.name} ${c.weight}`).join("، ") }],
    },
    { id: ++auditId, actor_id: 1, action: "criteria_approved", target: { type: "criteria", label: "معايير التقييم" }, at: criteria.approved_at! },
    changed(at(1, 15, 40), 2, "name_en"),
  ];
  audit.sort((a, b) => a.at.localeCompare(b.at)).forEach((e, i) => {
    e.id = i + 1;
    Object.assign(e, seededOrigin(e));
  });

  // GitHub is on for project 1 (two repositories). Made-up pull requests and commits that mention task and bug codes.
  const github: GithubSettings[] = [{ project_id: 1, enabled: true, repos: ["aljadreyah/booking-web", "aljadreyah/booking-api"] }];
  const gh = (id: string, kind: "pr" | "commit", repo: string, ref: string, title: string, author: string, when: string, state?: GithubItem["state"]): GithubItem => ({
    id, kind, repo, ref, title, author, at: when, state,
    url: kind === "pr" ? `https://github.com/${repo}/pull/${ref.replace("#", "")}` : `https://github.com/${repo}/commit/${ref}`,
  });
  const github_items: GithubItem[] = [
    gh("pr-41", "pr", "aljadreyah/booking-web", "#41", "TSK-104: ربط لوحة كانبان بواجهة المهام", "mustafa-j", at(1, 14), "open"),
    gh("c-9f2a1c3", "commit", "aljadreyah/booking-web", "9f2a1c3", "TSK-104 board loads tasks from /projects/:id/tasks", "mustafa-j", at(1, 12)),
    gh("c-1b7e004", "commit", "aljadreyah/booking-api", "1b7e004", "TSK-104 tasks endpoint with statuses", "ali-h", at(2, 16)),
    gh("pr-38", "pr", "aljadreyah/booking-api", "#38", "TSK-085 roles and permissions", "ali-h", at(5, 10), "merged"),
    gh("pr-40", "pr", "aljadreyah/booking-web", "#40", "Fix BUG-1: login button on phones", "sara-a", at(0, 11), "open"),
    gh("c-77d0e1a", "commit", "aljadreyah/booking-web", "77d0e1a", "BUG-1 bigger tap area for the login button", "sara-a", at(0, 10)),
    gh("pr-12", "pr", "someone/elsewhere", "#12", "TSK-104 in another company's repo (not linked)", "x", at(1, 9), "open"),
  ];

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

  // The monitoring officer's notes: a team report the CEO answered, feedback on Sara not sent yet, and a problem she
  // sent this morning that the CEO has not opened.
  const monitor_notes: MonitorNote[] = [
    {
      id: 1, kind: "report", title: "تقرير متابعة فريق التطوير: الأسبوع الثالث", author_id: 3, created_at: at(2, 13), sent_at: at(2, 14), ceo_state: "seen",
      about: { type: "team", id: 1, label: "فريق التطوير", label_en: "Development team" },
      body: "أنجز الفريق ثلاث مهام من عشر في منصة الحجز. التأخير في مهمتين سببه انتظار صلاحيات الوصول من جهة العميل. أقترح متابعة الصلاحيات يومياً حتى تُحل.",
      ceo_reply: "شكراً هدى. سأكلم العميل اليوم بشأن الصلاحيات، ولنراجع الوضع في اجتماع الخميس.", replied_at: at(1, 10),
    },
    {
      id: 2, kind: "feedback", tone: "praise", title: "عمل مرتب في صفحة الإعلانات", author_id: 3, created_at: at(1, 12),
      about: { type: "person", id: 5, label: "سارة علي", label_en: "Sara Ali" },
      body: "سارة سلّمت أجزاء صفحة الإعلانات بترتيب واضح وكتبت ملاحظات مفيدة للمراجعة. تستحق الشكر.",
    },
    {
      id: 3, kind: "problem", title: "منصة الحجز متأخرة عن خطتها", author_id: 3, created_at: at(0, 9), sent_at: at(0, 9), ceo_state: "new",
      about: { type: "project", id: 1, label: "منصة الحجز الإلكتروني", label_en: "Online booking platform" },
      body: "الإنجاز 20% والخطة 62%. مهمتان متأخرتان وواحدة متوقفة. تحتاج قراراً: تمديد الموعد أو إضافة مطور.",
    },
  ];

  // Quick ratings: the development team over five months (better lately), one private note only the CEO and Huda see,
  // and two about Sara. Older than a day, so they are history now (nobody can change them but the CEO).
  const ratings: Rating[] = [
    {
      id: 1, subject_type: "team", subject_id: 1, rater_id: 3, score: 3, reason_type: "deadlines", created_at: at(130, 11),
      reason: "تأخر تسليم النماذج الأولى أسبوعاً عن الموعد المتفق عليه، مع أن الجودة كانت مقبولة.",
    },
    {
      id: 2, subject_type: "team", subject_id: 1, rater_id: 1, score: 3, reason_type: "quality", created_at: at(100, 9),
      reason: "ظهرت أخطاء كثيرة في الاختبار الأول. نحتاج مراجعة أدق قبل التسليم.",
    },
    {
      id: 3, subject_type: "team", subject_id: 1, rater_id: 2, score: 4, reason_type: "teamwork", created_at: at(30, 14), project_id: 1,
      project_name: "منصة الحجز الإلكتروني", project_name_en: "Online booking platform",
      reason: "تنسيق جيد بين الواجهات والخوادم في الدورة الثالثة، والاجتماعات اليومية قصيرة ومفيدة.",
    },
    {
      id: 4, subject_type: "team", subject_id: 1, rater_id: 3, score: 5, reason_type: "incident", created_at: at(12, 22),
      reason: "توقف خادم الاختبار ليلة الخميس، فأعاده الفريق خلال ساعة وكتب ما حدث وكيف يُمنع تكراره.",
    },
    {
      id: 5, subject_type: "team", subject_id: 1, rater_id: 3, score: 2, reason_type: "attitude", created_at: at(3, 16), private: true,
      reason: "ملاحظة للإدارة فقط: تأخر الحضور إلى اجتماع العميل مرتين هذا الأسبوع.",
    },
    {
      id: 6, subject_type: "person", subject_id: 5, rater_id: 2, score: 4, reason_type: "deadlines", created_at: at(45, 10), project_id: 1,
      project_name: "منصة الحجز الإلكتروني", project_name_en: "Online booking platform",
      reason: "سلّمت شاشات الحجز في موعدها رغم تغيّر التصميم في آخر لحظة.",
    },
    {
      id: 7, subject_type: "person", subject_id: 5, rater_id: 3, score: 5, reason_type: "quality", created_at: at(6, 12),
      reason: "صفحة الإعلانات مرتبة وسهلة القراءة على الهاتف، وكتبت ملاحظات مفيدة للمراجعة.",
    },
  ].map((r) => ({ private: false, ...r }) as Rating);

  return {
    monitor_notes, ratings,
    users, projects, sprints, tasks, comments, events, project_events, notifications, notification_prefs: {}, attachments,
    announcements, announcement_reads, bugs, bug_events, teams, directs, groups, messages, chat_reads, templates, criteria, reviews, audit, settings: { due_soon_days: 1, lock_after: 5, lock_minutes: 15 }, logins: [],
    github, github_items,
    advanced: {}, advanced_log: [],
    seq: {
      project: projects.length, task: id, comment: commentId, event: eventId, phase: 3, sprint: sprints.length,
      project_event: projectEventId, notification: notificationId, attachment: attachments.length, announcement: announcements.length,
      bug: bugs.length, bug_event: bugEventId, direct: directs.length, group: groups.length, message: messageId, template: templates.length, review: reviews.length, audit: audit.length, team: teams.length,
      note: monitor_notes.length, advanced_change: 0, rating: ratings.length,
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
