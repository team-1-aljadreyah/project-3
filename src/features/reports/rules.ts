// Who sees the dashboard and the reports (the brief: CEO, PM, M&E, team leaders). Employees see their own tasks
// ("My tasks"); the admin runs accounts, not projects. The same jobs as the menu items in shared/lib/access.ts.
import type { User } from "@/shared/api/types";

export const REPORT_ROLES: User["role"][] = ["ceo", "pm", "monitor", "lead"];
export const canSeeReports = (user: Pick<User, "role">) => REPORT_ROLES.includes(user.role);
