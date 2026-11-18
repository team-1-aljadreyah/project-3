// How each severity, status and status move is named and coloured. The colours borrow the task status families.
import type { StatusTone } from "@/shared/api/types";
import type { BugStatus, Severity } from "./types";

type Label = { ar: string; en: string; tone: StatusTone };

export const SEVERITY: Record<Severity, Label> = {
  critical: { ar: "حرجة", en: "Critical", tone: "blocked" },
  high: { ar: "عالية", en: "High", tone: "review" },
  medium: { ar: "متوسطة", en: "Medium", tone: "todo" },
  low: { ar: "منخفضة", en: "Low", tone: "new" },
};

export const BUG_STATUS: Record<BugStatus, Label> = {
  reported: { ar: "مُسجّلة", en: "Reported", tone: "new" },
  assigned: { ar: "مُسندة", en: "Assigned", tone: "todo" },
  fixing: { ar: "قيد الإصلاح", en: "Fixing", tone: "progress" },
  testing: { ar: "قيد الاختبار", en: "Testing", tone: "testing" },
  reopened: { ar: "أُعيدت للمطور", en: "Reopened", tone: "blocked" },
  closed: { ar: "مغلقة", en: "Closed", tone: "done" },
};

/** The button for each move: what the person is saying when they press it. */
export const MOVE_LABEL: Record<BugStatus, { ar: string; en: string }> = {
  reported: { ar: "سجّلها", en: "Report" },
  assigned: { ar: "أسندها للمطور", en: "Assign" },
  fixing: { ar: "ابدأ الإصلاح", en: "Start fixing" },
  testing: { ar: "أصلحتُها: إلى الاختبار", en: "Fixed: send to testing" },
  closed: { ar: "أُصلحت: أغلقها", en: "Fixed: close it" },
  reopened: { ar: "لم تُحل: أعدها للمطور", en: "Not fixed: send back" },
};
