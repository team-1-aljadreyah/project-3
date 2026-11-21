// The jobs, who may see which project, and the main menu. The menu hides what a job doesn't use, but the server is
// the judge: it must refuse what a job may not see (the brief: each person sees only their part).
import type { Role, User } from "../api/types";

/**
 * THE CEO RULE (the client, 21 November 2026): the CEO may see and do everything any other job can, today and for
 * everything added later, including the system admin's work. So every permission rule starts with `isCeo(user) ||`,
 * and the menu shows the CEO every item (navFor). tests/unit/ceo-rule.test.ts fails when a new `can…` rule in a
 * feature's rules.ts forgets the CEO. The one thing it does not open: other people's private one-to-one chats.
 */
export const isCeo = (user: Pick<User, "role">) => user.role === "ceo";

/** The part of a project these rules need (any project-like object fits). */
type Members = { pm_id: number; member_ids: number[] };

/** The person runs the project or is one of its members. */
export const isMember = (user: Pick<User, "id">, project: Members) =>
  project.pm_id === user.id || project.member_ids.includes(user.id);

/** The brief: the CEO, M&E and the admin see every project; a PM the ones they run; others the ones they're in. */
export function canSeeProject(user: Pick<User, "id" | "role">, project: Members) {
  if (isCeo(user) || user.role === "monitor" || user.role === "admin") return true;
  return isMember(user, project);
}

/**
 * Change a project's setup: details, members, statuses, phases, sprints, GitHub. The project's PM and the CEO. Here (not
 * in the projects feature) because the GitHub feature needs it too, and features may not import each other in a loop.
 */
export function canManageProjectSetup(user: Pick<User, "id" | "role">, project: { pm_id: number }) {
  return isCeo(user) || project.pm_id === user.id;
}

/**
 * Takes part in a project's work: comments, adds files. Everyone who can see the project, except the system admin
 * (accounts, not project work). Used by the task rules and the file attachments, so both follow the same rule.
 */
export function canTakePart(user: Pick<User, "id" | "role">, project: Members) {
  if (user.role === "admin") return false;
  return isCeo(user) || user.role === "monitor" || isMember(user, project);
}

export const ROLES: Record<Role, { ar: string; en: string }> = {
  ceo: { ar: "المدير التنفيذي", en: "CEO" },
  pm: { ar: "مدير القسم", en: "Project manager" },
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
  { key: "dashboard", ar: "لوحة القيادة", en: "Dashboard", href: "/dashboard", roles: ["ceo", "pm", "monitor", "lead"], ready: true },
  { key: "my-tasks", ar: "مهامي", en: "My tasks", href: "/my-tasks", roles: ["pm", "lead", "employee"], ready: true },
  { key: "projects", ar: "المشاريع", en: "Projects", href: "/", roles: WORK, ready: true },
  { key: "chat", ar: "المحادثات", en: "Chat", href: "/chat", roles: WORK, ready: true },
  { key: "bugs", ar: "الأخطاء البرمجية", en: "Bugs", href: "/bugs", roles: WORK, ready: true },
  { key: "announcements", ar: "الإعلانات", en: "Announcements", href: "/announcements", roles: ALL, ready: true },
  { key: "performance", ar: "الأداء", en: "Performance", href: "/performance", roles: WORK, ready: true },
  { key: "reports", ar: "التقارير", en: "Reports", href: "/reports", roles: ["ceo", "pm", "monitor", "lead"], ready: true },
  { key: "monitoring", ar: "المتابعة", en: "Monitoring", href: "/monitoring", roles: ["monitor"], ready: true },
  { key: "inbox", ar: "الوارد", en: "Inbox", href: "/inbox", roles: ["ceo"], ready: true },
  { key: "requests", ar: "طلباتي", en: "My requests", href: "/requests", roles: ["employee"], ready: true },
  { key: "admin", ar: "إدارة النظام", en: "Administration", href: "/admin", roles: ["admin"], ready: true },
  { key: "audit", ar: "سجل العمليات", en: "Audit log", href: "/audit", roles: ["ceo", "admin"], ready: true },
];

/** The menu of a job. The CEO sees every item, also the ones added later (the CEO rule above). */
export function navFor(role: Role) {
  return role === "ceo" ? NAV : NAV.filter((n) => n.roles.includes(role));
}

/** Which menu item a page belongs to: "/projects/3" → "projects". */
export function activeNavKey(path: string) {
  if (path === "/" || path.startsWith("/projects") || path.startsWith("/tasks")) return "projects";
  return NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.key;
}
