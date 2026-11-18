import type { StatusTone } from "@/shared/api/types";
import type { ProjectState } from "./types";

/** How each project state is named and coloured (it borrows a task-status colour family). */
export const PROJECT_STATE: Record<ProjectState, { ar: string; en: string; tone: StatusTone }> = {
  planned: { ar: "مخطط له", en: "Planned", tone: "todo" },
  active: { ar: "نشط", en: "Active", tone: "done" },
  paused: { ar: "متوقف", en: "Paused", tone: "blocked" },
  done: { ar: "مكتمل", en: "Done", tone: "new" },
};
