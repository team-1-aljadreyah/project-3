// The settings in words, for the history ("Working days: Sun, Mon → Sun, Mon, Tue") and the import dialog.
import { KIND_WORDS } from "@/features/notifications";
import type { Role } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import type { Tr } from "@/shared/lib/i18n";
import { ACTIONS, APPROVERS, CODE_KINDS, FEATURES, SEVERITY_WORDS, WEEK } from "./rules";

const PRIORITY_WORDS: Record<string, [string, string]> = { high: ["عالية", "high"], medium: ["متوسطة", "medium"], low: ["منخفضة", "low"] };

/** Names of every setting, by its key in the history. */
const NAMES: Record<string, [string, string]> = {
  "work.days": ["أيام العمل", "Working days"],
  "work.from": ["بداية الدوام", "Work starts"],
  "work.to": ["نهاية الدوام", "Work ends"],
  "work.holidays": ["العطل الرسمية", "Holidays"],
  "tasks.approver": ["من يعتمد إكمال المهمة", "Who approves a task as done"],
  "tasks.employee_reopen": ["إعادة الموظف فتح مهمته", "Employees reopen their tasks"],
  "tasks.due_reason": ["سبب لتغيير الموعد", "A reason to change a due date"],
  "tasks.wip_limit": ["حد المهام قيد التنفيذ", "Tasks in progress limit"],
  "security.due_soon_days": ["تذكير قرب الموعد قبل", "Due-soon reminder, days before"],
  "security.lock_after": ["القفل بعد محاولات خاطئة", "Lock after wrong passwords"],
  "security.lock_minutes": ["مدة القفل", "Lock time"],
  "security.password_min": ["أقصر كلمة مرور", "Shortest password"],
  banner: ["إعلان أعلى الصفحات", "Banner"],
  "banner.text": ["نص الإعلان", "Banner text"],
  "banner.text_en": ["نص الإعلان بالإنجليزية", "Banner text in English"],
  "banner.roles": ["لمن يظهر الإعلان", "Banner for"],
  "banner.tone": ["لون الإعلان", "Banner colour"],
  "banner.until": ["نهاية الإعلان", "Banner ends"],
  "read_only.on": ["وضع القراءة فقط", "Read-only mode"],
  "read_only.message": ["رسالة وضع القراءة فقط", "Read-only message"],
  "read_only.message_en": ["رسالة وضع القراءة فقط بالإنجليزية", "Read-only message in English"],
};

/** A history line's name: "أيام العمل", "من يحق له: إنشاء مشروع", "إشعار «تعليق جديد»". */
export function keyName(key: string, tr: Tr): string {
  if (NAMES[key]) return tr(NAMES[key][0], NAMES[key][1]);
  const [group, part] = key.split(".");
  if (group === "due_days" && PRIORITY_WORDS[part]) return tr(`موعد المهمة، أولوية ${PRIORITY_WORDS[part][0]}`, `Due days, ${PRIORITY_WORDS[part][1]} priority`);
  if (group === "fix_days" && part in SEVERITY_WORDS) {
    const s = SEVERITY_WORDS[part as keyof typeof SEVERITY_WORDS];
    return tr(`مهلة إصلاح مشكلة ${s.ar}`, `Fix target, ${s.en.toLowerCase()} bug`);
  }
  if (group === "permissions") {
    const a = ACTIONS.find((x) => x.key === part);
    return a ? tr(`من يحق له: ${a.ar}`, `Who may: ${a.en}`) : key;
  }
  if (group === "notify") {
    const w = KIND_WORDS[part as keyof typeof KIND_WORDS];
    return w ? tr(`إشعار «${w.ar}»`, `"${w.en}" notification`) : key;
  }
  if (group === "features") {
    const f = FEATURES.find((x) => x.key === part);
    return f ? tr(`ميزة ${f.ar}`, `${f.en} feature`) : key;
  }
  if (group === "names") {
    const k = CODE_KINDS.find((x) => x.key === part);
    return k ? tr(`بادئة رموز ${k.ar}`, `${k.en} code prefix`) : key;
  }
  return key;
}

const roleList = (v: unknown[], tr: Tr) => (v.length ? v.map((r) => (ROLES[r as Role] ? tr(ROLES[r as Role].ar, ROLES[r as Role].en) : String(r))).join(tr("، ", ", ")) : tr("لا أحد", "Nobody"));

/** A history value in words: on/off, jobs and days by name, the banner as its text. */
export function showValue(key: string, v: unknown, tr: Tr): string {
  if (v === null || v === undefined || v === "") return key === "banner" ? tr("بلا إعلان", "None") : "-";
  if (typeof v === "boolean") return key.startsWith("features.") || key === "read_only.on" ? (v ? tr("مفعّل", "On") : tr("متوقف", "Off")) : v ? tr("نعم", "Yes") : tr("لا", "No");
  if (typeof v === "number") return key === "tasks.wip_limit" && v === 0 ? tr("بلا حد", "No limit") : String(v);
  if (typeof v === "string") {
    if (key === "tasks.approver") {
      const a = APPROVERS.find((x) => x.key === v);
      return a ? tr(a.ar, a.en) : v;
    }
    if (key === "banner.tone") return v === "warning" ? tr("تنبيه", "Warning") : tr("معلومة", "Info");
    return v;
  }
  if (Array.isArray(v)) {
    if (key === "work.days") return WEEK.filter((d) => v.includes(d.day)).map((d) => tr(d.ar, d.en)).join(tr("، ", ", ")) || "-";
    // The date is isolated (left to right), so an Arabic line doesn't turn it round.
    if (key === "work.holidays") return (v as { date: string; name: string }[]).map((h) => `${h.name} ⁦${h.date}⁩`).join(tr("، ", ", ")) || tr("بلا عطل", "None");
    return roleList(v, tr);
  }
  if (key === "banner") {
    const b = v as { text?: string };
    return b.text ? `«${b.text.slice(0, 60)}${b.text.length > 60 ? "…" : ""}»` : "-";
  }
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}
