// The demo data: invented people and projects (never real ones), with dates around today so "late",
// "due today" and the sprint always look current. Demo accounts exist only here, in the demo build.
import { DEFAULT_STATUSES } from "../../tasks";
import { today } from "../../utils";
import type { Priority, Project, Sprint, Task, TaskStatus, User } from "../types";

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
}

export function seed(now = new Date()): MockDb {
  const d = (offset: number) => today(offset, now);

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
    },
    {
      id: 2, code: "PRJ-2", name: "تطبيق المبيعات", name_en: "Sales app",
      description: "تطبيق لمندوبي المبيعات لتسجيل الطلبات والزيارات.",
      pm_id: 2, member_ids: [2, 4, 6], start: d(-20), end: d(50), state: "active", priority: "medium",
      uses_sprints: false, statuses: DEFAULT_STATUSES,
    },
    {
      id: 3, code: "PRJ-3", name: "حملة التسويق الشتوية", name_en: "Winter marketing campaign",
      description: "حملة إعلانية للموسم الشتوي، دون مراحل ولا دورات.",
      pm_id: 2, member_ids: [2, 7], start: d(5), end: d(45), state: "planned", priority: "low",
      uses_sprints: false, statuses: campaignStatuses,
    },
  ];

  const sprints: Sprint[] = [{ id: 1, project_id: 1, name: "الدورة 4", start: d(-6), end: d(5), planned_ratio: 0 }];

  let id = 0;
  const task = (
    project_id: number, code: string, title: string, status: string, priority: Priority,
    assignee_id: number, due: number, sub: [number, number], blocked_reason?: string,
  ): Task => ({
    id: ++id, code, project_id, title, description: "", status, priority, assignee_id,
    sprint_id: project_id === 1 ? 1 : undefined, start: d(due - 7), due: d(due),
    subtasks_done: sub[0], subtasks_total: sub[1], blocked_reason, updated_at: new Date(now).toISOString(),
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

  return { users, projects, sprints, tasks };
}
