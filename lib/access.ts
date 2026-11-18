// The jobs and the main menu. The menu hides what a job doesn't use, but the server is the judge:
// it must refuse what a job may not see (the brief: each person sees only their part).
import type { Role } from "./api/types";

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
  { key: "my-tasks", ar: "مهامي", en: "My tasks", href: "/my-tasks", roles: ["pm", "lead", "employee"], ready: false },
  { key: "projects", ar: "المشاريع", en: "Projects", href: "/", roles: WORK, ready: true },
  { key: "chat", ar: "المحادثات", en: "Chat", href: "/chat", roles: WORK, ready: false },
  { key: "bugs", ar: "الأخطاء البرمجية", en: "Bugs", href: "/bugs", roles: WORK, ready: false },
  { key: "announcements", ar: "الإعلانات", en: "Announcements", href: "/announcements", roles: ALL, ready: false },
  { key: "reports", ar: "التقارير", en: "Reports", href: "/reports", roles: ["ceo", "pm", "monitor", "lead"], ready: false },
  { key: "users", ar: "المستخدمون", en: "Users", href: "/users", roles: ["admin"], ready: false },
];

export function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

/** Which menu item a page belongs to: "/projects/3" → "projects". */
export function activeNavKey(path: string) {
  if (path === "/" || path.startsWith("/projects")) return "projects";
  return NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.key;
}
