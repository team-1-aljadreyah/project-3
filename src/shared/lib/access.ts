// The jobs, who may see which project, and the main menu. The menu hides what a job doesn't use, but the server is
// the judge: it must refuse what a job may not see (the brief: each person sees only their part).
import type { Role, User } from "../api/types";

/** The part of a project these rules need (any project-like object fits). */
type Members = { pm_id: number; member_ids: number[] };

/** The person runs the project or is one of its members. */
export const isMember = (user: Pick<User, "id">, project: Members) =>
  project.pm_id === user.id || project.member_ids.includes(user.id);

/** The brief: the CEO, M&E and the admin see every project; a PM the ones they run; others the ones they're in. */
export function canSeeProject(user: Pick<User, "id" | "role">, project: Members) {
  if (user.role === "ceo" || user.role === "monitor" || user.role === "admin") return true;
  return isMember(user, project);
}

/**
 * Takes part in a project's work: comments, adds files. Everyone who can see the project, except the system admin
 * (accounts, not project work). Used by the task rules and the file attachments, so both follow the same rule.
 */
export function canTakePart(user: Pick<User, "id" | "role">, project: Members) {
  if (user.role === "admin") return false;
  return user.role === "ceo" || user.role === "monitor" || isMember(user, project);
}

export const ROLES: Record<Role, { ar: string; en: string }> = {
  ceo: { ar: "المدير التنفيذي", en: "CEO" },
  pm: { ar: "مدير المشروع", en: "Project manager" },
  monitor: { ar: "مسؤول المتابعة والتقييم", en: "Monitoring & evaluation" },
  lead: { ar: "قائد الفريق", en: "Team leader" },
  employee: { ar: "موظف", en: "Employee" },
  admin: { ar: "مسؤول النظام", en: "System admin" },
};

export interface NavItem {
  key: string;
  ar: string;
  en: string;
  href: string;
  /** Who sees it. */
  roles: Role[];
  /** false = not built yet: shown greyed out with "soon", never a broken link. */
  ready: boolean;
}

const ALL: Role[] = ["ceo", "pm", "monitor", "lead", "employee", "admin"];
const WORK: Role[] = ["ceo", "pm", "monitor", "lead", "employee"];

export const NAV: NavItem[] = [
  { key: "dashboard", ar: "لوحة القيادة", en: "Dashboard", href: "/dashboard", roles: ["ceo", "pm", "monitor", "lead"], ready: false },
  { key: "my-tasks", ar: "مهامي", en: "My tasks", href: "/my-tasks", roles: ["pm", "lead", "employee"], ready: true },
  { key: "projects", ar: "المشاريع", en: "Projects", href: "/", roles: WORK, ready: true },
  { key: "chat", ar: "المحادثات", en: "Chat", href: "/chat", roles: WORK, ready: false },
  { key: "bugs", ar: "الأخطاء البرمجية", en: "Bugs", href: "/bugs", roles: WORK, ready: false },
  { key: "announcements", ar: "الإعلانات", en: "Announcements", href: "/announcements", roles: ALL, ready: true },
  { key: "reports", ar: "التقارير", en: "Reports", href: "/reports", roles: ["ceo", "pm", "monitor", "lead"], ready: false },
  { key: "users", ar: "المستخدمون", en: "Users", href: "/users", roles: ["admin"], ready: false },
];

export function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

/** Which menu item a page belongs to: "/projects/3" → "projects". */
export function activeNavKey(path: string) {
  if (path === "/" || path.startsWith("/projects") || path.startsWith("/tasks")) return "projects";
  return NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.key;
}
