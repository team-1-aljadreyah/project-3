// The CEO's advanced settings: who may open them, every default, and the checks. Pure functions used by the page (to
// show mistakes as you type, and "Changed" beside what differs from the default) and by the demo backend (to refuse
// the same mistakes with 422, and to keep only what differs). docs/backend.md section 17 lists them for the server.
import { DEFAULT_SETTINGS, SETTING_RANGE } from "@/features/admin";
import type { Severity } from "@/features/bugs";
import { NOTIFICATION_KINDS, REQUIRED_NOTIFICATIONS, type NotificationKind } from "@/shared/api/notification-kinds";
import type { Priority, Role, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import { ALL_FEATURES_ON, FEATURE_KEYS, type FeatureKey, type SiteLive } from "@/shared/lib/site";
import type { ActionKey, AdvancedRules, Approver, CodeKind, StaffRole } from "./types";

/** The advanced settings are the CEO's alone (page and server). */
export const canUseAdvancedSettings = (user: Pick<User, "role">) => isCeo(user);

export const ALL_ROLES: Role[] = ["ceo", "pm", "monitor", "lead", "employee", "admin"];
export const STAFF_ROLES: StaffRole[] = ["pm", "monitor", "lead", "employee", "admin"];

/** The week as the company reads it, Saturday first. The number is JavaScript's day (0 = Sunday). */
export const WEEK: { day: number; ar: string; en: string }[] = [
  { day: 6, ar: "السبت", en: "Sat" },
  { day: 0, ar: "الأحد", en: "Sun" },
  { day: 1, ar: "الاثنين", en: "Mon" },
  { day: 2, ar: "الثلاثاء", en: "Tue" },
  { day: 3, ar: "الأربعاء", en: "Wed" },
  { day: 4, ar: "الخميس", en: "Thu" },
  { day: 5, ar: "الجمعة", en: "Fri" },
];

export const PRIORITIES: Priority[] = ["high", "medium", "low"];
export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
export const SEVERITY_WORDS: Record<Severity, { ar: string; en: string }> = {
  critical: { ar: "حرجة", en: "Critical" },
  high: { ar: "عالية", en: "High" },
  medium: { ar: "متوسطة", en: "Medium" },
  low: { ar: "منخفضة", en: "Low" },
};

export type ActionGroup = "work" | "talk" | "people" | "bugs";

export interface ActionDef {
  key: ActionKey;
  group: ActionGroup;
  ar: string;
  en: string;
  /** Today's rule (what the platform did before this table). */
  def: StaffRole[];
  /** Not a button in the platform yet: the choice is kept for when it comes. */
  later?: boolean;
}

/**
 * Who may do what. The defaults are today's rules in the features' rules.ts files: tasks are managed by the project's PM
 * and its team leaders (tasks/rules.ts canManageTasks, canApprove), projects are created by PMs (projects/rules.ts),
 * announcements are posted by monitoring and the admin (announcements/rules.ts), group chats are made by monitoring, PMs
 * and leaders (chat/rules.ts), scores are seen by PMs, monitoring and leaders, reviews written by PMs and leaders
 * (performance/rules.ts), reports by PMs, monitoring and leaders (reports/rules.ts), and every job but the admin
 * reports bugs (bugs/rules.ts canReportBug).
 */
export const ACTIONS: ActionDef[] = [
  { key: "create_project", group: "work", ar: "إنشاء مشروع", en: "Create a project", def: ["pm"] },
  { key: "close_project", group: "work", ar: "إغلاق مشروع", en: "Close a project", def: ["pm"] },
  { key: "delete_task", group: "work", ar: "حذف مهمة", en: "Delete a task", def: ["pm", "lead"], later: true },
  { key: "reassign_task", group: "work", ar: "إسناد مهمة إلى شخص آخر", en: "Give a task to someone else", def: ["pm", "lead"] },
  { key: "change_due", group: "work", ar: "تغيير موعد التسليم", en: "Change a due date", def: ["pm", "lead"] },
  { key: "approve_done", group: "work", ar: "اعتماد إكمال مهمة", en: "Approve a task as done", def: ["pm", "lead"] },
  { key: "post_announcement", group: "talk", ar: "نشر إعلان", en: "Post an announcement", def: ["monitor", "admin"] },
  { key: "create_group_chat", group: "talk", ar: "إنشاء مجموعة محادثة", en: "Create a group chat", def: ["pm", "monitor", "lead"] },
  { key: "see_scores", group: "people", ar: "رؤية درجات الأداء", en: "See performance scores", def: ["pm", "monitor", "lead"] },
  { key: "write_reviews", group: "people", ar: "كتابة تقييمات الأداء", en: "Write performance reviews", def: ["pm", "lead"] },
  { key: "see_reports", group: "people", ar: "رؤية التقارير", en: "See the reports", def: ["pm", "monitor", "lead"] },
  { key: "export_csv", group: "people", ar: "تنزيل ملفات CSV", en: "Download CSV files", def: ["pm", "monitor", "lead", "admin"] },
  { key: "report_bugs", group: "bugs", ar: "تسجيل مشكلة برمجية", en: "Report a bug", def: ["pm", "monitor", "lead", "employee"] },
  { key: "bug_severity", group: "bugs", ar: "تغيير خطورة مشكلة", en: "Change a bug's severity", def: ["pm", "lead"] },
];

export const ACTION_GROUPS: Record<ActionGroup, { ar: string; en: string }> = {
  work: { ar: "المشاريع والمهام", en: "Projects and tasks" },
  talk: { ar: "الإعلانات والمحادثات", en: "Announcements and chat" },
  people: { ar: "الأداء والتقارير", en: "Performance and reports" },
  bugs: { ar: "المشكلات البرمجية", en: "Bugs" },
};

/** The features the CEO can switch off, in words. */
export const FEATURES: { key: FeatureKey; ar: string; en: string; hint_ar: string; hint_en: string }[] = [
  { key: "chat", ar: "المحادثات", en: "Chat", hint_ar: "صفحة المحادثات كلها: المشاريع والفرق والخاصة والمجموعات.", hint_en: "The whole chat page: project, team, private and group chats." },
  { key: "group_chats", ar: "مجموعات المحادثة", en: "Group chats", hint_ar: "إنشاء مجموعات جديدة. المجموعات الموجودة تبقى.", hint_en: "Making new groups. Existing groups stay." },
  { key: "bugs", ar: "المشكلات البرمجية", en: "Bugs", hint_ar: "صفحة المشكلات وتسجيل مشكلة جديدة.", hint_en: "The bugs page and reporting a new bug." },
  { key: "reviews", ar: "تقييمات الأداء", en: "Performance reviews", hint_ar: "صفحة الأداء وكتابة التقييمات.", hint_en: "The performance page and writing reviews." },
  { key: "announcements", ar: "الإعلانات", en: "Announcements", hint_ar: "صفحة الإعلانات ونشر إعلان جديد.", hint_en: "The announcements page and posting a new one." },
  { key: "requests", ar: "الطلبات إلى المدير التنفيذي", en: "Requests to the CEO", hint_ar: "صفحة «طلباتي» وإرسال طلب إلى المدير التنفيذي.", hint_en: "The «My requests» page and sending a request to the CEO." },
  { key: "github", ar: "ربط GitHub", en: "GitHub links", hint_ar: "طلبات السحب والإيداعات على المهام، وإعداد الربط في المشاريع.", hint_en: "Pull requests and commits on tasks, and the link's setup in projects." },
  { key: "welcome", ar: "شاشة الترحيب", en: "The welcome splash", hint_ar: "التحية القصيرة عند فتح المنصة.", hint_en: "The short greeting when the platform opens." },
];

export const CODE_KINDS: { key: CodeKind; ar: string; en: string; example: number }[] = [
  { key: "task", ar: "المهام", en: "Tasks", example: 1042 },
  { key: "project", ar: "المشاريع", en: "Projects", example: 4 },
  { key: "bug", ar: "المشكلات البرمجية", en: "Bugs", example: 12 },
];

export const APPROVERS: { key: Approver; ar: string; en: string }[] = [
  { key: "either", ar: "مدير المشروع أو قائد الفريق", en: "The PM or a team leader" },
  { key: "pm", ar: "مدير المشروع فقط", en: "The PM only" },
  { key: "lead", ar: "قائد الفريق فقط", en: "A team leader only" },
];

/** The limits the page and the server share. */
export const LIMITS = {
  due_days: [1, 90] as [number, number],
  fix_days: [1, 60] as [number, number],
  wip_limit: [0, 50] as [number, number],
  password_min: [6, 32] as [number, number],
  holidays: 60,
  holidayName: 60,
  banner: 300,
  readOnly: 300,
};

/** What the platform did before any of this was a setting. */
export const DEFAULT_RULES: AdvancedRules = {
  work: { days: [0, 1, 2, 3, 4], from: "08:00", to: "16:00", holidays: [] },
  due_days: { high: 3, medium: 7, low: 14 },
  fix_days: { critical: 1, high: 3, medium: 7, low: 14 },
  tasks: { approver: "either", employee_reopen: true, due_reason: false, wip_limit: 0 },
  permissions: Object.fromEntries(ACTIONS.map((a) => [a.key, a.def])) as Record<ActionKey, StaffRole[]>,
  notify: Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, ALL_ROLES])) as Record<NotificationKind, Role[]>,
  features: ALL_FEATURES_ON,
  security: { ...DEFAULT_SETTINGS, password_min: 8 },
  names: { task: "TSK", project: "PRJ", bug: "BUG" },
  banner: null,
  read_only: { on: false, message: "" },
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The rules in force: the defaults, with what the CEO changed on top (each part merged one level down, so a setting
 * added later is simply its default). `admin` = the administration's settings, which are the first three security values.
 */
export function rulesOf(stored?: Partial<AdvancedRules> | null, admin?: Partial<AdvancedRules["security"]>): AdvancedRules {
  const s = stored ?? {};
  const D = DEFAULT_RULES;
  return {
    work: { ...D.work, ...s.work },
    due_days: { ...D.due_days, ...s.due_days },
    fix_days: { ...D.fix_days, ...s.fix_days },
    tasks: { ...D.tasks, ...s.tasks },
    permissions: { ...D.permissions, ...s.permissions },
    notify: { ...D.notify, ...s.notify },
    features: { ...D.features, ...s.features },
    security: { ...D.security, ...s.security, ...admin },
    names: { ...D.names, ...s.names },
    banner: s.banner === undefined ? D.banner : s.banner,
    read_only: { ...D.read_only, ...s.read_only },
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the parts that differ from the defaults (what is saved). */
export function changedRules(r: AdvancedRules): Partial<AdvancedRules> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_RULES) as (keyof AdvancedRules)[]) {
    if (!same(r[k], DEFAULT_RULES[k])) out[k] = r[k];
  }
  return out as Partial<AdvancedRules>;
}

/** Arrays of jobs or days compare as sets (the order of the ticks doesn't matter). */
const norm = (v: unknown): unknown => (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number") ? [...v].sort() : v);

/**
 * Every setting that really differs between two sets of rules, one level down ("work.days", "permissions.change_due",
 * "banner"), from → to. Both sides are merged rules, so a setting nobody touched never shows (Project 2 wrote
 * "— → 21" on the first save; this doesn't).
 */
export function diffRules(before: AdvancedRules, after: AdvancedRules): { key: string; from: unknown; to: unknown }[] {
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const k of Object.keys(DEFAULT_RULES) as (keyof AdvancedRules)[]) {
    const a = before[k] as unknown;
    const b = after[k] as unknown;
    if (isObj(a) && isObj(b)) {
      for (const sub of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!same(norm(a[sub]), norm(b[sub]))) out.push({ key: `${k}.${sub}`, from: a[sub] ?? null, to: b[sub] ?? null });
      }
    } else if (!same(a, b)) out.push({ key: k, from: a ?? null, to: b ?? null });
  }
  return out;
}

/** How many settings differ from the defaults (the home's count). */
export const changedCount = (r: AdvancedRules) => diffRules(DEFAULT_RULES, r).length;

/** A problem with a setting, in both languages: { "work.days": { ar, en } }. */
export type Problems = Record<string, { ar: string; en: string }>;

const whole = (v: unknown, [lo, hi]: [number, number]) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const isTime = (t: unknown) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const isDay = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const range = ([lo, hi]: [number, number]) => ({ ar: `من ${lo} إلى ${hi}`, en: `${lo} to ${hi}` });

/** A working day: one of the working days and not a holiday. `day` is YYYY-MM-DD. */
export function isWorkDay(r: Pick<AdvancedRules, "work">, day: string) {
  const weekday = new Date(`${day}T00:00:00`).getDay();
  return r.work.days.includes(weekday) && !r.work.holidays.some((h) => h.date === day);
}

/** Working days after `from` up to and including `to` (0 when `to` is not later). Both YYYY-MM-DD. */
export function workDaysBetween(r: Pick<AdvancedRules, "work">, from: string, to: string) {
  let n = 0;
  const d = new Date(`${from}T00:00:00`);
  for (let i = 0; i < 3660; i++) {
    d.setDate(d.getDate() + 1);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (day > to) break;
    if (isWorkDay(r, day)) n++;
  }
  return n;
}

/** What is wrong with a set of rules (empty = fine). The same check on the page and on the server. */
export function checkRules(r: AdvancedRules): Problems {
  const e: Problems = {};
  const w = r.work;
  if (!Array.isArray(w.days) || w.days.some((d) => !whole(d, [0, 6])) || new Set(w.days).size !== w.days.length) e["work.days"] = { ar: "أيام غير صحيحة", en: "Wrong days" };
  else if (!w.days.length) e["work.days"] = { ar: "اختر يوم عمل واحداً على الأقل", en: "Choose at least one working day" };
  if (!isTime(w.from) || !isTime(w.to) || minutes(w.from) >= minutes(w.to)) e["work.hours"] = { ar: "البداية قبل النهاية", en: "The start comes before the end" };
  if (!Array.isArray(w.holidays) || w.holidays.length > LIMITS.holidays) e["work.holidays"] = { ar: `حتى ${LIMITS.holidays} عطلة`, en: `Up to ${LIMITS.holidays} holidays` };
  else if (w.holidays.some((h) => !isDay(h.date) || !h.name?.trim() || h.name.length > LIMITS.holidayName || (h.name_en?.length ?? 0) > LIMITS.holidayName)) e["work.holidays"] = { ar: "لكل عطلة تاريخ واسم", en: "Each holiday needs a date and a name" };
  else if (new Set(w.holidays.map((h) => h.date)).size !== w.holidays.length) e["work.holidays"] = { ar: "عطلتان في اليوم نفسه", en: "Two holidays on the same day" };

  for (const p of PRIORITIES) if (!whole(r.due_days[p], LIMITS.due_days)) e[`due_days.${p}`] = range(LIMITS.due_days);
  for (const s of SEVERITIES) if (!whole(r.fix_days[s], LIMITS.fix_days)) e[`fix_days.${s}`] = range(LIMITS.fix_days);
  // A worse bug never waits longer than a lighter one.
  for (let i = 1; i < SEVERITIES.length; i++) {
    const [worse, lighter] = [SEVERITIES[i - 1], SEVERITIES[i]];
    if (!e[`fix_days.${lighter}`] && !e[`fix_days.${worse}`] && r.fix_days[lighter] < r.fix_days[worse]) {
      e[`fix_days.${lighter}`] = { ar: `لا يقل عن «${SEVERITY_WORDS[worse].ar}»`, en: `Not less than ${SEVERITY_WORDS[worse].en.toLowerCase()}` };
    }
  }

  if (!APPROVERS.some((a) => a.key === r.tasks.approver)) e["tasks.approver"] = { ar: "اختر واحداً", en: "Choose one" };
  if (typeof r.tasks.employee_reopen !== "boolean") e["tasks.employee_reopen"] = { ar: "نعم أو لا", en: "Yes or no" };
  if (typeof r.tasks.due_reason !== "boolean") e["tasks.due_reason"] = { ar: "نعم أو لا", en: "Yes or no" };
  if (!whole(r.tasks.wip_limit, LIMITS.wip_limit)) e["tasks.wip_limit"] = { ar: "من 0 (بلا حد) إلى 50", en: "0 (no limit) to 50" };

  for (const [k, roles] of Object.entries(r.permissions)) {
    if (!ACTIONS.some((a) => a.key === k) || !Array.isArray(roles) || roles.some((x) => !STAFF_ROLES.includes(x))) e[`permissions.${k}`] = { ar: "وظائف غير صحيحة", en: "Wrong jobs" };
  }
  for (const [k, roles] of Object.entries(r.notify)) {
    if (!NOTIFICATION_KINDS.includes(k as NotificationKind) || !Array.isArray(roles) || roles.some((x) => !ALL_ROLES.includes(x))) e[`notify.${k}`] = { ar: "وظائف غير صحيحة", en: "Wrong jobs" };
    else if (REQUIRED_NOTIFICATIONS.has(k as NotificationKind) && ALL_ROLES.some((x) => !roles.includes(x))) e[`notify.${k}`] = { ar: "إشعار مطلوب: يصل الجميع", en: "A required notification: it reaches everyone" };
  }
  for (const [k, v] of Object.entries(r.features)) {
    if (!FEATURE_KEYS.includes(k as FeatureKey) || typeof v !== "boolean") e[`features.${k}`] = { ar: "تشغيل أو إيقاف", en: "On or off" };
  }

  for (const k of Object.keys(SETTING_RANGE) as (keyof typeof SETTING_RANGE)[]) {
    if (!whole(r.security[k], SETTING_RANGE[k])) e[`security.${k}`] = range(SETTING_RANGE[k]);
  }
  if (!whole(r.security.password_min, LIMITS.password_min)) e["security.password_min"] = range(LIMITS.password_min);

  const seen = new Map<string, CodeKind>();
  for (const { key } of CODE_KINDS) {
    const v = r.names[key];
    if (typeof v !== "string" || !/^[A-Z]{2,5}$/.test(v)) e[`names.${key}`] = { ar: "من 2 إلى 5 أحرف إنجليزية كبيرة", en: "2 to 5 capital letters A to Z" };
    else if (seen.has(v)) e[`names.${key}`] = { ar: "مستعملة لنوع آخر", en: "Used by another kind" };
    else seen.set(v, key);
  }

  const b = r.banner;
  if (b) {
    if (!b.text?.trim() || b.text.length > LIMITS.banner) e["banner.text"] = { ar: `اكتب نص الإعلان (حتى ${LIMITS.banner} حرف)`, en: `Write the banner (up to ${LIMITS.banner} letters)` };
    if ((b.text_en?.length ?? 0) > LIMITS.banner) e["banner.text_en"] = { ar: `حتى ${LIMITS.banner} حرف`, en: `Up to ${LIMITS.banner} letters` };
    if (!Array.isArray(b.roles) || b.roles.some((x) => !ALL_ROLES.includes(x))) e["banner.roles"] = { ar: "وظائف غير صحيحة", en: "Wrong jobs" };
    if (b.tone !== "info" && b.tone !== "warning") e["banner.tone"] = { ar: "اختر لوناً", en: "Choose a colour" };
    if (b.until !== undefined && Number.isNaN(Date.parse(b.until))) e["banner.until"] = { ar: "تاريخ غير صحيح", en: "Not a valid date" };
  }
  const ro = r.read_only;
  if (typeof ro.on !== "boolean") e["read_only.on"] = { ar: "تشغيل أو إيقاف", en: "On or off" };
  if (ro.on && !ro.message?.trim()) e["read_only.message"] = { ar: "اكتب رسالة للموظفين", en: "Write a message for the staff" };
  if ((ro.message?.length ?? 0) > LIMITS.readOnly || (ro.message_en?.length ?? 0) > LIMITS.readOnly) e["read_only.message"] = { ar: `حتى ${LIMITS.readOnly} حرف`, en: `Up to ${LIMITS.readOnly} letters` };
  return e;
}

/**
 * What one person gets (GET /site/live): the switches, the banner if it is for their job and has not ended, and the
 * read-only mode.
 */
export function liveFor(r: AdvancedRules, role: Role, now = new Date()): SiteLive {
  const b = r.banner;
  const forMe = !!b && (!b.roles.length || b.roles.includes(role)) && (!b.until || Date.parse(b.until) > now.getTime());
  return { features: r.features, banner: forMe ? b : null, read_only: r.read_only };
}

/** The words the quick find knows each part by (the names of the settings inside it), Arabic and English. */
export const PART_WORDS: Record<string, string> = {
  home: "صحة متأخرة مشاريع حسابات health overdue late accounts",
  work: "دوام أيام عمل ساعات عطلة عطل جمعة سبت موعد تسليم أولوية خطورة إصلاح working days hours holiday due priority severity fix",
  tasks: "اعتماد إكمال إعادة فتح سبب موعد حد مهام قيد التنفيذ approve done reopen reason due limit progress wip",
  permissions: "صلاحيات من يحق إنشاء إغلاق حذف إسناد موعد اعتماد إعلان مجموعة درجات تقييم تقارير تنزيل CSV خطورة rights who may create close delete assign approve scores reviews reports export severity",
  notify: "إشعارات من يصله إشعار notifications who gets",
  features: "تشغيل إيقاف ميزات محادثات مجموعات مشكلات تقييمات إعلانات طلبات GitHub ترحيب features switch chat groups bugs reviews announcements requests welcome",
  security: "دخول كلمة مرور قفل محاولات تذكير أمان sign in password lock attempts security reminder",
  names: "بادئة أرقام رموز TSK PRJ BUG prefix codes numbers",
  announce: "إعلان شريط قراءة فقط تعديل banner read only",
  history: "سجل ملف تصدير استيراد تنزيل افتراضي إرجاع history file export import download default reset",
};
