// The audit log's actions in words (Arabic first, English second).
import type { AuditAction } from "./types";

export const ACTION_WORDS: Record<AuditAction, { ar: string; en: string }> = {
  user_created: { ar: "أضاف مستخدماً", en: "added a user" },
  user_changed: { ar: "عدّل مستخدماً", en: "changed a user" },
  user_stopped: { ar: "أوقف حساباً", en: "stopped an account" },
  user_restarted: { ar: "أعاد تشغيل حساب", en: "restarted an account" },
  user_unlocked: { ar: "فتح حساباً مقفلاً", en: "unlocked an account" },
  team_created: { ar: "أنشأ فريقاً", en: "created a team" },
  team_changed: { ar: "عدّل فريقاً", en: "changed a team" },
  settings_changed: { ar: "غيّر الإعدادات", en: "changed the settings" },
  login_failed: { ar: "محاولة دخول خاطئة", en: "failed sign-in" },
  login_locked: { ar: "قُفل حساب", en: "account locked" },
  project_created: { ar: "أنشأ مشروعاً", en: "created a project" },
  project_pm_changed: { ar: "غيّر مدير مشروع", en: "changed a project's PM" },
  sprint_closed: { ar: "أنهى دورة", en: "ended a sprint" },
  template_deleted: { ar: "حذف قالباً", en: "removed a template" },
  announcement_deleted: { ar: "حذف إعلاناً", en: "removed an announcement" },
  criteria_changed: { ar: "غيّر معايير التقييم", en: "changed the review criteria" },
  criteria_approved: { ar: "اعتمد معايير التقييم", en: "approved the review criteria" },
  review_finalized: { ar: "اعتمد تقييم أداء", en: "made a review final" },
};
