// The audit log's actions in words (Arabic first, English second), and the kind each action is.
import type { StatusTone } from "@/shared/api/types";
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

/** The kind of an action: the part of the platform it is about. The admin page shows it as a small coloured label. */
export type AuditKind = "account" | "team" | "settings" | "signin" | "project" | "announcement" | "review";

export const ACTION_KIND: Record<AuditAction, AuditKind> = {
  user_created: "account",
  user_changed: "account",
  user_stopped: "account",
  user_restarted: "account",
  user_unlocked: "account",
  team_created: "team",
  team_changed: "team",
  settings_changed: "settings",
  login_failed: "signin",
  login_locked: "signin",
  project_created: "project",
  project_pm_changed: "project",
  sprint_closed: "project",
  template_deleted: "project",
  announcement_deleted: "announcement",
  criteria_changed: "review",
  criteria_approved: "review",
  review_finalized: "review",
};

/** Each kind in words, with its colour family (sign-in trouble is the red one). */
export const KIND_WORDS: Record<AuditKind, { ar: string; en: string; tone: StatusTone }> = {
  account: { ar: "حساب", en: "Account", tone: "todo" },
  team: { ar: "فريق", en: "Team", tone: "testing" },
  settings: { ar: "إعدادات", en: "Settings", tone: "new" },
  signin: { ar: "دخول", en: "Sign-in", tone: "blocked" },
  project: { ar: "مشروع", en: "Project", tone: "progress" },
  announcement: { ar: "إعلان", en: "Announcement", tone: "review" },
  review: { ar: "تقييم", en: "Review", tone: "done" },
};
